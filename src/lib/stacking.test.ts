import assert from 'node:assert/strict'
import test from 'node:test'
import { appendResultToStacks, buildStackRotation, buildUpcomingStackMatches, lockReturningMatches, removePlayersFromStacks, skipNextStackPlayer } from './stacking'
import type { WinLoseStackState } from '../types/app'

const state = (overrides: Partial<WinLoseStackState> = {}): WinLoseStackState => ({
  unplayed: [], winners: [], losers: [], playingNext: 'winner', initialPlayerIds: [], calibrationComplete: false, manualMatches: [], ...overrides,
  teamRotation: overrides.teamRotation ?? 0,
})

test('a returning player fills the first open slot without moving waiting players', () => {
  const [first, second, third] = buildStackRotation(state({
    playingNext: 'loser',
    winners: ['w1', 'w2', 'w3'],
    losers: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'],
    returning: ['jake'],
  }))
  assert.deepEqual(first.playerIds, ['l1', 'l2', 'l3', 'l4'])
  assert.deepEqual(second.playerIds, ['w1', 'w2', 'w3', 'jake'])
  assert.equal(second.playerSources.jake, 'returning')
  assert.equal(second.complete, true)
  assert.deepEqual(third.playerIds, ['l5', 'l6'])
})

test('keeps a returning player in Match 1 when new winners become available', () => {
  const winners = ['Kimberly', 'Elea', 'Corrine']
  const stack = lockReturningMatches(state({
    winners,
    losers: ['JamesDw'],
    returning: ['Giulia'],
  }), [{ teamA: ['Marc', 'Blanche'], teamB: ['ChanRC', 'David'] }])
  const updated = appendResultToStacks(stack, ['Marc', 'Blanche'], ['ChanRC', 'David'])
  const matches = buildUpcomingStackMatches(updated, [{ teamA: [], teamB: [] }])
  assert.deepEqual(matches[0].playerIds, [...winners, 'Giulia'])
  assert.equal(matches.flatMap((match) => match.playerIds).filter((id) => id === 'Giulia').length, 1)
  assert.ok(matches.slice(1).some((match) => match.playerIds.includes('Marc')))
})

test('prioritizes an upcoming card while preserving the order of the remaining cards', () => {
  const prioritizedPlayerIds = ['l1', 'l2', 'l3']
  const stack = state({
    winners: ['w1', 'w2', 'w3', 'w4'],
    losers: prioritizedPlayerIds,
    returning: ['jake'],
    prioritizedPlayerIds,
  })
  const [next, following] = buildUpcomingStackMatches(stack)
  assert.deepEqual(next.playerIds, [...prioritizedPlayerIds, 'jake'])
  assert.equal(next.complete, true)
  assert.deepEqual(following.playerIds, stack.winners)
  assert.equal(removePlayersFromStacks(stack, next.playerIds).prioritizedPlayerIds, undefined)
})

test('skips the next player by swapping with the first later player from their stack', () => {
  const stack = state({
    playingNext: 'loser',
    losers: ['Andrea', 'Elea', 'JamesDw', 'Corrine', 'Aileen', 'JedoyRC', 'KingLala'],
    winners: ['ChanRC', 'Marc', 'David', 'Blanche'],
    returning: ['Giulia'],
  })
  const updated = skipNextStackPlayer(stack, 'Andrea')
  assert.ok(updated)
  assert.deepEqual(buildUpcomingStackMatches(updated).map((match) => match.playerIds), [
    ['Aileen', 'Elea', 'JamesDw', 'Corrine'],
    stack.winners,
    ['Andrea', 'JedoyRC', 'KingLala', 'Giulia'],
  ])
})

