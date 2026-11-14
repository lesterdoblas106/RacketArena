import type { SmartQueuePlayer } from './smartQueueScoring'

export type SmartQueueCandidate = SmartQueuePlayer & {
  latePriority: boolean
  arrivalOrder: number
}

export const compatibilityLayers = [
  { maxGameGap: 0, maxSkillGap: 1 },
  { maxGameGap: 0, maxSkillGap: 2 },
  { maxGameGap: 1, maxSkillGap: 2 },
  { maxGameGap: 1, maxSkillGap: 3 },
  { maxGameGap: 1, maxSkillGap: 4 },
  { maxGameGap: 2, maxSkillGap: 6 },
] as const

export function findSmartQueuePool(players: readonly SmartQueueCandidate[], preferredBaseId?: string) {
  const ordered = [...players].sort((a, b) =>
    Number(b.latePriority) - Number(a.latePriority)
    || a.totalGames - b.totalGames
    || b.waitingScore - a.waitingScore
    || a.arrivalOrder - b.arrivalOrder,
  )
  const bases = preferredBaseId === undefined
    ? ordered
    : ordered.filter((player) => player.id === preferredBaseId)

  for (const base of bases) {
    for (const [index, layer] of compatibilityLayers.entries()) {
      const candidates = ordered.filter((player) =>
        player.id !== base.id
        && Math.abs(player.totalGames - base.totalGames) <= layer.maxGameGap
        && Math.abs(player.skill - base.skill) <= layer.maxSkillGap,
      )
      if (candidates.length >= 3) return { base, candidates, layer: index + 1 }
    }
  }

  return null
}
