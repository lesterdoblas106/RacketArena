import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test, { mock } from 'node:test'
import type { Court, Member, MemberStats, Session } from '../types/app'

// Match the app bundler's extensionless TypeScript imports in Node.
const resolver = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
      return nextResolve(specifier + '.ts', context)
    }
    return nextResolve(specifier, context)
  },
})

let slots: unknown[] = []
let cursor = 0
mock.module('react', {
  namedExports: {
    useState(initial: unknown) {
      const index = cursor++
      if (index === slots.length) slots.push(typeof initial === 'function' ? initial() : initial)
      return [slots[index], (value: unknown) => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value
      }]
    },
    useEffect() {},
    useMemo(compute: () => unknown) { return compute() },
  },
})
mock.module('sonner', { namedExports: { toast: { warning() {} } } })
const { useRacketArenaState } = await import('./useRacketArenaState.ts')
resolver.deregister()

const startedAt = 1000
const storage = { getItem: (_key: string): string | null => null }
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const stats = (overrides: Partial<MemberStats> = {}): MemberStats => ({
  gamesPlayed: 0, missedGames: 0, wins: 0, waitingSince: startedAt, joinedAt: 0,
  totalWaitMs: 0, waitPeriods: 0, averageWaitMs: 0, ...overrides,
})
const court = (id: string, overrides: Partial<Court> = {}): Court => ({
  id, name: id, teamA: [], teamB: [], startedAt: null, scoreA: 0, scoreB: 0, ...overrides,
})
function setup(playingIds = ids.slice(0, 4), overrides: Partial<Session> = {}) {
  const members: Member[] = ids.map((id) => ({ id, name: id, skill: 'Beginner' }))
  const session = {
    id: 'session', name: 'Test', startedAt, createdAt: new Date(startedAt).toISOString(),
    playingIds, playerList: playingIds, priorityList: [], history: [], rosters: [],
    stats: Object.fromEntries(ids.map((id) => [id, stats()])),
    courts: [court('one'), court('two')], ...overrides,
  }
  slots = []
  mock.method(storage, 'getItem', () => JSON.stringify({ activeSessionId: session.id, members, sessions: [session] }))
  return () => {
    cursor = 0
    return useRacketArenaState()
  }
}

test.afterEach(() => mock.restoreAll())

test('automatic generation preserves its team split through dispatch and records wait only once', () => {
  mock.method(Date, 'now', () => 2000)
  const render = setup(ids.slice(0, 4), {
    priorityList: ['a'],
    playerList: ['b', 'c', 'd'],
    stats: { a: stats(), b: stats(), c: stats({ totalWaitMs: 900, waitPeriods: 3, averageWaitMs: 300 }), d: stats() },
    history: [{
      id: 'prior', courtLabel: 'one', teamA: ['a', 'b'], teamB: ['c', 'd'],
      scoreA: 21, scoreB: 19, result: 'teamA', endedAt: startedAt,
    }],
  })
  render().generateRoster()
  const queued = render().activeSession!
  assert.deepEqual(queued.priorityList, ['a'])
  assert.deepEqual(queued.rosters[0].playerIds, ['a', 'c', 'b', 'd'])
  render().assignToCourt(queued.rosters[0].id, 'two')
  const active = render().activeSession!
  assert.deepEqual(active.courts[1].teamA, ['a', 'c'])
  assert.deepEqual(active.courts[1].teamB, ['b', 'd'])
  assert.deepEqual(active.priorityList, [])
  assert.equal(active.stats.a.averageWaitMs, 1000)
  assert.equal(active.stats.c.averageWaitMs, 475)
  mock.method(Date, 'now', () => 5000)
  const reload = setup(active.playingIds, active)
  reload().endMatch('two', 21, 15)
  const finished = reload().activeSession!
  assert.equal(finished.stats.a.gamesPlayed, 1)
  assert.equal(finished.stats.a.wins, 1)
  assert.equal(finished.stats.a.waitPeriods, 1)
  assert.equal(finished.stats.c.waitPeriods, 4)
  assert.equal(finished.stats.a.waitingSince, 5000)
  assert.equal(finished.history[0].waitingRecords?.[0]?.waitingMs, 1000)
  assert.equal(finished.history[1].id, 'prior')
  assert.equal(finished.courts[1].waitingRecords, undefined)
})

