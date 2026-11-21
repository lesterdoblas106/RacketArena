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
const { getSessionSkill, getSessionSkillLabel, getRatingCategory, skillBorderClass, skillColor } = await import('../lib/skillDisplay.ts')
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

test('Elo initializes independently of manual skill and a new session resets ratings', () => {
  const render = setup(ids.slice(0, 4), { matchmakingMode: 'elo-smart-queue' })
  assert.equal(render().activeSession!.eloRatings!.a, 4)
  assert.equal(render().memberById.a.skill, 'Beginner')
  render().createQueue({ name: 'Fresh Elo', createdAt: new Date().toISOString(), matchmakingMode: 'elo-smart-queue' })
  const fresh = render().queuesForClub.find((s) => s.name === 'Fresh Elo')!
  assert.equal(fresh.eloRatings!.a, 4)
})

test('Elo doubles results persist through storage and reload, with no duplicate completion', async () => {
  const render = setup(ids.slice(0, 4), { matchmakingMode: 'elo-smart-queue' })
  render().generateRoster()
  const roster = render().activeSession!.rosters[0]
  render().assignToCourt(roster.id, 'one')
  const target = render().activeSession!.courts[0]
  render().endMatch('one', 21, 10)
  render().endMatch('one', 21, 10)
  const completed = render().activeSession!
  assert.equal(completed.history.length, 1)
  for (const id of target.teamA) assert.equal(completed.eloRatings![id], 4.5)
  for (const id of target.teamB) assert.equal(completed.eloRatings![id], 3.5)
  const { saveState, loadState } = await import('../lib/storage.ts')
  let saved = ''
  Object.assign(storage, { setItem(_key: string, value: string) { saved = value } })
  saveState({ members: Object.values(render().memberById), sessions: [completed], activeSessionId: completed.id })
  mock.method(storage, 'getItem', () => saved)
  const restored = loadState()!.sessions[0]
  const reload = setup(restored.playingIds, restored)
  assert.deepEqual(reload().activeSession!.eloRatings, completed.eloRatings)
  reload().endMatch('one', 21, 10)
  assert.deepEqual(reload().activeSession!.eloRatings, completed.eloRatings)
})

test('Elo corrections replace the previous contribution and repeated saves are idempotent', () => {
  const render = setup(ids.slice(0, 4), {
    matchmakingMode: 'elo-smart-queue',
    courts: [court('one', { teamA: ['a', 'b'], teamB: ['c', 'd'], startedAt })],
  })
  render().endMatch('one', 21, 10)
  const match = render().activeSession!.history[0]
  const correction = { teamA: ['a', 'c'], teamB: ['b', 'd'], scoreA: 10, scoreB: 21 }
  render().updateHistoryMatch(match.id, correction)
  render().updateHistoryMatch(match.id, correction)
  assert.deepEqual(Object.fromEntries(ids.slice(0, 4).map(id => [id, render().activeSession!.eloRatings![id]])), { a: 3.5, b: 4.5, c: 3.5, d: 4.5 })
  render().updateHistoryMatch(match.id, { ...correction, scoreA: 21 })
  assert.equal(render().activeSession!.eloRatings!.a, 4)
  assert.equal(render().activeSession!.eloRatings!.b, 4)
})

test('Elo forfeits cancel without games or ratings and restore accumulated waits after reload', () => {
  mock.method(Date, 'now', () => 4000)
  const render = setup(ids.slice(0, 4), { matchmakingMode: 'elo-smart-queue', priorityList: ['a'], playerList: ['b', 'c', 'd'] })
  const before = render().activeSession!
  render().generateRoster()
  render().assignToCourt(render().activeSession!.rosters[0].id, 'one')
  const active = render().activeSession!
  const reload = setup(active.playingIds, active)
  reload().forfeitMatch('one')
  reload().forfeitMatch('one')
  const after = reload().activeSession!
  assert.deepEqual(after.stats, before.stats)
  assert.deepEqual(after.eloRatings, before.eloRatings)
  assert.deepEqual(after.priorityList, before.priorityList)
  assert.equal(after.history.length, 0)
  reload().endMatch('one', 21, 10)
  assert.equal(reload().activeSession!.history.length, 0)
})

test('Elo late arrivals compensate active turns independently of rating and retain rating on return', () => {
  const render = setup(['a', 'b'], {
    matchmakingMode: 'elo-smart-queue',
    stats: Object.fromEntries(ids.map(id => [id, stats()])),
    courts: [court('one', { teamA: ['a'], teamB: ['b'], startedAt })],
  })
  render().moveToPlaying('c')
  assert.equal(render().activeSession!.stats.c.missedGames, 1)
  assert.equal(render().activeSession!.eloRatings!.c, 4)
  assert.ok(render().activeSession!.priorityList.includes('c'))
})

