import type { Court, MatchWaitingRecord, MemberStats, Session } from '../types/app'

export function getTotalGames(stats: MemberStats) {
  return stats.gamesPlayed + stats.missedGames
}

export function getAdditionalMissedGames(session: Session, member: MemberStats) {
  const present = session.playingIds
    .filter((id) => session.matchmakingMode === 'smart-queue' || !session.priorityList.includes(id))
    .map((id) => getTotalGames(session.stats[id]))
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