test('waits for a vacant court before borrowing from the opposite result stack', () => {
  const stack = state({ winners: ['w1', 'w2', 'w3'], losers: ['l1', 'l2', 'l3', 'l4'] })
  const occupied = [{ teamA: ['a1', 'a2'], teamB: ['b1', 'b2'] }]
  const [waiting, following] = buildUpcomingStackMatches(stack, occupied)
  assert.deepEqual(waiting.playerIds, stack.winners)
  assert.equal(waiting.complete, false)
  assert.deepEqual(following.playerIds, stack.losers)

  const [ready] = buildUpcomingStackMatches(stack, [{ teamA: [], teamB: [] }])
  assert.deepEqual(ready.playerIds, [...stack.winners, 'l1'])
  assert.equal(ready.complete, true)
})

test('uses four unplayed players FIFO without toggling Playing Next', () => {
  const [match] = buildStackRotation(state({ unplayed: ['u1', 'u2', 'u3', 'u4', 'u5'] }))
  assert.deepEqual(match.playerIds, ['u1', 'u2', 'u3', 'u4'])
  assert.equal(match.playingNextAfter, 'winner')
})

test('fills partial unplayed groups from Playing Next and toggles', () => {
  const [match] = buildStackRotation(state({ unplayed: ['u1'], winners: ['w1', 'w2', 'w3', 'w4'], losers: ['l1'] }))
  assert.deepEqual(match.playerIds, ['u1', 'w1', 'w2', 'w3'])
  assert.equal(match.playingNextAfter, 'loser')
})

test('falls back to the opposite result stack FIFO', () => {
  const [match] = buildStackRotation(state({ winners: ['w1', 'w2'], losers: ['l1', 'l2', 'l3', 'l4'] }))
  assert.deepEqual(match.playerIds, ['w1', 'w2', 'l1', 'l2'])
  assert.equal(match.playingNextAfter, 'loser')
})

test('late arrivals alternate the result stack used for partial groups', () => {
  const matches = buildStackRotation(state({ unplayed: ['late1', 'late2'], winners: ['w1', 'w2', 'w3'], losers: ['l1', 'l2', 'l3'] }))
  assert.deepEqual(matches[0].playerIds, ['late1', 'late2', 'w1', 'w2'])
  assert.equal(matches[0].playingNextAfter, 'loser')
})

test('result assignment replaces old classifications and preserves append order', () => {
  const updated = appendResultToStacks(state({ winners: ['w0'], losers: ['l0', 'p1'] }), ['p1', 'p2'], ['p3', 'p4'])
  assert.deepEqual(updated.winners, ['w0', 'p1', 'p2'])
  assert.deepEqual(updated.losers, ['l0', 'p3', 'p4'])
})

test('manual reservation removal compacts the source queues without duplicates', () => {
  const updated = removePlayersFromStacks(state({ winners: ['w4', 'w5', 'w6', 'w7', 'w8', 'w9'] }), ['w4', 'w6', 'w8'])
  assert.deepEqual(updated.winners, ['w5', 'w7', 'w9'])
})

test('future incomplete groups remain natural to their own stack', () => {
  const matches = buildStackRotation(state({
    playingNext: 'loser',
    losers: ['l1', 'l2', 'l3', 'l4', 'l5'],
    winners: ['w1', 'w2', 'w3', 'w4'],
  }))
  assert.deepEqual(matches.map((match) => match.playerIds), [
    ['l1', 'l2', 'l3', 'l4'],
    ['w1', 'w2', 'w3', 'w4'],
    ['l5'],
  ])
})

test('an incomplete active result stack stays before a complete opposite stack', () => {
  const matches = buildStackRotation(state({
    unplayed: ['u1', 'u2', 'u3', 'u4'],
    winners: ['w1'],
    losers: ['l1', 'l2', 'l3', 'l4'],
  }))
  assert.deepEqual(matches.map((match) => match.playerIds), [
    ['u1', 'u2', 'u3', 'u4'],
    ['w1'],
    ['l1', 'l2', 'l3', 'l4'],
  ])
})