test('Elo repeated wins/losses are unlimited and updated ratings reach shared relaxation and scoring', () => {
  const history = Array.from({ length: 14 }, (_, i) => ({
    id: `game-${i}`, courtLabel: 'one', teamA: ['a', 'b'], teamB: ['c', 'd'],
    scoreA: 21, scoreB: 10, result: 'teamA' as const, endedAt: startedAt + i, eloAdjustment: 0.5,
  }))
  const render = setup(ids.slice(0, 4), { matchmakingMode: 'elo-smart-queue', history })
  assert.equal(render().activeSession!.eloRatings!.a, 11)
  assert.equal(render().activeSession!.eloRatings!.c, -3)
  render().generateRoster()
  assert.equal(render().activeSession!.rosters.length, 0)
  // Expand the pool with fresh arrivals; existing six-layer thresholds remain in force.
  for (const id of ids.slice(4)) render().moveToPlaying(id)
  render().generateRoster()
  const snapshot = render().activeSession!.scoringSnapshots![0]
  assert.ok('scoring' in snapshot)
  assert.equal(snapshot.scoring.players.a.skill, 11)
  assert.equal(snapshot.scoring.players.c.skill, -3)
  assert.equal(snapshot.scoring.players.e.skill, 4)
  assert.equal(snapshot.scoring.thresholds.length, 6)
  const saved = render().activeSession!
  const reload = setup(saved.playingIds, saved)
  reload().resignFromPlaying('a')
  reload().moveToPlaying('a')
  assert.equal(reload().activeSession!.eloRatings!.a, 11)
})

test('Elo subsequent completed matches accumulate, draws do not adjust and manual skills stay intact', () => {
  let render = setup(ids.slice(0, 4), { matchmakingMode: 'elo-smart-queue' })
  for (const [scoreA, scoreB] of [[21, 10], [21, 10], [10, 21], [21, 21]]) {
    const current = render().activeSession!
    render = setup(current.playingIds, { ...current, courts: [court('one', { teamA: ['a', 'b'], teamB: ['c', 'd'], startedAt })] })
    render().endMatch('one', scoreA, scoreB)
  }
  assert.equal(render().activeSession!.eloRatings!.a, 4.5)
  assert.equal(render().activeSession!.eloRatings!.c, 3.5)
  assert.equal(render().memberById.a.skill, 'Beginner')
})

test('existing Smart Queue results do not receive Elo fields or overwrite member skills', () => {
  const render = setup(ids.slice(0, 4), { courts: [court('one', { teamA: ['a', 'b'], teamB: ['c', 'd'], startedAt })] })
  render().endMatch('one', 21, 10)
  assert.equal(render().activeSession!.eloRatings, undefined)
  assert.equal(render().activeSession!.history[0].eloAdjustment, undefined)
  assert.equal(render().memberById.a.skill, 'Beginner')
})

for (const [index, [gameGap, skillGap]] of [[0, 1], [0, 2], [1, 2], [1, 3], [1, 4], [2, 6]].entries()) {
  test(`Elo ratings use unchanged relaxation layer ${index + 1}`, () => {
    const history = Array.from({ length: skillGap }, (_, i) => ({
      id: `result-${i}`, courtLabel: 'one', teamA: ['a', 'b'], teamB: ['c', 'd'],
      scoreA: 21, scoreB: 10, result: 'teamA' as const, endedAt: startedAt + i, eloAdjustment: 0.5,
    }))
    const render = setup(ids.slice(0, 4), {
      matchmakingMode: 'elo-smart-queue', history,
      stats: { a: stats(), b: stats(), c: stats({ gamesPlayed: gameGap }), d: stats({ gamesPlayed: gameGap }) },
    })
    render().toggleManualPick('a')
    render().generateRoster()
    const snapshot = render().activeSession!.scoringSnapshots![0]
    assert.ok('scoring' in snapshot)
    assert.equal(snapshot.scoring.layer, index + 1)
    assert.equal(snapshot.scoring.players.a.skill - snapshot.scoring.players.c.skill, skillGap)
  })
}

