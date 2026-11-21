export type SmartQueuePlayer = {
  id: string
  totalGames: number
  skill: number
  waitingScore: number
}

type Pair<T> = readonly [T, T]
export type Doubles<T> = readonly [Pair<T>, Pair<T>]

export const smartQueueWeights = {
  game: 0.15,
  waiting: 0.30,
  skill: 0.20,
  team: 0.20,
  teammate: 0.10,
  opponent: 0.05,
} as const

type Objective = keyof typeof smartQueueWeights
const objectives = Object.keys(smartQueueWeights) as Objective[]

export const smartQueueFormula = {
  alpha: 1,
  lambdaT: 1,
  lambdaO: 1,
  currentWaitWeight: 0.7,
  averageWaitWeight: 0.3,
  skillDenominator: 24,
  teamDenominator: 12,
}

export function calculateWaitingScore(currentWaitMs: number, averageWaitMs: number) {
  return smartQueueFormula.currentWaitWeight * currentWaitMs + smartQueueFormula.averageWaitWeight * averageWaitMs
}

export function buildPairingCounts(
  history: readonly { teamA: readonly string[]; teamB: readonly string[] }[],
) {
  const teammate = new Map<string, number>()
  const opponent = new Map<string, number>()
  const key = (a: string, b: string) => JSON.stringify(a < b ? [a, b] : [b, a])
  const increment = (counts: Map<string, number>, a: string, b: string) => {
    const pair = key(a, b)
    counts.set(pair, (counts.get(pair) ?? 0) + 1)
  }

  for (const { teamA, teamB } of history) {
    for (const team of [teamA, teamB]) {
      team.forEach((a, index) => {
        for (const b of team.slice(index + 1)) increment(teammate, a, b)
      })
    }
    for (const a of teamA) {
      for (const b of teamB) increment(opponent, a, b)
    }
  }

  return {
    teammate: (a: string, b: string) => teammate.get(key(a, b)) ?? 0,
    opponent: (a: string, b: string) => opponent.get(key(a, b)) ?? 0,
  }
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

export function scoreSmartQueueArrangement(
  [teamA, teamB]: Doubles<SmartQueuePlayer>,
  maxWaitingScore: number,
  counts: ReturnType<typeof buildPairingCounts>,
  { alpha = smartQueueFormula.alpha, lambdaT = smartQueueFormula.lambdaT, lambdaO = smartQueueFormula.lambdaO } = {},
) {
  const players = [...teamA, ...teamB]
  const pairs = players.flatMap((a, index) => players.slice(index + 1).map((b) => [a, b] as const))
  const gameDifferences = pairs.map(([a, b]) => Math.abs(a.totalGames - b.totalGames))
  const skillDifferences = pairs.map(([a, b]) => Math.abs(a.skill - b.skill))
  const teammateCounts = [teamA, teamB].map(([a, b]) => counts.teammate(a.id, b.id))
  const opponentCounts = teamA.flatMap((a) => teamB.map((b) => counts.opponent(a.id, b.id)))

  const raw = {
    averageGameDifference: sum(gameDifferences) / 6,
    meanWaitingScore: sum(players.map((player) => player.waitingScore)) / 4,
    maxWaitingScore,
    sumSkillDifferences: sum(skillDifferences),
    teamDifference: Math.abs(sum(teamA.map((p) => p.skill)) - sum(teamB.map((p) => p.skill))),
    averageTeammateRepetitions: sum(teammateCounts) / 2,
    averageOpponentRepetitions: sum(opponentCounts) / 4,
    gameDifferences,
    skillDifferences,
    teammateCounts,
    opponentCounts,
  }
  const normalized = {
    game: 1 / (1 + alpha * raw.averageGameDifference),
    waiting: maxWaitingScore === 0 ? 0 : raw.meanWaitingScore / maxWaitingScore,
    skill: 1 - raw.sumSkillDifferences / smartQueueFormula.skillDenominator,
    team: 1 - raw.teamDifference / smartQueueFormula.teamDenominator,
    teammate: 1 / (1 + lambdaT * raw.averageTeammateRepetitions),
    opponent: 1 / (1 + lambdaO * raw.averageOpponentRepetitions),
  }
  const weighted = Object.fromEntries(
    objectives.map((objective) => [objective, smartQueueWeights[objective] * normalized[objective]]),
  ) as Record<Objective, number>

  return { raw, normalized, weights: smartQueueWeights, weighted, total: 100 * sum(Object.values(weighted)) }
}

export function selectSmartQueueArrangement(
  base: SmartQueuePlayer,
  candidates: readonly SmartQueuePlayer[],
  maxWaitingScore: number,
  counts: ReturnType<typeof buildPairingCounts>,
  onEvaluated?: (teams: Doubles<SmartQueuePlayer>, score: ReturnType<typeof scoreSmartQueueArrangement>) => void,
) {
  let best: { teams: Doubles<SmartQueuePlayer>; total: number } | undefined

  for (let i = 0; i < candidates.length - 2; i++) {
    for (let j = i + 1; j < candidates.length - 1; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const [b, c, d] = [candidates[i], candidates[j], candidates[k]]
        const arrangements: Doubles<SmartQueuePlayer>[] = [
          [[base, b], [c, d]],
          [[base, c], [b, d]],
          [[base, d], [b, c]],
        ]
        for (const teams of arrangements) {
          const score = scoreSmartQueueArrangement(teams, maxWaitingScore, counts)
          const { total } = score
          onEvaluated?.(teams, score)
          if (!best || total > best.total) best = { teams, total }
        }
      }
    }
  }

  return best
}