test('only the actual next match borrows from the opposite stack', () => {
  const matches = buildStackRotation(state({
    playingNext: 'loser',
    losers: ['l1', 'l2', 'l3', 'l4', 'l5'],
    winners: ['w1', 'w2', 'w3', 'w4'],
  }))
  assert.deepEqual(matches[0].playerIds, ['l1', 'l2', 'l3', 'l4'])
  assert.deepEqual(matches[2].playerIds, ['l5'])
})

test('16 initial players form calibration groups without changing Playing Next', () => {
  const initialPlayerIds = Array.from({ length: 16 }, (_, index) => `u${index + 1}`)
  const [match] = buildStackRotation(state({ initialPlayerIds, unplayed: initialPlayerIds }))
  assert.deepEqual(match.playerIds, ['u1', 'u2', 'u3', 'u4'])
  assert.equal(match.playingNextAfter, 'winner')
})

test('15 initial players borrowing one Winner preserve Playing Next during calibration', () => {
  const [match] = buildStackRotation(state({
    initialPlayerIds: Array.from({ length: 15 }, (_, index) => `u${index + 1}`),
    unplayed: ['u13', 'u14', 'u15'],
    winners: ['w1'],
  }))
  assert.deepEqual(match.playerIds, ['u13', 'u14', 'u15', 'w1'])
  assert.equal(match.playingNextAfter, 'winner')
})

test('14 initial players borrowing two Winners consume Playing Next during calibration', () => {
  const [match] = buildStackRotation(state({
    initialPlayerIds: Array.from({ length: 14 }, (_, index) => `u${index + 1}`),
    unplayed: ['u13', 'u14'],
    winners: ['w1', 'w2'],
  }))
  assert.deepEqual(match.playerIds, ['u13', 'u14', 'w1', 'w2'])
  assert.equal(match.playingNextAfter, 'loser')
})

test('13 initial players borrowing three Winners consume Playing Next during calibration', () => {
  const [match] = buildStackRotation(state({
    initialPlayerIds: Array.from({ length: 13 }, (_, index) => `u${index + 1}`),
    unplayed: ['u13'],
    winners: ['w1', 'w2', 'w3'],
  }))
  assert.deepEqual(match.playerIds, ['u13', 'w1', 'w2', 'w3'])
  assert.equal(match.playingNextAfter, 'loser')
})

test('late Unplayed players consume Playing Next after calibration is complete', () => {
  const [match] = buildStackRotation(state({
    initialPlayerIds: ['u1', 'u2', 'u3', 'u4'],
    calibrationComplete: true,
    unplayed: ['late1'],
    winners: ['w1', 'w2', 'w3'],
  }))
  assert.deepEqual(match.playerIds, ['late1', 'w1', 'w2', 'w3'])
  assert.equal(match.playingNextAfter, 'loser')
})

test('persisted calibration state continues to exempt the final initial group', () => {
  const persisted = JSON.parse(JSON.stringify(state({
    initialPlayerIds: Array.from({ length: 15 }, (_, index) => `u${index + 1}`),
    calibrationComplete: false,
    unplayed: ['u13', 'u14', 'u15'],
    winners: ['w1'],
  }))) as WinLoseStackState
  const [match] = buildStackRotation(persisted)
  assert.equal(persisted.calibrationComplete, false)
  assert.equal(match.playingNextAfter, 'winner')
})

test('calibration preview keeps the partial Unplayed group in place and toggles after two borrowed Winners', () => {
  const matches = buildStackRotation(state({
    initialPlayerIds: ['u1', 'u2'],
    unplayed: ['u1', 'u2'],
    winners: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
    losers: ['l1', 'l2', 'l3', 'l4'],
  }))
  assert.deepEqual(matches.map((match) => match.playerIds), [
    ['u1', 'u2', 'w1', 'w2'],
    ['l1', 'l2', 'l3', 'l4'],
    ['w3', 'w4', 'w5', 'w6'],
  ])
  assert.equal(matches[0].playingNextAfter, 'loser')
})