test('Elo restoration ignores duplicate result IDs and keeps removed players historical ratings', () => {
  const match = {
    id: 'completed', courtLabel: 'one', teamA: ['a', 'b'], teamB: ['c', 'd'],
    scoreA: 21, scoreB: 10, result: 'teamA' as const, endedAt: startedAt, eloAdjustment: 0.5,
  }
  const render = setup(['b', 'c', 'd'], {
    matchmakingMode: 'elo-smart-queue', history: [match, match],
    eloRatings: { a: 99, b: 99 },
    stats: Object.fromEntries(ids.filter(id => id !== 'a').map(id => [id, stats()])),
  })
  assert.equal(render().activeSession!.eloRatings!.a, 4.5)
  assert.equal(render().activeSession!.eloRatings!.b, 4.5)
})

test('Elo can build an upcoming roster with three bench players without changing court availability', () => {
  const render = setup(ids.slice(0, 7), {
    matchmakingMode: 'elo-smart-queue',
    courts: [court('one', { teamA: ['a', 'b'], teamB: ['c', 'd'], startedAt }), court('two')],
  })
  render().generateRoster()
  const roster = render().activeSession!.rosters[0]
  assert.ok(roster.playerIds.some(id => ['a', 'b', 'c', 'd'].includes(id)))
  render().assignToCourt(roster.id, 'two')
  assert.equal(render().activeSession!.courts[1].teamA.length, 0)
  render().endMatch('one', 21, 10)
  render().assignToCourt(roster.id, 'two')
  assert.equal(render().activeSession!.courts[1].teamA.length, 2)
})

test('Elo palette uses existing integer categories, fractional bands, and boundary colors', () => {
  const cases = [
    [-20, 'Newbie', 'skill-newbie', '#d1d5db'],
    [1, 'Newbie', 'skill-newbie', '#d1d5db'],
    [2, 'Beginner', 'skill-beginner', '#fde047'],
    [3.5, 'Low Intermediate', 'skill-low-intermediate', '#22c55e'],
    [4, 'Intermediate', 'skill-intermediate', '#3b82f6'],
    [4.5, 'Intermediate', 'skill-intermediate', '#3b82f6'],
    [5, 'High Intermediate', 'skill-high-intermediate', '#8b5cf6'],
    [6.5, 'Advanced', 'skill-advanced', '#ef4444'],
    [7, 'Elite', 'skill-elite', '#111827'],
    [100, 'Elite', 'skill-elite', '#111827'],
  ] as const
  for (const [rating, category, className, color] of cases) {
    assert.equal(getRatingCategory(rating), category)
    assert.equal(skillBorderClass(category), className)
    assert.equal(skillColor(category), color)
  }
})

test('Elo category, border and font color update immediately with completed wins and losses', () => {
  let render = setup(ids.slice(0, 4), { matchmakingMode: 'elo-smart-queue' })
  const appearance = (id: string) => {
    const state = render()
    const category = getSessionSkill(state.activeSession!, state.memberById[id])
    return [category, skillBorderClass(category), skillColor(category)]
  }
  assert.deepEqual(appearance('a'), ['Intermediate', 'skill-intermediate', '#3b82f6'])
  assert.equal(render().memberById.a.skill, 'Beginner')
  for (let i = 0; i < 2; i++) {
    const current = render().activeSession!
    render = setup(current.playingIds, { ...current, courts: [court('one', { teamA: ['a', 'b'], teamB: ['c', 'd'], startedAt })] })
    render().endMatch('one', 21, 10)
    assert.deepEqual(appearance('c'), ['Low Intermediate', 'skill-low-intermediate', '#22c55e'])
    assert.deepEqual(appearance('a'), i === 0
      ? ['Intermediate', 'skill-intermediate', '#3b82f6']
      : ['High Intermediate', 'skill-high-intermediate', '#8b5cf6'])
  }
  assert.equal(getSessionSkillLabel(render().activeSession!, render().memberById.a), 'Elo 5.0 · High Intermediate')
})

test('restoration and persisted page refresh derive colors from ratings without overwriting manual skills', async () => {
  const match = {
    id: 'color-result', courtLabel: 'one', teamA: ['a', 'b'], teamB: ['c', 'd'],
    scoreA: 21, scoreB: 10, result: 'teamA' as const, endedAt: startedAt, eloAdjustment: 0.5,
  }
  const render = setup(ids.slice(0, 4), {
    matchmakingMode: 'elo-smart-queue', history: [match], eloRatings: { a: 100, c: -100 },
  })
  const original = render().activeSession!
  const { saveState, loadState } = await import('../lib/storage.ts')
  let saved = ''
  Object.assign(storage, { setItem(_key: string, value: string) { saved = value } })
  saveState({ members: Object.values(render().memberById), sessions: [original], activeSessionId: original.id })
  mock.method(storage, 'getItem', () => saved)
  const restored = loadState()!.sessions[0]
  const reload = setup(restored.playingIds, restored)
  for (const id of ['a', 'c']) {
    const category = getSessionSkill(reload().activeSession!, reload().memberById[id])
    assert.equal(category, id === 'a' ? 'Intermediate' : 'Low Intermediate')
    assert.equal(skillColor(category), id === 'a' ? '#3b82f6' : '#22c55e')
    assert.equal(reload().memberById[id].skill, 'Beginner')
  }
})

