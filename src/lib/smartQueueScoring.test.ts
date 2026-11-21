import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPairingCounts, calculateWaitingScore, scoreSmartQueueArrangement, selectSmartQueueArrangement, smartQueueWeights } from './smartQueueScoring.ts'
import { rankArrangements, type ScoredArrangement } from './smartQueueInspector.ts'

const a = { id: 'a', totalGames: 0, skill: 1, waitingScore: 10 }
const b = { id: 'b', totalGames: 1, skill: 2, waitingScore: 20 }
const c = { id: 'c', totalGames: 2, skill: 3, waitingScore: 30 }
const d = { id: 'd', totalGames: 3, skill: 4, waitingScore: 40 }

test('calculates all six objectives from pairwise differences and session history', () => {
  const counts = buildPairingCounts([
    { teamA: ['b', 'a'], teamB: ['d', 'c'] },
    { teamA: ['a', 'c'], teamB: ['b', 'd'] },
    { teamA: ['c', 'd'], teamB: ['a', 'b'] },
  ])
  const { raw, normalized, weights, weighted, total } = scoreSmartQueueArrangement([[a, b], [c, d]], 50, counts)
  assert.deepEqual(raw.gameDifferences, [1, 2, 3, 1, 2, 1])
  assert.deepEqual(raw.skillDifferences, [1, 2, 3, 1, 2, 1])
  assert.deepEqual(raw.teammateCounts, [2, 2])
  assert.deepEqual(raw.opponentCounts, [2, 3, 3, 2])
  assert.equal(raw.averageGameDifference, 10 / 6)
  assert.equal(raw.meanWaitingScore, 25)
  assert.equal(raw.sumSkillDifferences, 10)
  assert.equal(raw.teamDifference, 4)
  assert.equal(raw.averageTeammateRepetitions, 2)
  assert.equal(raw.averageOpponentRepetitions, 2.5)
  assert.equal(normalized.game, 1 / (1 + 10 / 6))
  assert.equal(normalized.waiting, 0.5)
  assert.equal(normalized.skill, 1 - 10 / 24)
  assert.equal(normalized.team, 1 - 4 / 12)
  assert.equal(normalized.teammate, 1 / 3)
  assert.equal(normalized.opponent, 1 / 3.5)
  assert.deepEqual(weights, smartQueueWeights)
  assert.deepEqual(weighted, {
    game: weights.game * (1 / (1 + 10 / 6)),
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
