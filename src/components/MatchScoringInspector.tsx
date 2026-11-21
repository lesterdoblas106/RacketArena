import { useEffect, useMemo, useState } from 'react'
import { ChartBarIcon } from '@heroicons/react/24/solid'
import { loadScoringHistory } from '../lib/scoringHistoryStorage'
import { rankArrangements, scoringHistoryLimit } from '../lib/smartQueueInspector'
import type {
  AutomaticScoring,
  ScoredArrangement,
  ScoringSnapshot,
} from '../lib/smartQueueInspector'
import './MatchScoringInspector.css'

const objectives = [
  ['game', 'Game Difference', 'Game Δ'],
  ['waiting', 'Waiting Score', 'Wait'],
  ['skill', 'Skill Gap', 'Skill Δ'],
  ['team', 'Team Balance', 'Balance'],
  ['teammate', 'Teammate Diversity', 'TM Div.'],
  ['opponent', 'Opponent Diversity', 'Opp. Div.'],
] as const
const format = (value: number) => Number(value.toFixed(6)).toString()
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)
const seconds = (value: number) => `${format(value / 1000)} s`

export function MatchScoringInspector({
  sessionId,
  snapshots,
}: {
  sessionId: string
  snapshots?: ScoringSnapshot[]
}) {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  const [open, setOpen] = useState(false)
  const [stored, setStored] = useState<ScoringSnapshot[]>([])
  const [selectedId, setSelectedId] = useState('')
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const change = () => setDesktop(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    if (!desktop) return
    let active = true
    void loadScoringHistory(sessionId)
      .then((history) => {
        if (active) setStored(history)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [desktop, sessionId])

  const history = useMemo(() => {
    const merged = new Map<string, ScoringSnapshot>()
    for (const item of [...(snapshots ?? []), ...stored]) {
      if (!merged.has(item.id)) merged.set(item.id, item)
    }
    return [...merged.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, scoringHistoryLimit)
  }, [snapshots, stored])
  if (!desktop || !history.some((item) => 'scoring' in item)) return null
  const selected = history.find(({ id }) => id === selectedId) ?? history[0]

  return (
    <section className="card scoring-inspector">
      <button
        type="button"
        className="scoring-toggle"
        aria-expanded={open}
        aria-controls="match-scoring"
        onClick={() => setOpen(!open)}
      >
        <ChartBarIcon aria-hidden="true" /> {open ? 'Hide Scoring' : 'View Scoring'}
      </button>
      {open && (
        <div id="match-scoring" className="scoring-content">
          <label className="scoring-label">
            Generated match
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
              {history.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.createdAt).toLocaleString()} · {item.playerNames.join(', ')}
                  {'manualReason' in item ? ' · Manual' : ''}
                </option>
              ))}
            </select>
          </label>
          {'scoring' in selected ? (
            <ScoringDecision key={selected.id} data={selected.scoring} />
          ) : (
            <p>Manual roster. {selected.manualReason}. The six-objective scorer was bypassed.</p>
          )}
        </div>
      )}
    </section>
  )
}

type SortKey =
  | 'rank'
  | 'players'
  | 'teamA'
  | 'teamB'
  | 'base'
  | 'layer'
  | 'total'
  | (typeof objectives)[number][0]

