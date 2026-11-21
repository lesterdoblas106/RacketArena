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

test('successive late arrivals count active turns toward the missed-games baseline', () => {
  const render = setup(['a', 'b'], {
    matchmakingMode: 'smart-queue',
    stats: { a: stats({ gamesPlayed: 3 }), b: stats(), c: stats(), d: stats() },
    courts: [court('one', { teamA: ['a'], teamB: ['b'], startedAt: 2000 }), court('two')],
  })
  render().moveToPlaying('c')
  assert.equal(render().activeSession!.stats.c.missedGames, 1)
  assert.equal(render().activeSession!.stats.b.gamesPlayed, 0)
  render().moveToPlaying('d')
  assert.equal(render().activeSession!.stats.d.missedGames, 1)
})

test('a waiting player still sets the minimum below players in active matches', () => {
  const render = setup(['a', 'b'], {
    matchmakingMode: 'smart-queue',
    stats: { a: stats(), b: stats(), c: stats() },
    courts: [court('one', { teamA: ['a'], startedAt: 2000 }), court('two')],
  })
  render().moveToPlaying('c')
  assert.equal(render().activeSession!.stats.c.missedGames, 0)
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

test('captures independent scored generations, including the actual arrangement and input stats', () => {
  mock.method(Date, 'now', () => 2500)
  const render = setup(ids)
  assert.equal(render().activeSession!.scoringSnapshots, undefined)
  render().generateRoster()
  const first = render().activeSession!.scoringSnapshots![0]
  assert.ok('scoring' in first)
  const decision = first.scoring
  const recorded = JSON.stringify(first)
  const roster = render().activeSession!.rosters[0]
  assert.deepEqual(decision.arrangements[decision.winnerIndex].teams.flat(), roster.playerIds)
  assert.equal(decision.arrangements.length, 105)
  assert.equal(decision.players[decision.baseId].totalGames, 0)
  assert.equal(decision.players[decision.baseId].currentWait, 1500)
  assert.equal(decision.searches[0].layers[0].qualifiedIds.length, 7)
  render().assignToCourt(roster.id, 'one')
  render().endMatch('one', 21, 12)
  render().generateRoster()
  const snapshots = render().activeSession!.scoringSnapshots!
  assert.equal(snapshots.length, 2)
  assert.notEqual(snapshots[0].id, first.id)
  assert.equal(JSON.stringify(snapshots[1]), recorded)
})

test('forfeit restores the continuous bench clock without recording a game', () => {
  mock.method(Date, 'now', () => 2000)
  const render = setup()
  render().generateRoster()
  render().assignToCourt(render().activeSession!.rosters[0].id, 'one')
  mock.method(Date, 'now', () => 6000)
  render().forfeitMatch('one')
  const session = render().activeSession!
  assert.equal(session.stats.a.waitingSince, startedAt)
  assert.equal(session.stats.a.averageWaitMs, 0)
  assert.equal(session.stats.a.waitPeriods, 0)
  assert.equal(session.stats.a.gamesPlayed, 0)
  assert.deepEqual(session.history, [])
  assert.equal(session.courts[0].preMatchWaiting, undefined)
})

test('forfeit after reload restores existing waits and late priority, and is idempotent', () => {
  const minute = 60000
  mock.method(Date, 'now', () => startedAt + 25 * minute)
  const before = stats({ gamesPlayed: 2, wins: 1, totalWaitMs: 40 * minute, waitPeriods: 2, averageWaitMs: 20 * minute })
  let render = setup(ids, {
    priorityList: ['a'], playerList: ids.slice(1),
    stats: Object.fromEntries(ids.map((id) => [id, id === 'a' ? before : stats()])),
  })
  for (const id of ids.slice(0, 4)) render().toggleManualPick(id)
  render().queueManualRoster()
  render().assignToCourt(render().activeSession!.rosters[0].id, 'one')
  const active = render().activeSession!
  assert.equal(active.stats.a.waitPeriods, 3)
  assert.ok(active.courts[0].preMatchWaiting?.a.latePriority)
  // Serialize exactly as a persisted session would be, retaining court snapshots.
  render = setup(ids, JSON.parse(JSON.stringify(active)))
  for (const id of ids.slice(4)) render().toggleManualPick(id)
  render().queueManualRoster()
  render().assignToCourt(render().activeSession!.rosters[0].id, 'two')
  const otherCourt = JSON.stringify(render().activeSession!.courts[1])
  render().endMatch('two', 21, 19)
  const history = JSON.stringify(render().activeSession!.history)
  const otherStats = JSON.stringify(render().activeSession!.stats.e)
  assert.ok(otherCourt.includes('preMatchWaiting'))
  assert.equal(render().activeSession!.courts[1].preMatchWaiting, undefined)
  mock.method(Date, 'now', () => startedAt + 30 * minute)
  render().forfeitMatch('one')
  const restored = render().activeSession!
  assert.deepEqual(restored.stats.a, before)
  assert.equal((startedAt + 30 * minute - restored.stats.a.waitingSince) * 0.7 + restored.stats.a.averageWaitMs * 0.3, 27 * minute)
  assert.ok(restored.priorityList.includes('a'))
  assert.ok(!restored.playerList.includes('a'))
  assert.equal(JSON.stringify(restored.history), history)
  assert.equal(JSON.stringify(restored.stats.e), otherStats)
  render().forfeitMatch('one')
  assert.deepEqual(render().activeSession!.stats.a, before)
  // A second dispatched and forfeited turn also restores the original interval.
  for (const id of ids.slice(0, 4)) render().toggleManualPick(id)
  render().queueManualRoster()
  render().assignToCourt(render().activeSession!.rosters[0].id, 'one')
  render().forfeitMatch('one')
  assert.deepEqual(render().activeSession!.stats.a, before)
  assert.equal(render().activeSession!.priorityList.filter((id) => id === 'a').length, 1)
})

test('legacy forfeits preserve known totals and do not fabricate waiting records', () => {
  for (const withRecords of [false, true]) {
    const before = stats({ totalWaitMs: 800, waitPeriods: 2, averageWaitMs: 400 })
    const render = setup(ids.slice(0, 4), {
      stats: Object.fromEntries(ids.map((id) => [id, { ...before }])),
      courts: [court('one', {
        teamA: ['a', 'b'], teamB: ['c', 'd'], startedAt: 2000,
        waitingRecords: withRecords ? ids.slice(0, 4).map((memberId) => ({ memberId, waitingStartedAt: startedAt, matchStartedAt: 2000, waitingMs: 1000, gameNumber: 1 })) : undefined,
      })],
    })
    render().forfeitMatch('one')
    assert.deepEqual(render().activeSession!.stats.a, before)
    assert.deepEqual(render().activeSession!.history, [])
  }
})

test('one, two and four manual picks preserve explicit players', () => {
  for (const picked of [['d'], ['d', 'b'], ['d', 'b', 'c', 'a']]) {
    const render = setup()
    for (const id of picked) render().toggleManualPick(id)
    if (picked.length === 4) render().queueManualRoster()
    else render().generateRoster()
    const [roster] = render().activeSession!.rosters
    assert.deepEqual(roster.playerIds.slice(0, picked.length), picked)
    const [snapshot] = render().activeSession!.scoringSnapshots!
    assert.equal('scoring' in snapshot, picked.length === 1)
  }
})

test('an unsuccessful generation does not create inspector history', () => {
  const render = setup(['a', 'b', 'c'])
  render().generateRoster()
  assert.equal(render().activeSession!.scoringSnapshots, undefined)
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

test('win-lose stack forfeits retain their existing waiting lifecycle and restore stacks', () => {
  mock.method(Date, 'now', () => 2000)
  const render = setup(ids.slice(0, 4), {
    matchmakingMode: 'win-lose-stack',
    winLoseStack: {
      unplayed: ids.slice(0, 4), winners: [], losers: [], manualMatches: [],
      initialPlayerIds: [], calibrationComplete: true, playingNext: 'winner', teamRotation: 0,
    },
  })
  render().assignStackMatchToCourt(null, 'one', ids.slice(0, 4))
  assert.equal(render().activeSession!.courts[0].preMatchWaiting, undefined)
  mock.method(Date, 'now', () => 6000)
  render().forfeitMatch('one')
  const session = render().activeSession!
  assert.equal(session.stats.a.waitingSince, 6000)
  assert.equal(session.stats.a.waitPeriods, 1)
  assert.equal(session.stats.a.averageWaitMs, 1000)
  assert.deepEqual(session.winLoseStack.unplayed, ids.slice(0, 4))
  assert.deepEqual(session.history, [])
})
