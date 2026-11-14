import type { Court, PlayingNext, StackType, WinLoseStackState } from '../types/app'

export type StackRotationMatch = {
  playerIds: string[]
  playerSources: Record<string, StackType>
  complete: boolean
  playingNextAfter: PlayingNext
}

const opposite = (stack: PlayingNext): PlayingNext =>
  stack === 'winner' ? 'loser' : 'winner'

const stackKey = (stack: PlayingNext) =>
  stack === 'winner' ? 'winners' : 'losers'

/**
 * Builds a display-only FIFO projection. It never mutates the stored stacks.
 * `playingNext` is simulated locally so preview cards use the same turn
 * transitions as the next-match algorithm.
 */
export const buildStackRotation = (
  state: WinLoseStackState,
  allowFirstMatchBorrow = true,
): StackRotationMatch[] => {
  const reserved = new Set(state.manualMatches.flatMap((match) => match.playerIds))
  const lockedMatches = (state.returningMatches ?? []).map((match) => ({
    ...match,
    playerIds: match.playerIds.filter((id) => !reserved.has(id)),
    playerSources: { ...match.playerSources },
    complete: false,
  }))
  const lockedPlayers = new Set(lockedMatches.flatMap((match) => match.playerIds))
  const available = (id: string) => !reserved.has(id) && !lockedPlayers.has(id)
  const queues = {
    unplayed: state.unplayed.filter(available),
    winners: state.winners.filter(available),
    losers: state.losers.filter(available),
  }
  const matches: StackRotationMatch[] = []
  let simulatedPlayingNext = state.playingNext

  const take = (
    key: 'unplayed' | 'winners' | 'losers',
    source: StackType,
    count: number,
    playerIds: string[],
    playerSources: Record<string, StackType>,
  ) => {
    const selected = queues[key].splice(0, count)
    selected.forEach((id) => {
      playerIds.push(id)
      playerSources[id] = source
    })
  }

  const initialPlayerIds = new Set(state.initialPlayerIds)
  const initialUnplayed = queues.unplayed.filter((id) => initialPlayerIds.has(id))
  const lateUnplayed = queues.unplayed.filter((id) => !initialPlayerIds.has(id))

  const fillLockedMatch = (match: (typeof lockedMatches)[number]) => {
    const { playerIds, playerSources } = match
    const source = playerIds.map((id) => playerSources[id]).find((item) => item !== 'returning')
    const wasIncomplete = playerIds.length < 4
    if (source === 'unplayed') {
      const firstUnplayed = playerIds.find((id) => playerSources[id] === 'unplayed')!
      const queue = initialPlayerIds.has(firstUnplayed) ? initialUnplayed : lateUnplayed
      for (const id of queue.splice(0, 4 - playerIds.length)) {
        playerIds.push(id)
        playerSources[id] = 'unplayed'
      }
    } else if (source && playerIds.length < 4) {
      take(stackKey(source), source, 4 - playerIds.length, playerIds, playerSources)
    }
    if (match.index === 0 && allowFirstMatchBorrow && playerIds.length < 4) {
      take(stackKey(state.playingNext), state.playingNext, 4 - playerIds.length, playerIds, playerSources)
      const other = opposite(state.playingNext)
      take(stackKey(other), other, 4 - playerIds.length, playerIds, playerSources)
    }
    match.complete = playerIds.length === 4
    if (wasIncomplete && match.complete && (source === 'winner' || source === 'loser')) {
      match.playingNextAfter = opposite(source)
    }
  }

  const appendLockedMatches = (appendRemaining = false) => {
    const previousCount = matches.length
    while (lockedMatches.length && (appendRemaining || lockedMatches[0].index <= matches.length)) {
      const match = lockedMatches.shift()!
      fillLockedMatch(match)
      matches.push(match)
      if (match.complete) simulatedPlayingNext = match.playingNextAfter
    }
    return matches.length > previousCount
  }

  // Initial-player and late-arrival Unplayed queues are intentionally separate.
  // A late arrival must not displace the initial roster's final calibration
  // group after that group has been filled from the result stack.
  const appendUnplayedGroups = (unplayed: string[], isInitialRoster: boolean) => {
    while (unplayed.length) {
    appendLockedMatches()
    if (!unplayed.length) break
    const playerIds: string[] = []
    const playerSources: Record<string, StackType> = {}
      const unplayedCount = Math.min(4, unplayed.length)
      const selected = unplayed.splice(0, unplayedCount)
      selected.forEach((id) => {
        playerIds.push(id)
        playerSources[id] = 'unplayed'
      })
    const isFinalInitialCalibrationGroup =
      isInitialRoster &&
      !state.calibrationComplete &&
      unplayedCount < 4 &&
      playerIds.every((id) => initialPlayerIds.has(id))
      // Every excess Unplayed group is completed from the active result turn
      // when enough players are available. This keeps it at its FIFO position.
      const shouldBorrow = unplayedCount < 4

    if (shouldBorrow) {
      const primary = stackKey(simulatedPlayingNext)
      const secondary = stackKey(opposite(simulatedPlayingNext))
      take(primary, simulatedPlayingNext, 4 - playerIds.length, playerIds, playerSources)
      take(secondary, opposite(simulatedPlayingNext), 4 - playerIds.length, playerIds, playerSources)
    }

    const complete = playerIds.length === 4
    const allUnplayed = Object.values(playerSources).every((source) => source === 'unplayed')
    const borrowedCount = playerIds.length - unplayedCount
    // A single borrowed player keeps the calibration exemption. Borrowing two
    // or three players consumes the Winner/Loser turn as requested.
    const isSinglePlayerCalibrationExemption =
      isFinalInitialCalibrationGroup && borrowedCount === 1
    const playingNextAfter =
      complete && !allUnplayed && !isSinglePlayerCalibrationExemption
        ? opposite(simulatedPlayingNext)
        : simulatedPlayingNext
    matches.push({ playerIds, playerSources, complete, playingNextAfter })
    simulatedPlayingNext = playingNextAfter
    }
  }

  appendUnplayedGroups(initialUnplayed, true)
  appendUnplayedGroups(lateUnplayed, false)

  // Every complete result-stack card consumes the simulated turn. Incomplete
  // cards are shown as-is and never borrow players from another stack.
  while (queues.winners.length || queues.losers.length) {
    appendLockedMatches()
    const currentKey = stackKey(simulatedPlayingNext)
    const current = queues[currentKey]
    if (allowFirstMatchBorrow && matches.length === 0 && current.length < 4) {
      const playerIds: string[] = []
      const playerSources: Record<string, StackType> = {}
      take(currentKey, simulatedPlayingNext, 4, playerIds, playerSources)
      const other = opposite(simulatedPlayingNext)
      take(stackKey(other), other, 4 - playerIds.length, playerIds, playerSources)
      matches.push({
        playerIds,
        playerSources,
        complete: playerIds.length === 4,
        playingNextAfter: playerIds.length === 4
          ? opposite(simulatedPlayingNext)
          : simulatedPlayingNext,
      })
      if (playerIds.length === 4) simulatedPlayingNext = opposite(simulatedPlayingNext)
      continue
    }
    if (current.length >= 4) {
      const playerIds = current.splice(0, 4)
      matches.push({
        playerIds,
        playerSources: Object.fromEntries(playerIds.map((id) => [id, simulatedPlayingNext])),
        complete: true,
        playingNextAfter: opposite(simulatedPlayingNext),
      })
      simulatedPlayingNext = opposite(simulatedPlayingNext)
      continue
    }

    // Preserve a short future group without borrowing. If the other stack has
    // a complete group, continue simulating it rather than hiding it behind an
    // incomplete placeholder.
    if (current.length) {
      const playerIds = current.splice(0, 4)
      matches.push({
        playerIds,
        playerSources: Object.fromEntries(playerIds.map((id) => [id, simulatedPlayingNext])),
        complete: false,
        playingNextAfter: simulatedPlayingNext,
      })
    }
    if (appendLockedMatches()) continue
    const other = opposite(simulatedPlayingNext)
    const otherKey = stackKey(other)
    if (queues[otherKey].length >= 4) {
      simulatedPlayingNext = other
      continue
    }
    if (queues[otherKey].length) {
      const playerIds = queues[otherKey].splice(0, 4)
      matches.push({
        playerIds,
        playerSources: Object.fromEntries(playerIds.map((id) => [id, other])),
        complete: false,
        playingNextAfter: simulatedPlayingNext,
      })
    }
    break
  }
  appendLockedMatches(true)
  const returning = (state.returning ?? []).filter(available)
  const fillReturningSlots = (match: StackRotationMatch) => {
    for (const id of returning.splice(0, 4 - match.playerIds.length)) {
      match.playerIds.push(id)
      match.playerSources[id] = 'returning'
    }
    match.complete = match.playerIds.length === 4
  }

  // Fill gaps after projecting the regular stacks so existing players keep
  // their positions when someone returns from a break.
  for (const match of matches) {
    if (match.complete || !returning.length) continue
    const sources = Object.values(match.playerSources)
    fillReturningSlots(match)
    if (match.complete && sources.every((source) => source === 'winner' || source === 'loser')) {
      const source = sources[0]
      if (source === 'winner' || source === 'loser') {
        match.playingNextAfter = opposite(source)
      }
    }
  }
  while (returning.length) {
    const match: StackRotationMatch = {
      playerIds: [],
      playerSources: {},
      complete: false,
      playingNextAfter: simulatedPlayingNext,
    }
    fillReturningSlots(match)
    matches.push(match)
  }
  return matches
}