test('late compensation adds only the shortfall and preserves prior missed games', () => {
  const render = setup(['a', 'b'], {
    stats: { a: stats({ gamesPlayed: 5 }), b: stats({ gamesPlayed: 3, missedGames: 1 }), c: stats({ missedGames: 1 }) },
  })
  render().moveToPlaying('c')
  const session = render().activeSession!
  assert.equal(session.stats.c.missedGames, 4)
  assert.deepEqual(session.priorityList, ['c'])
})

test('future rosters can include an active player but cannot overlap courts', () => {
  mock.method(Date, 'now', () => 5000)
  const render = setup(ids.slice(0, 7), {
    courts: [court('one', { teamA: ['a', 'b'], teamB: ['c', 'd'], startedAt: 2000 }), court('two')],
  })
  render().generateRoster()
  const future = render().activeSession!.rosters[0]
  assert.ok(future.playerIds.some((id) => ['a', 'b', 'c', 'd'].includes(id)))
  render().assignToCourt(future.id, 'two')
  assert.deepEqual(render().activeSession!.courts[1].teamA, [])
  render().endMatch('one', 20, 21)
  assert.equal(render().activeSession!.stats.a.averageWaitMs, 1000)
  render().assignToCourt(future.id, 'two')
  assert.equal(render().activeSession!.courts[1].teamA.length, 2)
})

test('prefers a complete bench roster when another court has active players', () => {
  const render = setup(ids, {
    priorityList: ['a'],
    courts: [court('one', { teamA: ['a', 'b'], teamB: ['c', 'd'], startedAt: 2000 }), court('two')],
  })
  render().generateRoster()
  assert.deepEqual([...render().activeSession!.rosters[0].playerIds].sort(), ids.slice(4))
})

test('forfeit restarts the bench clock and preserves the wait recorded at dispatch', () => {
  mock.method(Date, 'now', () => 2000)
  const render = setup()
  render().generateRoster()
  render().assignToCourt(render().activeSession!.rosters[0].id, 'one')
  mock.method(Date, 'now', () => 6000)
  render().forfeitMatch('one')
  const session = render().activeSession!
  assert.equal(session.stats.a.waitingSince, 6000)
  assert.equal(session.stats.a.averageWaitMs, 1000)
  assert.equal(session.stats.a.waitPeriods, 1)
  assert.equal(session.stats.a.gamesPlayed, 0)
})

test('one, two and four manual picks preserve explicit players', () => {
  for (const picked of [['d'], ['d', 'b'], ['d', 'b', 'c', 'a']]) {
    const render = setup()
    for (const id of picked) render().toggleManualPick(id)
    if (picked.length === 4) render().queueManualRoster()
    else render().generateRoster()
    const [roster] = render().activeSession!.rosters
    assert.deepEqual(roster.playerIds.slice(0, picked.length), picked)
  }
})

test('fills an incomplete roster and permits manual rotation', () => {
  const render = setup(ids.slice(0, 4), {
    rosters: [{ id: 'partial', playerIds: ['c', 'd'], baseOrder: ['c', 'd'], rotationIndex: 0, createdAt: '' }],
  })
  render().generateRoster()
  const [filled] = render().activeSession!.rosters
  assert.equal(filled.id, 'partial')
  assert.deepEqual([...filled.playerIds].sort(), ids.slice(0, 4))
  render().shuffleRoster(filled.id)
  assert.notDeepEqual(render().activeSession!.rosters[0].playerIds, filled.playerIds)
})

test('win-lose stack still dispatches and advances using match results', () => {
  const render = setup(ids.slice(0, 4), {
    matchmakingMode: 'win-lose-stack',
    winLoseStack: {
      unplayed: ids.slice(0, 4), winners: [], losers: [], manualMatches: [],
      initialPlayerIds: [], calibrationComplete: true, playingNext: 'winner', teamRotation: 0,
    },
  })
  render().generateRoster()
  assert.deepEqual(render().activeSession!.rosters, [])
  render().assignStackMatchToCourt(null, 'one', ids.slice(0, 4))
  const active = render().activeSession!
  assert.equal(active.courts[0].teamA.length, 2)
  render().endMatch('one', 21, 19)
  assert.deepEqual(render().activeSession!.winLoseStack.winners, active.courts[0].teamA)
})