function ScoringDecision({ data }: { data: AutomaticScoring }) {
  const [alternativeIndex, setAlternativeIndex] = useState<number>()
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
    key: 'total',
    descending: true,
  })
  const ranked = useMemo(() => rankArrangements(data.arrangements), [data.arrangements])
  const winner = data.arrangements[data.winnerIndex]
  const alternative =
    alternativeIndex === undefined ? undefined : data.arrangements[alternativeIndex]
  const base = data.players[data.baseId]
  const name = (id: string) => data.players[id].name
  const names = (ids: readonly string[]) => ids.map(name).join(' / ')
  const maxPoints = 100 * sum(Object.values(winner.score.weights))
  const columns: (readonly [SortKey, string, string?])[] = [
    ['rank', 'Rank'],
    ['players', 'Players'],
    ['teamA', 'Team A'],
    ['teamB', 'Team B'],
    ['base', 'Base'],
    ['layer', 'Layer'],
    ...objectives,
    ['total', 'Final score'],
  ]
  const cell = (row: (typeof ranked)[number], rank: number, key: SortKey) => {
    switch (key) {
      case 'rank':
        return rank
      case 'players':
        return names([...row.teams.flat()].sort())
      case 'teamA':
        return names(row.teams[0])
      case 'teamB':
        return names(row.teams[1])
      case 'base':
        return base.name
      case 'layer':
        return data.layer
      case 'total':
        return row.score.total
      default:
        return 100 * row.score.weighted[key]
    }
  }
  const rows = ranked
    .map((row, index) => ({ row, rank: index + 1 }))
    .sort((a, b) => {
      const left = cell(a.row, a.rank, sort.key)
      const right = cell(b.row, b.rank, sort.key)
      const difference =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right))
      return difference * (sort.descending ? -1 : 1) || a.rank - b.rank
    })
  const combinations = new Set(ranked.map(({ teams }) => JSON.stringify([...teams.flat()].sort())))
    .size

  return (
    <>
      <div>
        <h3>Winning arrangement</h3>
        <p>
          <strong>{names(winner.teams[0])}</strong> vs <strong>{names(winner.teams[1])}</strong>
        </p>
        <p>{data.reason}</p>
        <p>
          Base player <strong>{base.name}</strong> · {base.gamesPlayed} played + {base.missedGames}{' '}
          missed = {base.totalGames} total · Waiting score {seconds(base.waitingScore)} · Late
          Priority {base.latePriority ? 'active' : 'inactive'} · Layer {data.layer}
          {data.preferredBaseId ? ' · Manually selected base' : ''}
        </p>
        {Math.abs(maxPoints - 100) > 1e-8 && (
          <p>
            Configured weights total {format(maxPoints)}%. The engine uses these weights as
            configured, so its score can exceed 100.
          </p>
        )}
      </div>
      <Breakdown data={data} arrangement={winner} />
      <div>
        <h3>Arrangement comparison</h3>
        <p>
          {combinations} player combinations · {ranked.length} evaluated arrangements
        </p>
        <p>Objective columns show contribution points toward the final score.</p>
        <div className="scoring-table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map(([key, label, shortLabel]) => (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={
                      sort.key === key ? (sort.descending ? 'descending' : 'ascending') : undefined
                    }
                  >
                    <button
                      type="button"
                      title={label}
                      aria-label={label}
                      onClick={() =>
                        setSort({
                          key,
                          descending: sort.key === key ? !sort.descending : key === 'total',
                        })
                      }
                    >
                      {shortLabel ?? label}
                      {sort.key === key ? (sort.descending ? ' ↓' : ' ↑') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, rank }) => (
                <tr
                  key={row.index}
                  className={row.index === data.winnerIndex ? 'scoring-winner' : undefined}
                  data-selected={row.index === alternativeIndex}
                  onClick={() => setAlternativeIndex(row.index)}
                >
                  {columns.map(([key]) => {
                    const value = cell(row, rank, key)
                    return (
                      <td key={key}>
                        {key === 'rank' ? (
                          <button
                            type="button"
                            aria-label={`Inspect rank ${rank}`}
                            onClick={() => setAlternativeIndex(row.index)}
                          >
                            {rank}
                          </button>
                        ) : typeof value === 'number' ? (
                          format(value)
                        ) : (
                          value
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {alternative && alternativeIndex !== data.winnerIndex && (
        <div>
          <h3>Alternative arrangement</h3>
          <p>
            {names(alternative.teams[0])} vs {names(alternative.teams[1])}
          </p>
          <p>
            {winner.score.total === alternative.score.total
              ? 'The composite scores are exactly equal. The winner was evaluated first.'
              : `The winning arrangement scored ${format(winner.score.total - alternative.score.total)} more points.`}
          </p>
          <p>
            {objectives
              .map(
                ([key, label]) =>
                  `${label} ${format(100 * (winner.score.weighted[key] - alternative.score.weighted[key]))}`,
              )
              .join(' · ')}{' '}
            points (winner minus alternative)
          </p>
          <Breakdown key={alternativeIndex} data={data} arrangement={alternative} />
        </div>
      )}
      <Relaxation data={data} />
    </>
  )
}

function Breakdown({
  data,
  arrangement: {
    teams: [teamA, teamB],
    score,
  },
}: {
  data: AutomaticScoring
  arrangement: ScoredArrangement
}) {
  const { raw, normalized, weights, weighted, total } = score
  const { formula } = data
  const players = [...teamA, ...teamB].map((id) => data.players[id])
  const pairLabels = players.flatMap((a, index) =>
    players.slice(index + 1).map((b) => `${a.name} / ${b.name}`),
  )
  const repetitions = (ids: readonly string[]) => ids.map((id) => data.players[id].name).join(' / ')
  const pairValues = (labels: string[], values: number[]) =>
    labels.map((label, index) => (
      <li key={index}>
        {label} = {format(values[index])}
      </li>
    ))
  const rawValues = [
    format(raw.averageGameDifference),
    seconds(raw.meanWaitingScore),
    format(raw.sumSkillDifferences),
    format(raw.teamDifference),
    format(raw.averageTeammateRepetitions),
    format(raw.averageOpponentRepetitions),
  ]
  const details = [
    <>
      <ul>{pairValues(pairLabels, raw.gameDifferences)}</ul>
      <p>
        Sum {sum(raw.gameDifferences)} ÷ 6 = {format(raw.averageGameDifference)}. 1 ÷ (1 +{' '}
        {formula.alpha} × {format(raw.averageGameDifference)}) = {format(normalized.game)}.
      </p>
    </>,
    <>
      <ul>
        {players.map((p) => (
          <li key={p.id}>
            {p.name} · {formula.currentWaitWeight} × {seconds(p.currentWait)} current +{' '}
            {formula.averageWaitWeight} × {seconds(p.averageWait)} average ={' '}
            {seconds(p.waitingScore)}
          </li>
        ))}
      </ul>
      <p>
        Roster mean {seconds(raw.meanWaitingScore)} · Eligible maximum{' '}
        {seconds(raw.maxWaitingScore)}.{' '}
        {raw.maxWaitingScore === 0
          ? 'The eligible maximum is zero, so the normalized score is 0.'
          : `Mean ÷ maximum = ${format(normalized.waiting)}.`}
      </p>
    </>,
    <>
      <ul>{pairValues(pairLabels, raw.skillDifferences)}</ul>
      <p>
        1 − {raw.sumSkillDifferences} ÷ {formula.skillDenominator} = {format(normalized.skill)}.
      </p>
    </>,
    <p>
      Team A {sum(players.slice(0, 2).map((p) => p.skill))} · Team B{' '}
      {sum(players.slice(2).map((p) => p.skill))} · Absolute difference {raw.teamDifference}. 1 −{' '}
      {raw.teamDifference} ÷ {formula.teamDenominator} = {format(normalized.team)}.
    </p>,
    <>
      <ul>{pairValues([repetitions(teamA), repetitions(teamB)], raw.teammateCounts)}</ul>
      <p>
        Average {format(raw.averageTeammateRepetitions)}. 1 ÷ (1 + {formula.lambdaT} ×{' '}
        {format(raw.averageTeammateRepetitions)}) = {format(normalized.teammate)}.
      </p>
    </>,
    <>
      <ul>
        {pairValues(
          teamA.flatMap((a) => teamB.map((b) => repetitions([a, b]))),
          raw.opponentCounts,
        )}
      </ul>
      <p>
        Average {format(raw.averageOpponentRepetitions)}. 1 ÷ (1 + {formula.lambdaO} ×{' '}
        {format(raw.averageOpponentRepetitions)}) = {format(normalized.opponent)}.
      </p>
    </>,
  ]
  return (
    <div className="scoring-breakdown-scroll">
      <table className="scoring-breakdown">
        <thead>
          <tr>
            <th>Objective</th>
            <th>Raw value</th>
            <th>Normalized score</th>
            <th>Weight</th>
            <th>Contribution (points)</th>
          </tr>
        </thead>
        <tbody>
          {objectives.map(([key, label], index) => (
            <tr key={key}>
              <th scope="row">
                <details>
                  <summary>{label}</summary>
                  {details[index]}
                </details>
              </th>
              <td>{rawValues[index]}</td>
              <td>{format(normalized[key])}</td>
              <td>{format(100 * weights[key])}%</td>
              <td>{format(100 * weighted[key])}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>Composite score (100 × weighted sum)</th>
            <td>{format(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Relaxation({ data }: { data: AutomaticScoring }) {
  return (
    <div>
      <h3>Relaxation layers</h3>
      <p>
        Queue order uses Late Priority first, then fewer total games, higher waiting score, and
        earlier arrival.
      </p>
      <p>
        Maximum gaps (games / skill) ·{' '}
        {data.thresholds
          .map((layer, i) => `L${i + 1} ${layer.maxGameGap} / ${layer.maxSkillGap}`)
          .join(' · ')}
      </p>
      {data.searches.map((search, index) => (
        <details key={index}>
          <summary>
            {search.label} · {search.layers.length} layer attempts
          </summary>
          {search.orderedIds.length > 0 && (
            <p>
              Queue order ·{' '}
              {search.orderedIds
                .map((id) => {
                  const player = search.players[id]
                  return `${player.name}${player.latePriority ? ' (Late Priority)' : ''}`
                })
                .join(' → ')}
            </p>
          )}
          {search.excluded.length > 0 && (
            <ul>
              {search.excluded.map(({ name, reason }, i) => (
                <li key={i}>
                  {name} · {reason}
                </li>
              ))}
            </ul>
          )}
          {search.layers.map((layer) => {
            const base = search.players[layer.baseId]
            const admitted = new Set(layer.qualifiedIds)
            return (
              <details key={`${base.id}-${layer.layer}`}>
                <summary>
                  {base.name} · Layer {layer.layer} · {admitted.size} qualified
                  {admitted.size >= 3 ? ' · First successful layer' : ''}
                </summary>
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Game gap ≤ {layer.maxGameGap}</th>
                      <th>Skill gap ≤ {layer.maxSkillGap}</th>
                      <th>Eligibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {search.orderedIds
                      .filter((id) => id !== base.id)
                      .map((id) => {
                        const candidate = search.players[id]
                        const games = Math.abs(candidate.totalGames - base.totalGames)
                        const skill = Math.abs(candidate.skill - base.skill)
                        const reasons = [
                          games > layer.maxGameGap && 'Game gap',
                          skill > layer.maxSkillGap && 'Skill gap',
                        ].filter(Boolean)
                        return (
                          <tr key={id}>
                            <td>{candidate.name}</td>
                            <td>{games}</td>
                            <td>{skill}</td>
                            <td>{admitted.has(id) ? 'Qualified' : reasons.join(' and ')}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </details>
            )
          })}
        </details>
      ))}
    </div>
  )
}