export const lockReturningMatches = (
  state: WinLoseStackState,
  courts: readonly Pick<Court, 'teamA' | 'teamB'>[],
): WinLoseStackState => {
  const locks = state.returningMatches ?? []
  const locked = new Set(locks.flatMap((match) => match.playerIds))
  if (!state.returning?.some((id) => !locked.has(id))) return state

  const hasVacantCourt = courts.some((court) => !court.teamA.length && !court.teamB.length)
  const returningMatches = buildStackRotation(state, hasVacantCourt).flatMap((match, index) =>
    match.playerIds.some((id) => match.playerSources[id] === 'returning')
      ? [{
          index,
          playerIds: match.playerIds,
          playerSources: match.playerSources,
          playingNextAfter: match.playingNextAfter,
        }]
      : [],
  )
  return { ...state, returningMatches }
}

export const removePlayersFromStacks = (
  state: WinLoseStackState,
  playerIds: string[],
): WinLoseStackState => {
  const removed = new Set(playerIds)
  return {
    ...state,
    unplayed: state.unplayed.filter((id) => !removed.has(id)),
    winners: state.winners.filter((id) => !removed.has(id)),
    losers: state.losers.filter((id) => !removed.has(id)),
    returning: (state.returning ?? []).filter((id) => !removed.has(id)),
    returningMatches: state.returningMatches?.flatMap((match) => {
      const playerIds = match.playerIds.filter((id) => !removed.has(id))
      if (!playerIds.some((id) => match.playerSources[id] === 'returning')) return []
      const playerSources = Object.fromEntries(playerIds.map((id) => [id, match.playerSources[id]]))
      return [{ ...match, playerIds, playerSources }]
    }),
    prioritizedPlayerIds: state.prioritizedPlayerIds?.some((id) => removed.has(id))
      ? undefined
      : state.prioritizedPlayerIds,
  }
}