test('Smart Queue keeps its manually assigned category, label and colors even with Elo fields', () => {
  const render = setup(ids.slice(0, 4), { matchmakingMode: 'smart-queue', eloRatings: { a: 6 } })
  const state = render()
  const category = getSessionSkill(state.activeSession!, state.memberById.a)
  assert.equal(category, 'Beginner')
  assert.equal(skillBorderClass(category), 'skill-beginner')
  assert.equal(skillColor(category), '#fde047')
  assert.equal(getSessionSkillLabel(state.activeSession!, state.memberById.a), 'Beginner')
})

for (const mode of ['smart-queue', 'elo-smart-queue'] as const) {
  test(`${mode} includes compatible late players before optimizing waiting scores`, () => {
    mock.method(Date, 'now', () => 100000)
    const render = setup(ids.slice(0, 5), {
      matchmakingMode: mode, priorityList: ['a', 'b'], playerList: ['c', 'd', 'e'],
      stats: Object.fromEntries(ids.map(id => [id, stats({ waitingSince: ['a', 'b'].includes(id) ? 99000 : 1000 })])),
    })
    render().generateRoster()
    const session = render().activeSession!
    assert.ok(session.rosters[0].playerIds.includes('a'))
    assert.ok(session.rosters[0].playerIds.includes('b'))
    assert.equal(session.stats.b.waitingSince, 99000)
    assert.deepEqual(session.priorityList, ['a', 'b'])
    const snapshot = session.scoringSnapshots![0]
    assert.ok('scoring' in snapshot)
    assert.equal(snapshot.scoring.layer, 1)
    assert.ok(snapshot.scoring.arrangements.every(({ teams }) => teams.flat().includes('b')))
  })

  test(`${mode} does not widen a successful layer to admit an incompatible late player`, () => {
    const history = mode === 'elo-smart-queue' ? Array.from({ length: 4 }, (_, i) => ({
      id: `wide-${i}`, courtLabel: 'one', teamA: ['b', 'f'], teamB: ['a', 'g'],
      scoreA: 21, scoreB: 10, result: 'teamA' as const, endedAt: startedAt, eloAdjustment: 0.5,
    })) : []
    const render = setup(ids.slice(0, 5), {
      matchmakingMode: mode, priorityList: ['a', 'b'], playerList: ['c', 'd', 'e'], history,
    })
    if (mode === 'smart-queue') render().editMember('b', 'b', 'Advanced')
    // In Elo, a=2 and b=6. Give regular candidates the same rating as the base.
    // Their rating of 4 fits layer 2, while b requires layer 5.
    render().toggleManualPick('a')
    render().generateRoster()
    const session = render().activeSession!
    assert.ok(session.rosters[0].playerIds.includes('a'))
    assert.ok(!session.rosters[0].playerIds.includes('b'))
    assert.ok(session.priorityList.includes('b'))
    const snapshot = session.scoringSnapshots![0]
    assert.ok('scoring' in snapshot)
    assert.equal(snapshot.scoring.layer, mode === 'smart-queue' ? 1 : 2)
  })
}

test('game scoring uses the selected Late Priority base and the same effective totals as eligibility', () => {
  const render = setup(ids.slice(0, 4), {
    priorityList: ['a'], playerList: ['b', 'c', 'd'],
    stats: {
      a: stats({ gamesPlayed: 1, missedGames: 4 }),
      b: stats({ gamesPlayed: 2, missedGames: 2 }),
      c: stats({ gamesPlayed: 3, missedGames: 1 }),
      d: stats({ gamesPlayed: 4 }),
    },
  })
  render().generateRoster()
  const snapshot = render().activeSession!.scoringSnapshots![0]
  assert.ok('scoring' in snapshot)
  assert.equal(snapshot.scoring.baseId, 'a')
  assert.equal(snapshot.scoring.players.a.totalGames, 5)
  assert.equal(snapshot.scoring.layer, 3)
  for (const { score } of snapshot.scoring.arrangements) {
    assert.equal(score.raw.gameDifferenceBaseId, 'a')
    assert.deepEqual(score.raw.gameDifferences, [1, 1, 1])
    assert.equal(score.normalized.game, 0.5)
  }
})