test('final calibration Unplayed players stay after their prior full Unplayed group', () => {
  const matches = buildStackRotation(state({
    initialPlayerIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
    unplayed: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
    winners: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
    losers: ['l1', 'l2', 'l3', 'l4'],
  }))
  assert.deepEqual(matches.map((match) => match.playerIds), [
    ['u1', 'u2', 'u3', 'u4'],
    ['u5', 'u6', 'w1', 'w2'],
    ['l1', 'l2', 'l3', 'l4'],
    ['w3', 'w4', 'w5', 'w6'],
  ])
  assert.equal(matches[1].playingNextAfter, 'loser')
})

test('late arrivals do not displace an initial partial Unplayed calibration group', () => {
  const matches = buildStackRotation(state({
    initialPlayerIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
    unplayed: ['u1', 'u2', 'u3', 'u4', 'u5', 'late1', 'late2', 'late3'],
    winners: ['w1', 'w2', 'w3', 'w4'],
    losers: ['l1', 'l2', 'l3', 'l4'],
  }))
  assert.deepEqual(matches[0].playerIds, ['u1', 'u2', 'u3', 'u4'])
  assert.deepEqual(matches[1].playerIds, ['u5', 'w1', 'w2', 'w3'])
  assert.equal(matches[1].playingNextAfter, 'loser')
  assert.deepEqual(matches[2].playerIds, ['late1', 'late2', 'late3', 'l1'])
})

test('an arrival during calibration remains in the calibration Unplayed order', () => {
  const matches = buildStackRotation(state({
    initialPlayerIds: ['u1', 'u2', 'u3', 'u4', 'earlyArrival'],
    unplayed: ['u1', 'u2', 'u3', 'u4', 'earlyArrival', 'late1', 'late2', 'late3'],
    winners: ['w1', 'w2', 'w3', 'w4'],
    losers: ['l1', 'l2', 'l3', 'l4'],
  }))
  assert.deepEqual(matches[1].playerIds, ['earlyArrival', 'w1', 'w2', 'w3'])
  assert.deepEqual(matches[2].playerIds, ['late1', 'late2', 'late3', 'l1'])
})

test('one borrowed Winner keeps the calibration Winner turn', () => {
  const matches = buildStackRotation(state({
    initialPlayerIds: ['u1', 'u2', 'u3'],
    unplayed: ['u1', 'u2', 'u3'],
    winners: ['w1', 'w2', 'w3', 'w4', 'w5'],
    losers: ['l1', 'l2', 'l3', 'l4'],
  }))
  assert.equal(matches[0].playingNextAfter, 'winner')
  assert.deepEqual(matches[1].playerIds, ['w2', 'w3', 'w4', 'w5'])
})

test('late-player preview consumes Winners and then previews Losers', () => {
  const matches = buildStackRotation(state({
    calibrationComplete: true,
    unplayed: ['late1'],
    winners: ['w1', 'w2', 'w3'],
    losers: ['l1', 'l2', 'l3', 'l4'],
  }))
  assert.deepEqual(matches.map((match) => match.playerIds), [
    ['late1', 'w1', 'w2', 'w3'],
    ['l1', 'l2', 'l3', 'l4'],
  ])
  assert.equal(matches[0].playingNextAfter, 'loser')
})

test('preview after an exempt one-Winner calibration match matches the next generated match', () => {
  const initial = state({
    initialPlayerIds: ['u1', 'u2', 'u3'],
    unplayed: ['u1', 'u2', 'u3'],
    winners: ['w1', 'w2', 'w3', 'w4', 'w5'],
    losers: ['l1', 'l2', 'l3', 'l4'],
  })
  const preview = buildStackRotation(initial)
  const afterFirst = removePlayersFromStacks(initial, preview[0].playerIds)
  afterFirst.playingNext = preview[0].playingNextAfter
  assert.deepEqual(buildStackRotation(afterFirst)[0].playerIds, preview[1].playerIds)
  assert.equal(afterFirst.playingNext, 'winner')
})
