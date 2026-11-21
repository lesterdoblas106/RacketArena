import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPairingCounts, calculateWaitingScore, scoreSmartQueueArrangement, selectSmartQueueArrangement, smartQueueWeights } from './smartQueueScoring.ts'
import { getGameDifferenceBreakdown, rankArrangements, type AutomaticScoring, type ScoredArrangement } from './smartQueueInspector.ts'

const a = { id: 'a', totalGames: 0, skill: 1, waitingScore: 10 }
const b = { id: 'b', totalGames: 1, skill: 2, waitingScore: 20 }
const c = { id: 'c', totalGames: 2, skill: 3, waitingScore: 30 }
const d = { id: 'd', totalGames: 3, skill: 4, waitingScore: 40 }

test('calculates base-centered game differences and preserves the other five objectives', () => {
  const counts = buildPairingCounts([
    { teamA: ['b', 'a'], teamB: ['d', 'c'] },
    { teamA: ['a', 'c'], teamB: ['b', 'd'] },
    { teamA: ['c', 'd'], teamB: ['a', 'b'] },
  ])
  const { raw, normalized, weights, weighted, total } = scoreSmartQueueArrangement([[a, b], [c, d]], 50, counts)
  assert.deepEqual(raw.gameDifferences, [1, 2, 3])
  assert.deepEqual(raw.skillDifferences, [1, 2, 3, 1, 2, 1])
  assert.deepEqual(raw.teammateCounts, [2, 2])
  assert.deepEqual(raw.opponentCounts, [2, 3, 3, 2])
  assert.equal(raw.averageGameDifference, 2)
  assert.equal(raw.meanWaitingScore, 25)
  assert.equal(raw.sumSkillDifferences, 10)
  assert.equal(raw.teamDifference, 4)
  assert.equal(raw.averageTeammateRepetitions, 2)
  assert.equal(raw.averageOpponentRepetitions, 2.5)
  assert.equal(normalized.game, 1 / 3)
  assert.equal(normalized.waiting, 0.5)
  assert.equal(normalized.skill, 1 - 10 / 24)
  assert.equal(normalized.team, 1 - 4 / 12)
  assert.equal(normalized.teammate, 1 / 3)
  assert.equal(normalized.opponent, 1 / 3.5)
  assert.deepEqual(weights, smartQueueWeights)
  assert.deepEqual(weighted, {
    game: weights.game * (1 / 3),
    waiting: weights.waiting * 0.5,
    skill: weights.skill * (1 - 10 / 24),
    team: weights.team * (1 - 4 / 12),
    teammate: weights.teammate * (1 / 3),
    opponent: weights.opponent * (1 / 3.5),
  })
  assert.equal(total, 100 * Object.values(weighted).reduce((sum, value) => sum + value, 0))
})

test('captures every evaluated arrangement and preserves evaluation order on exact ties', () => {
  const [base, ...candidates] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ ...a, id }))
  const captures: ScoredArrangement[] = []
  const winner = selectSmartQueueArrangement(base, candidates, 10, buildPairingCounts([]),
    ([[a, b], [c, d]], score) => captures.push({ teams: [[a.id, b.id], [c.id, d.id]], score }),
  )
  const ranked = rankArrangements(captures)
  assert.equal(ranked.length, 12)
  assert.deepEqual(ranked.map(({ index }) => index), Array.from({ length: 12 }, (_, index) => index))
  assert.deepEqual(ranked[0].teams.flat(), winner?.teams.flat().map(({ id }) => id))
  assert.equal(ranked[0].score.total, winner?.total)
})

test('zero waiting and zero history have defined scores', () => {
  const players = [a, b, c, d].map((player) => ({ ...player, waitingScore: 0 }))
  const score = scoreSmartQueueArrangement([[players[0], players[1]], [players[2], players[3]]], 0, buildPairingCounts([]))
  assert.equal(score.normalized.waiting, 0)
  assert.equal(score.normalized.teammate, 1)
  assert.equal(score.normalized.opponent, 1)
  assert.equal(calculateWaitingScore(100, 200), 130)
})

test('history can make a less balanced team arrangement win', () => {
  const counts = buildPairingCounts(Array.from({ length: 5 }, () => ({
    teamA: ['a', 'd'], teamB: ['b', 'c'],
  })))
  const winner = selectSmartQueueArrangement(a, [b, c, d], 40, counts)
  assert.deepEqual(winner?.teams, [[a, c], [b, d]])
})

test('compares later combinations by composite score even when their game gap is higher', () => {
  const players = [
    { ...a, waitingScore: 0 },
    { ...b, totalGames: 0, skill: 1, waitingScore: 0 },
    { ...c, totalGames: 0, skill: 1, waitingScore: 0 },
    { ...d, totalGames: 0, skill: 2, waitingScore: 0 },
    { id: 'e', totalGames: 1, skill: 1, waitingScore: 100 },
  ]
  const counts = buildPairingCounts([
    { teamA: ['a', 'b'], teamB: ['c', 'd'] },
    { teamA: ['a', 'c'], teamB: ['b', 'd'] },
    { teamA: ['a', 'd'], teamB: ['b', 'c'] },
  ])
  const winner = selectSmartQueueArrangement(players[0], players.slice(1), 100, counts)
  assert.ok(winner?.teams.flat().some(({ id }) => id === 'e'))
})

