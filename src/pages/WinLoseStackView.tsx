import { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { buildUpcomingStackMatches, type UpcomingStackMatch } from '../lib/stacking'
import type { Member, Session, StackType } from '../types/app'
import { Timer } from 'lucide-react'
import {
  ArrowPathRoundedSquareIcon,
  PaperAirplaneIcon,
  TrashIcon,
  TrophyIcon,
} from '@heroicons/react/24/solid'
import { toast } from 'sonner'

type Props = {
  session: Session
  memberById: Record<string, Member>
  manualPickIds: string[]
  onToggleManualPick: (id: string) => void
  onCreateManualMatch: () => void
  onDissolveManualMatch: (id: string) => void
  onAssignMatch: (id: string | null, courtId: string, playerIds: string[]) => void
  onPrioritizeMatch: (playerIds: string[]) => void
  onSkipPlayer: (playerId: string) => void
  onSetPlayingNext: (value: 'winner' | 'loser') => void
  onShuffleTeams: () => void
  onAddCourt: () => void
  onRemoveCourt: (id: string) => void
  onRenameCourt: (id: string, name: string) => void
  onEndMatch: (id: string, scoreA: number, scoreB: number) => void
}

const stackClass: Record<StackType, string> = {
  unplayed: 'stack-unplayed',
  winner: 'stack-winner',
  loser: 'stack-loser',
  returning: 'stack-returning',
}

export function WinLoseStackView({
  session,
  memberById,
  manualPickIds,
  onToggleManualPick,
  onCreateManualMatch,
  onDissolveManualMatch,
  onAssignMatch,
  onPrioritizeMatch,
  onSkipPlayer,
  onSetPlayingNext,
  onShuffleTeams,
  onAddCourt,
  onRemoveCourt,
  onRenameCourt,
  onEndMatch,
}: Props) {
  const [skipPlayerId, setSkipPlayerId] = useState<string | null>(null)
  const [result, setResult] = useState<{
    courtId: string
    scoreA: number
    scoreB: number
  } | null>(null)
  const [courtSelection, setCourtSelection] = useState<{
    matchId: string | null
    courtIds: string[]
    playerIds: string[]
  } | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const displayMatches = buildUpcomingStackMatches(session.winLoseStack, session.courts)
  const next = displayMatches[0]
  const isEnded = Boolean(session.endedAt)
  const eligible = new Set([
    ...session.winLoseStack.unplayed,
    ...session.winLoseStack.winners,
    ...session.winLoseStack.losers,
    ...(session.winLoseStack.returning ?? []),
  ])
  const vacantCourtIds = session.courts
    .filter((court) => court.teamA.length === 0 && court.teamB.length === 0)
    .map((court) => court.id)
  const sendToCourt = (matchId: string | null, playerIds: string[]) => {
    if (!session.startedAt) {
      toast.warning('Please start the queue before sending players to a court.')
      return
    }
    if (vacantCourtIds.length === 1) {
      onAssignMatch(matchId, vacantCourtIds[0], playerIds)
      return
    }
    if (vacantCourtIds.length > 1) {
      setCourtSelection({ matchId, courtIds: vacantCourtIds, playerIds })
    }
  }

  const formatWait = (id: string) => {
    if (!session.startedAt) return '00:00'
    const seconds = Math.max(
      0,
      Math.floor(
        (clock - (session.stats[id]?.waitingSince ?? session.startedAt)) / 1000,
      ),
    )
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }
  const formatStarted = (startedAt: number | null) =>
    startedAt
      ? new Date(startedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''
  const formatElapsed = (startedAt: number | null) => {
    if (!startedAt) return '00:00'
    const seconds = Math.max(0, Math.floor((clock - startedAt) / 1000))
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }
  const renderPlayer = (
    id: string,
    source: StackType,
    selectable = false,
  ) => {
    const stats = session.stats[id]
    const selected = manualPickIds.includes(id)
    const content = (
      <>
        <span>{memberById[id]?.name ?? 'Unknown'}</span>
        <span className="stack-player-stats">
          W:{stats?.wins ?? 0} L:
          {(stats?.gamesPlayed ?? 0) - (stats?.wins ?? 0)} <Timer size={13} />{' '}
          {formatWait(id)}
        </span>
      </>
    )
    return selectable ? (
      <button
        key={id}
        type="button"
        className={`stack-player ${stackClass[source]} ${selected ? 'stack-player-selected' : ''}`}
        disabled={isEnded}
        onClick={() => onToggleManualPick(id)}
      >
        {content}
      </button>
    ) : (
      <span key={id} className={`stack-player ${stackClass[source]}`}>
        {content}
      </span>
    )
  }
  const renderMatch = (
    match: UpcomingStackMatch,
    index: number,
  ) => (
    <article
      key={match.id ?? `auto-${match.playerIds[0]}`}
      className={`stack-match-card ${match.complete ? '' : 'stack-match-incomplete'}`}
    >
      <header>
        <strong>Match {index + 1}</strong>
        {match.manual && <span className="stack-manual-badge">MANUAL</span>}
        {match.complete && (
          <button
            type="button"
            className="ghost small"
            disabled={isEnded || index === 0}
            onClick={() => onPrioritizeMatch(match.playerIds)}
          >
            {index === 0 ? 'Next Match' : 'Prioritize'}
          </button>
        )}
      </header>
      <div className="stack-match-players">
        {match.playerIds.map((id) =>
          renderPlayer(id, match.playerSources[id], eligible.has(id)),
        )}
        {Array.from({ length: Math.max(0, 4 - match.playerIds.length) }).map(
          (_, slot) => (
            <span key={`empty-${slot}`} className="stack-player stack-empty">
              Waiting for player
            </span>
          ),
        )}
      </div>
      {match.manual && (
        <button
          className="danger small"
          disabled={isEnded}
          onClick={() => onDissolveManualMatch(match.id!)}
        >
          Cancel manual match
        </button>
      )}
    </article>
  )

  return (
    <section className="win-lose-stack-page">
      <article className="card courts-panel stack-courts-panel">
        <header className="court-header">
          <h3 className="court-title">Courts</h3>
          <button
            className="court-add-button"
            aria-label="Add court"
            disabled={isEnded}
            onClick={onAddCourt}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              viewBox="0 -960 960 960"
              width="24"
              fill="#ffffff"
            >
              <path d="M520-320h200v-320H520v320Zm-280 0h200v-320H240v320Zm520-320v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80ZM160-240v-480 480Zm720-320v320q0 33-23.5 56.5T800-160H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h440v80H160v480h640v-320h80Z" />
            </svg>
          </button>
        </header>
        <div className="court-grid">
          {session.courts.map((court) => {
            const active = court.teamA.length > 0
            return (
              <div
                className={`court ${active ? 'court-active' : ''}`}
                key={court.id}
              >
                <div className="court-card-header">
                  <input
                    className="court-name-input"
                    value={court.name}
                    onChange={(e) => onRenameCourt(court.id, e.target.value)}
                    disabled={isEnded}
                  />
                  {!active && (
                    <button
                      className="court-remove-button"
                      aria-label="Remove court"
                      disabled={isEnded}
                      onClick={() => onRemoveCourt(court.id)}
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  )}
                </div>
                {!active ? (
                  <p className="court-status-open">
                    Available — assign a match
                  </p>
                ) : (
                  <>
                    <div className="court-time-row">
                      <span>⏱ {formatElapsed(court.startedAt)}</span>
                      <span>
                        ▶ <strong>{formatStarted(court.startedAt)}</strong>
                      </span>
                    </div>
                    <div className="court-match">
                      <div className="court-team">
                        <strong>{memberById[court.teamA[0]]?.name}</strong>
                        <span>{memberById[court.teamA[1]]?.name}</span>
                      </div>
                      <div className="court-vs">VS</div>
                      <div className="court-team">
                        <strong>{memberById[court.teamB[0]]?.name}</strong>
                        <span>{memberById[court.teamB[1]]?.name}</span>
                      </div>
                    </div>
                    <div className="court-actions">
                      <button
                        className="end-match-btn"
                        disabled={isEnded}
                        onClick={() =>
                          setResult({ courtId: court.id, scoreA: 0, scoreB: 0 })
                        }
                      >
                        <TrophyIcon width={16} height={16} />
                        <span className="button-label">End Match</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </article>
      <article className="card stack-next-card">
        <header>
          <h3>Next Match</h3>
          <label>
            Playing Next{' '}
            <select
              value={session.winLoseStack.playingNext}
              disabled={isEnded}
              onChange={(e) =>
                onSetPlayingNext(e.target.value as 'winner' | 'loser')
              }
            >
              <option value="winner">Winners</option>
              <option value="loser">Losers</option>
            </select>
          </label>
        </header>
        {next?.complete &&
          (() => {
            const pairs = [
              [
                [0, 2],
                [1, 3],
              ],
              [
                [0, 1],
                [2, 3],
              ],
              [
                [0, 3],
                [1, 2],
              ],
            ][session.winLoseStack.teamRotation ?? 0]
            const team = (indexes: number[]) =>
              indexes.map((index) => next.playerIds[index])
            const matchId = next.id ?? null
            const renderNextPlayer = (id: string) => (
              <button
                key={id}
                type="button"
                className={`stack-player ${stackClass[next.playerSources[id]]}`}
                disabled={isEnded}
                onClick={() => setSkipPlayerId(id)}
              >
                {memberById[id]?.name ?? 'Unknown'}
              </button>
            )
            return (
              <div className="stack-next-match">
                <div>
                  <strong>Team A</strong>
                  {team(pairs[0]).map(renderNextPlayer)}
                </div>
                <b>VS</b>
                <div>
                  <strong>Team B</strong>
                  {team(pairs[1]).map(renderNextPlayer)}
                </div>
                <div className="stack-next-actions">
                  <button
                    type="button"
                    className="ghost"
                    aria-label="Shuffle partners"
                    disabled={isEnded}
                    onClick={onShuffleTeams}
                  >
                    <ArrowPathRoundedSquareIcon width={16} height={16} />
                    <span className="button-label">Shuffle</span>
                  </button>
                  <button
                    className="primary"
                    disabled={isEnded || vacantCourtIds.length === 0}
                    onClick={() => sendToCourt(matchId, next.playerIds)}
                  >
                    <PaperAirplaneIcon width={16} height={16} />
                    <span className="button-label">Send to Court</span>
                  </button>
                </div>
              </div>
            )
          })()}
        {!next?.complete && (
          <p className="subtle">Waiting for four eligible players.</p>
        )}
      </article>
      <article className="card stack-rotation-card">
        <header>
          <div>
            <h3>Stacking</h3>
            <p>Upcoming matches</p>
          </div>
          <div className="stack-legend">
            <span className="stack-unplayed">Unplayed</span>
            <span className="stack-winner">Winner</span>
            <span className="stack-loser">Loser</span>
          </div>
        </header>
        <div className="stack-match-grid">
          {displayMatches.map(renderMatch)}
        </div>
      </article>
      {manualPickIds.length > 0 && (
        <div className="floating-selection-panel">
          {manualPickIds.length < 4 ? (
            <span className="selection-count">
              Players Selected {manualPickIds.length}/4
            </span>
          ) : (
            <button
              className="floating-match-btn primary"
              disabled={isEnded}
              onClick={onCreateManualMatch}
            >
              Create Manual Match
            </button>
          )}
        </div>
      )}
      <Modal
        open={Boolean(result)}
        title="Game Result"
        onClose={() => setResult(null)}
        footer={
          <>
            <button onClick={() => setResult(null)}>Cancel</button>
            <button
              className="primary"
              onClick={() => {
                if (!result) return
                if (result.scoreA === result.scoreB) {
                  toast.warning('Please select winner.')
                  return
                }
                onEndMatch(result.courtId, result.scoreA, result.scoreB)
                setResult(null)
              }}
            >
              Confirm
            </button>
          </>
        }
      >
        {result &&
          (() => {
            const court = session.courts.find(
              (item) => item.id === result.courtId,
            )
            const scoreControl = (team: 'scoreA' | 'scoreB') => (
              <div className="score-controls">
                <button
                  type="button"
                  className="score-btn"
                  onClick={() =>
                    setResult((current) =>
                      current
                        ? { ...current, [team]: Math.max(0, current[team] - 1) }
                        : current,
                    )
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={result[team] === 0 ? '' : result[team]}
                  placeholder="0"
                  onChange={(event) =>
                    setResult({
                      ...result,
                      [team]: Number(event.target.value) || 0,
                    })
                  }
                />
                <button
                  type="button"
                  className="score-btn"
                  onClick={() =>
                    setResult((current) =>
                      current
                        ? { ...current, [team]: current[team] + 1 }
                        : current,
                    )
                  }
                >
                  +
                </button>
              </div>
            )
            const winner =
              result.scoreA === result.scoreB
                ? 'Please select winner.'
                : result.scoreA > result.scoreB
                  ? `${memberById[court?.teamA[0] ?? '']?.name ?? 'Team A'} & ${memberById[court?.teamA[1] ?? '']?.name ?? ''} wins!`
                  : `${memberById[court?.teamB[0] ?? '']?.name ?? 'Team B'} & ${memberById[court?.teamB[1] ?? '']?.name ?? ''} wins!`
            return (
              <div className="modern-result-sheet">
                <div className="result-meta">
                  <h4>{court?.name ?? 'Court'}</h4>
                  <span>{formatElapsed(court?.startedAt ?? null)}</span>
                </div>
                <div className="result-team team-a-result">
                  <div className="result-team-players">
                    <strong>
                      {memberById[court?.teamA[0] ?? '']?.name ?? 'Player 1'}
                    </strong>
                    <span>
                      {memberById[court?.teamA[1] ?? '']?.name ?? 'Player 2'}
                    </span>
                  </div>
                  {scoreControl('scoreA')}
                </div>
                <div className="result-vs">VS</div>
                <div className="result-team team-b-result">
                  <div className="result-team-players">
                    <strong>
                      {memberById[court?.teamB[0] ?? '']?.name ?? 'Player 1'}
                    </strong>
                    <span>
                      {memberById[court?.teamB[1] ?? '']?.name ?? 'Player 2'}
                    </span>
                  </div>
                  {scoreControl('scoreB')}
                </div>
                <p className="winner-line">{winner}</p>
              </div>
            )
          })()}
      </Modal>
      <Modal
        open={skipPlayerId !== null}
        title="Skip Player?"
        onClose={() => setSkipPlayerId(null)}
        footer={
          <>
            <button onClick={() => setSkipPlayerId(null)}>Cancel</button>
            <button
              className="danger"
              disabled={isEnded}
              onClick={() => {
                if (!skipPlayerId) return
                onSkipPlayer(skipPlayerId)
                setSkipPlayerId(null)
              }}
            >
              Skip
            </button>
          </>
        }
      >
        <p>Are you sure to skip "{memberById[skipPlayerId ?? '']?.name ?? 'this player'}"?</p>
      </Modal>
      <Modal
        open={Boolean(courtSelection)}
        title="Select Court"
        onClose={() => setCourtSelection(null)}
      >
        <div className="list">
          {courtSelection?.courtIds.map((courtId) => {
            const court = session.courts.find((item) => item.id === courtId)
            return (
              <button
                key={courtId}
                className="row"
                onClick={() => {
                  if (!courtSelection) return
                  onAssignMatch(courtSelection.matchId, courtId, courtSelection.playerIds)
                  setCourtSelection(null)
                }}
              >
                {court?.name ?? 'Court'}
              </button>
            )
          })}
        </div>
      </Modal>
    </section>
  )
}
