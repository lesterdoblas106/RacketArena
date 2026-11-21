import { skillOrder, type MatchHistory, type MatchmakingMode, type Member, type Session } from '../types/app'

export const eloStartingRating = 4
export const eloRatingAdjustment = 0.5

export const isSmartQueueMode = (mode: MatchmakingMode) =>
  mode === 'smart-queue' || mode === 'elo-smart-queue'

export const getEloRating = (session: Session, id: string) =>
  session.eloRatings?.[id] ?? eloStartingRating

export const getQueueSkill = (session: Session, member: Member) =>
  session.matchmakingMode === 'elo-smart-queue'
    ? getEloRating(session, member.id)
    : skillOrder.indexOf(member.skill) + 1

// Results are the ledger. Rebuilding instead of incrementing makes corrections,
// repeated saves, and restored sessions idempotent. Each result retains its step
// so a future configuration change cannot alter historical adjustments.
export function calculateEloRatings(ids: readonly string[], history: readonly MatchHistory[]) {
  const ratings = Object.fromEntries(ids.map((id) => [id, eloStartingRating]))
  const seen = new Set<string>()
  for (const match of history) {
    if (seen.has(match.id)) continue
    seen.add(match.id)
    if (match.eloAdjustment === undefined || match.result === 'draw') continue
    for (const [team, players] of [['teamA', match.teamA], ['teamB', match.teamB]] as const) {
      for (const id of new Set(players)) {
        ratings[id] = (ratings[id] ?? eloStartingRating)
          + (match.result === team ? match.eloAdjustment : -match.eloAdjustment)
      }
    }
  }
  return ratings
}

export function reconcileEloRatings(session: Session): Session {
  if (session.matchmakingMode !== 'elo-smart-queue') return session
  return {
    ...session,
    eloRatings: calculateEloRatings(
      [...new Set([...Object.keys(session.stats), ...Object.keys(session.eloRatings ?? {})])],
      session.history,
    ),
  }
}