test('eligible late priority reserves a seat despite a shorter waiting score', () => {
  const base = { ...a, totalGames: 0, skill: 4, waitingScore: 10, latePriority: true }
  const late = { ...base, id: 'late', waitingScore: 0 }
  const regular = ['r1', 'r2', 'r3'].map(id => ({ ...base, id, waitingScore: 1000, latePriority: false }))
  const winner = selectSmartQueueArrangement(base, [late, ...regular], 1000, buildPairingCounts([]))!
  assert.ok(winner.teams.flat().some(({ id }) => id === 'late'))
  assert.equal(late.waitingScore, 0)
})

test('excess eligible priority players keep pool queue order and leave remaining players for later', () => {
  const base = { ...a, latePriority: true }
  const candidates = ['first', 'second', 'third', 'fourth'].map((id, i) => ({ ...a, id, latePriority: true, waitingScore: i * 100 }))
  const winner = selectSmartQueueArrangement(base, candidates, 300, buildPairingCounts([]))!
  assert.deepEqual(winner.teams.flat().map(({ id }) => id).sort(), ['a', 'first', 'second', 'third'])
})

for (const [games, difference, expected] of [
  [[4, 4, 4, 4], 0, 1],
  [[4, 4, 5, 5], 2, 0.6],
  [[4, 5, 5, 5], 3, 0.5],
  [[4, 6, 6, 6], 6, 1 / 3],
] as const) {
  test(`base-centered game score for ${games.join(', ')}`, () => {
    const players = games.map((totalGames, i) => ({ ...a, id: String(i), totalGames }))
    const score = scoreSmartQueueArrangement([[players[0], players[1]], [players[2], players[3]]], 10, buildPairingCounts([]))
    assert.equal(score.raw.gameDifferences.length, 3)
    assert.equal(score.raw.gameDifferences.reduce((sum, value) => sum + value, 0), difference)
    assert.equal(score.raw.averageGameDifference, difference / 3)
    assert.ok(Math.abs(score.normalized.game - expected) < 1e-12)
    assert.equal(score.weighted.game, smartQueueWeights.game * score.normalized.game)
  })
}

test('uses the explicit higher-game base even when the team order changes', () => {
  const base = { ...a, id: 'priority-base', totalGames: 5, latePriority: true }
  const others = [b, c, d].map(player => ({ ...player, totalGames: 4 }))
  const captures: ScoredArrangement[] = []
  selectSmartQueueArrangement(base, others, 40, buildPairingCounts([]), (teams, score) => {
    captures.push({ teams: [[teams[0][0].id, teams[0][1].id], [teams[1][0].id, teams[1][1].id]], score })
    assert.equal(score.raw.gameDifferenceBaseId, base.id)
    assert.deepEqual(score.raw.gameDifferences, [1, 1, 1])
    assert.equal(score.normalized.game, 0.5)
  })
  assert.equal(captures.length, 3)
  const reordered = scoreSmartQueueArrangement([[others[0], others[1]], [base, others[2]]], 40, buildPairingCounts([]), { base })
  assert.equal(reordered.normalized.game, 0.5)
  assert.equal(reordered.raw.skillDifferences.length, 6)
})

test('inspector describes the three base comparisons and preserves legacy stored scores', () => {
  const players = [a, b, c, d].map((player, i) => ({
    ...player, totalGames: [4, 4, 5, 5][i], name: player.id, gamesPlayed: 4,
    missedGames: 0, currentWait: 0, averageWait: 0, latePriority: false, arrivalOrder: i,
  }))
  const score = scoreSmartQueueArrangement([[players[0], players[1]], [players[2], players[3]]], 40, buildPairingCounts([]))
  const arrangement: ScoredArrangement = { teams: [['a', 'b'], ['c', 'd']], score }
  const data = { players: Object.fromEntries(players.map(player => [player.id, player])) } as AutomaticScoring
  const detail = getGameDifferenceBreakdown(data, arrangement)
  assert.equal(detail.base?.id, 'a')
  assert.deepEqual(detail.labels, [
    '|a (4 total games) − b (4 total games)|',
    '|a (4 total games) − c (5 total games)|',
    '|a (4 total games) − d (5 total games)|',
  ])
  assert.deepEqual(detail.differences, [0, 1, 1])
  assert.equal(detail.divisor, 3)
  assert.equal(detail.sum, 2)
  assert.equal(detail.average, 2 / 3)
  assert.equal(detail.normalized, score.normalized.game)
  assert.equal(detail.contribution, score.weighted.game * 100)
  const legacy: ScoredArrangement = JSON.parse(JSON.stringify(arrangement))
  delete legacy.score.raw.gameDifferenceBaseId
  legacy.score.raw.gameDifferences = [0, 1, 1, 1, 1, 0]
  legacy.score.raw.averageGameDifference = 4 / 6
  legacy.score.normalized.game = 1 / (1 + 4 / 6)
  legacy.score.weighted.game = smartQueueWeights.game * legacy.score.normalized.game
  const before = JSON.stringify(legacy)
  const historical = getGameDifferenceBreakdown(data, legacy)
  assert.equal(historical.base, undefined)
  assert.equal(historical.divisor, 6)
  assert.equal(historical.average, 4 / 6)
  assert.equal(historical.normalized, legacy.score.normalized.game)
  assert.equal(JSON.stringify(legacy), before)
})
