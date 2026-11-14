import assert from 'node:assert/strict'
import test from 'node:test'
import { compatibilityLayers, findSmartQueuePool } from './smartQueueCandidates.ts'
import type { SmartQueueCandidate } from './smartQueueCandidates.ts'

const player = (id: string, overrides: Partial<SmartQueueCandidate> = {}): SmartQueueCandidate => ({
  id, totalGames: 0, skill: 1, waitingScore: 0, latePriority: false, arrivalOrder: 0, ...overrides,
})

for (const { maxGameGap, maxSkillGap } of compatibilityLayers) {
  const layer = compatibilityLayers.findIndex((rule) =>
    rule.maxGameGap === maxGameGap && rule.maxSkillGap === maxSkillGap,
  ) + 1
  test(`stops at layer ${layer} and keeps tighter candidates eligible`, () => {
    const pool = findSmartQueuePool([
      player('base'), player('tight'), player('boundary-1', { totalGames: maxGameGap, skill: maxSkillGap + 1 }),
      player('boundary-2', { totalGames: maxGameGap, skill: maxSkillGap + 1 }),
      player('outside', { totalGames: 3 }),
    ], 'base')
    assert.equal(pool?.layer, layer)
    assert.deepEqual(pool.candidates.map(({ id }) => id), ['tight', 'boundary-1', 'boundary-2'])
  })
}

test('orders base players by priority, games, waiting, then arrival', () => {
  const players = [
    player('ordinary', { waitingScore: 50 }),
    player('late-more-games', { latePriority: true, totalGames: 1, waitingScore: 50 }),
    player('late-less-wait', { latePriority: true }),
    player('late-arrived-last', { latePriority: true, waitingScore: 20, arrivalOrder: 2 }),
    player('late-arrived-first', { latePriority: true, waitingScore: 20, arrivalOrder: 1 }),
  ]
  assert.equal(findSmartQueuePool(players)?.base.id, 'late-arrived-first')
  assert.equal(findSmartQueuePool(players, 'ordinary')?.base.id, 'ordinary')
})

test('falls through an isolated base without changing priority or replacing an explicit choice', () => {
  const isolated = player('isolated', { latePriority: true, totalGames: 3 })
  const players = [isolated, ...['a', 'b', 'c', 'd'].map((id) => player(id))]
  assert.equal(findSmartQueuePool(players)?.base.id, 'a')
  assert.equal(isolated.latePriority, true)
  assert.equal(findSmartQueuePool(players, isolated.id), null)
})
