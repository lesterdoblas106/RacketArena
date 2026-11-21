import type { compatibilityLayers, LayerAttempt, SmartQueueCandidate } from './smartQueueCandidates'
import type { Doubles, scoreSmartQueueArrangement, smartQueueFormula } from './smartQueueScoring'

export type ScoringPlayer = SmartQueueCandidate & {
  name: string
  gamesPlayed: number
  missedGames: number
  currentWait: number
  averageWait: number
}

export type ScoredArrangement = {
  teams: Doubles<string>
  score: ReturnType<typeof scoreSmartQueueArrangement>
}

export type ScoringSearch = {
  label: string
  players: Record<string, ScoringPlayer>
  orderedIds: string[]
  excluded: { name: string; reason: string }[]
  layers: LayerAttempt[]
}

export type AutomaticScoring = {
  players: Record<string, ScoringPlayer>
  searches: ScoringSearch[]
  thresholds: typeof compatibilityLayers
  formula: typeof smartQueueFormula
  baseId: string
  preferredBaseId?: string
  layer: number
  arrangements: ScoredArrangement[]
  winnerIndex: number
  reason: string
}

export type ScoringSnapshot = {
  id: string
  createdAt: string
  playerNames: string[]
} & ({ scoring: AutomaticScoring } | { manualReason: string })

export const scoringHistoryLimit = 20

/** Read stored scores without recalculating snapshots created by earlier formulas. */
export function getGameDifferenceBreakdown(data: AutomaticScoring, arrangement: ScoredArrangement) {
  const { raw, normalized, weighted } = arrangement.score
  const players = arrangement.teams.flat().map((id) => data.players[id])
  const base = raw.gameDifferenceBaseId ? data.players[raw.gameDifferenceBaseId] : undefined
  const label = (player: ScoringPlayer) => `${player.name} (${player.totalGames} total games)`
  const labels = base
    ? players.filter(({ id }) => id !== base.id).map((player) => `|${label(base)} − ${label(player)}|`)
    : players.flatMap((a, index) => players.slice(index + 1).map((b) => `${label(a)} / ${label(b)}`))
  return {
    base, labels, differences: raw.gameDifferences,
    sum: raw.gameDifferences.reduce((total, value) => total + value, 0),
    divisor: raw.gameDifferences.length,
    average: raw.averageGameDifference,
    normalized: normalized.game,
    contribution: 100 * weighted.game,
  }
}

export function rankArrangements(arrangements: readonly ScoredArrangement[]) {
  return arrangements.map((arrangement, index) => ({ ...arrangement, index }))
    .sort((a, b) => b.score.total - a.score.total || a.index - b.index)
}