export type UpcomingStackMatch = StackRotationMatch & { id?: string; manual?: boolean }

export const buildUpcomingStackMatches = (
  state: WinLoseStackState,
  courts?: readonly Pick<Court, 'teamA' | 'teamB'>[],
): UpcomingStackMatch[] => {
  const hasVacantCourt = courts?.some((court) => !court.teamA.length && !court.teamB.length)
  const matches: UpcomingStackMatch[] = [
    ...buildStackRotation(state, hasVacantCourt),
    ...state.manualMatches.map((match) => ({
      ...match,
      complete: true,
      playingNextAfter: state.playingNext,
      manual: true,
    })),
  ]
  const prioritized = state.prioritizedPlayerIds
  if (!prioritized?.length) return matches

  const index = matches.findIndex((match) =>
    prioritized.every((id) => match.playerIds.includes(id)),
  )
  if (index > 0) {
    const [match] = matches.splice(index, 1)
    matches.unshift(match)
  }
  return matches
}

export const skipNextStackPlayer = (
  state: WinLoseStackState,
  playerId: string,
  courts?: readonly Pick<Court, 'teamA' | 'teamB'>[],
): WinLoseStackState | undefined => {
  const [next, ...upcoming] = buildUpcomingStackMatches(state, courts)
  if (!next?.complete || !next.playerIds.includes(playerId)) return

  const source = next.playerSources[playerId]
  const replacementId = upcoming
    .filter((match) => !match.manual)
    .flatMap((match) => match.playerIds.filter((id) => match.playerSources[id] === source))[0]
  if (!replacementId) return

  const key = source === 'unplayed' || source === 'returning' ? source : stackKey(source)
  const queue = state[key] ?? []
  const swap = (id: string) => id === playerId ? replacementId : id === replacementId ? playerId : id

  return {
    ...state,
    [key]: queue.map(swap),
    returningMatches: state.returningMatches?.map((match) => ({
      ...match,
      playerIds: match.playerIds.map(swap),
      playerSources: Object.fromEntries(Object.entries(match.playerSources).map(([id, type]) => [swap(id), type])),
    })),
    prioritizedPlayerIds: state.prioritizedPlayerIds?.map(swap),
    manualMatches: state.manualMatches.map((match) => {
      if (match.id !== next.id) return match
      const playerIds = match.playerIds.map(swap)
      const playerSources = { ...match.playerSources }
      delete playerSources[playerId]
      playerSources[replacementId] = source
      return { ...match, playerIds, playerSources }
    }),
  }
}


export const appendResultToStacks = (
  state: WinLoseStackState,
  winners: string[],
  losers: string[],
): WinLoseStackState => {
  const cleared = removePlayersFromStacks(state, [...winners, ...losers])
  return {
    ...cleared,
    winners: [...cleared.winners, ...winners],
    losers: [...cleared.losers, ...losers],
  }
}

export const restorePlayersToStacks = (
  state: WinLoseStackState,
  playerSources: Record<string, StackType>,
): WinLoseStackState => {
  const cleared = removePlayersFromStacks(state, Object.keys(playerSources))
  return Object.entries(playerSources).reduce((next, [playerId, source]) => ({
    ...next,
    unplayed: source === 'unplayed' ? [...next.unplayed, playerId] : next.unplayed,
    winners: source === 'winner' ? [...next.winners, playerId] : next.winners,
    losers: source === 'loser' ? [...next.losers, playerId] : next.losers,
    returning: source === 'returning' ? [...(next.returning ?? []), playerId] : next.returning,
  }), cleared)
}
