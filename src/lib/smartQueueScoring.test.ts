import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPairingCounts, calculateWaitingScore, scoreSmartQueueArrangement, selectSmartQueueArrangement } from './smartQueueScoring.ts'

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
  assert.equal(Object.values(weights).reduce((sum, value) => sum + value, 0), 1)
  assert.equal(weighted.waiting, 0.1)
  assert.ok(Math.abs(total - 47.23214285714286) < 1e-10)
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
