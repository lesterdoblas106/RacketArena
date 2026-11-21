import { isSmartQueueMode } from './eloRatings'
import type { Court, MatchWaitingRecord, MemberStats, Session } from '../types/app'

export function getTotalGames(stats: MemberStats) {
  return stats.gamesPlayed + stats.missedGames
}

export function getAdditionalMissedGames(session: Session, member: MemberStats) {
  const inGame = new Set(session.courts.flatMap((court) => [...court.teamA, ...court.teamB]))
  const present = session.playingIds
    .filter((id) => isSmartQueueMode(session.matchmakingMode) || !session.priorityList.includes(id))
    // An active match already gives this player a turn, even before it finishes.
    .map((id) => getTotalGames(session.stats[id]) + (inGame.has(id) ? 1 : 0))
  return present.length ? Math.max(0, Math.min(...present) - getTotalGames(member)) : 0
}

export function getCurrentBenchWait(session: Session, id: string, now: number, inGame: boolean) {
  if (!session.startedAt || inGame) return 0
  const since = session.stats[id].waitingSince ?? session.startedAt
  return Math.max(0, (session.endedAt ?? now) - since)
}

export function getCourtWaitingRecords(
  session: Session, playerIds: readonly string[], startedAt: number,
): MatchWaitingRecord[] {
  return playerIds.map((memberId) => {
    const stats = session.stats[memberId]
    const waitingStartedAt = stats.waitingSince ?? startedAt
    return {
      memberId,
      waitingStartedAt,
      matchStartedAt: startedAt,
      waitingMs: Math.max(0, startedAt - waitingStartedAt),
      gameNumber: stats.gamesPlayed + 1,
    }
  })
}

export function recordBenchWaits(session: Session, waitingRecords: readonly MatchWaitingRecord[]) {
  const stats = { ...session.stats }
  for (const { memberId, waitingMs } of waitingRecords) {
    const previous = stats[memberId]
    const totalWaitMs = (previous.totalWaitMs ?? 0) + waitingMs
    const waitPeriods = (previous.waitPeriods ?? 0) + 1
    stats[memberId] = { ...previous, totalWaitMs, waitPeriods, averageWaitMs: totalWaitMs / waitPeriods }
  }
  return stats
}

export function clearLatePriority(session: Session, startingPlayers: readonly string[]) {
  const removed = session.priorityList.filter((id) => startingPlayers.includes(id))
  return {
    priorityList: session.priorityList.filter((id) => !startingPlayers.includes(id)),
    playerList: [...new Set([...session.playerList, ...removed])],
  }
}

export function snapshotCourtWaiting(session: Session, playerIds: readonly string[]): Court['preMatchWaiting'] {
  return Object.fromEntries(playerIds.map((id) => {
    const { waitingSince, totalWaitMs, waitPeriods, averageWaitMs } = session.stats[id]
    return [id, { waitingSince, totalWaitMs, waitPeriods, averageWaitMs, latePriority: session.priorityList.includes(id) }]
  }))
}

export function rollbackCourtWaiting(session: Session, court: Court) {
  const stats = { ...session.stats }
  const restoredPriority: string[] = []
  for (const id of [...court.teamA, ...court.teamB]) {
    if (!stats[id]) continue
    const snapshot = court.preMatchWaiting?.[id]
    if (snapshot) {
      const { latePriority, ...waiting } = snapshot
      stats[id] = { ...stats[id], ...waiting }
      if (latePriority && session.playingIds.includes(id)) restoredPriority.push(id)
    } else {
      // Older matches have no reliable pre-dispatch totals. Preserve those totals
      // and resume the known waiting interval without inventing past averages.
      const record = court.waitingRecords?.find((item) => item.memberId === id)
      if (record) stats[id] = { ...stats[id], waitingSince: record.waitingStartedAt }
    }
  }
  return {
    stats,
    priorityList: [...new Set([...session.priorityList, ...restoredPriority])],
    playerList: session.playerList.filter((id) => !restoredPriority.includes(id)),
  }
}

export function isCourtLineupAvailable(session: Session, playerIds: readonly string[]) {
  return playerIds.length === 4 && new Set(playerIds).size === 4
    && playerIds.every((id) => session.playingIds.includes(id))
    && session.courts.every(({ teamA, teamB }) =>
      [...teamA, ...teamB].every((id) => !playerIds.includes(id)),
    )
}

export function getFinishedCourtWait(session: Session, court: Court, finishedAt: number) {
  const players = [...court.teamA, ...court.teamB]
  // Active courts saved before wait tracking at dispatch still need to count their interval.
  const waitingRecords = court.waitingRecords ?? getCourtWaitingRecords(session, players, court.startedAt ?? finishedAt)
  const stats = court.waitingRecords ? { ...session.stats } : recordBenchWaits(session, waitingRecords)
  for (const id of players) stats[id] = { ...stats[id], waitingSince: finishedAt }
  return { stats, waitingRecords }
}
