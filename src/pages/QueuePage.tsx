import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import type { Member, MemberStats, Session } from '../types/app'

type QueuePageProps = {
  session: Session
  memberById: Record<string, Member>
  playersSort: 'queue' | 'totalGames' | 'wins' | 'skill' | 'name'
  manualPickIds: string[]
  onChangePlayersSort: (
    value: 'queue' | 'totalGames' | 'wins' | 'skill' | 'name',
  ) => void
  onAddCourt: () => void
  onRemoveCourt: (courtId: string) => void
  onEndMatch: (courtId: string, scoreA: number, scoreB: number) => void
  onGenerateRoster: () => void
  onQueueManualRoster: () => void
  onAssignToCourt: (rosterId: string) => void
  onDissolveRoster: (rosterId: string) => void
  onReplaceRosterPlayer: (rosterId: string, slotIndex: number, memberId: string) => void
  onToggleManualPick: (memberId: string) => void
  getSessionPlayerStatus: (
    memberId: string,
    session: Session,
  ) => 'playing' | 'queueing' | 'waiting'
  skillScore: (skill: Member['skill']) => number
  onShuffleRoster: (rosterId: string) => void
  buildQueueList: (session: Session) => string[]
}

export function QueuePage({
  session,
  memberById,
  playersSort,
  manualPickIds,
  onChangePlayersSort,
  onAddCourt,
  onRemoveCourt,
  onEndMatch,
  onGenerateRoster,
  onQueueManualRoster,
  onAssignToCourt,
  onDissolveRoster,
  onReplaceRosterPlayer,
  onToggleManualPick,
  getSessionPlayerStatus,
  skillScore,
  onShuffleRoster,
  buildQueueList,
}: QueuePageProps) {
  const [, setClock] = useState(0)
  const [resultModal, setResultModal] = useState<{
    courtId: string
    courtLabel: string
    startedAt: number | null
    teamA: string[]
    teamB: string[]
    scoreA: number
    scoreB: number
  } | null>(null)
  const [replaceModal, setReplaceModal] = useState<{
    rosterId: string
    slotIndex: number
    currentMemberId: string
  } | null>(null)

  const skillBorderClass = (skill: Member['skill']) =>
    ({
      Newbie: 'skill-newbie',
      Beginner: 'skill-beginner',
      'Low Intermediate': 'skill-low-intermediate',
      Intermediate: 'skill-intermediate',
      Advanced: 'skill-advanced',
      Elite: 'skill-elite',
    })[skill]

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const dateLabel = useMemo(() => {
    const now = new Date()
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear()).slice(-2)}`
  }, [])

  const formatClock = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const formatElapsed = (startedAt: number | null) => {
    if (!startedAt) return '00:00'
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')
    const secs = String(elapsedSeconds % 60).padStart(2, '0')
    return `${mins}:${secs}`
  }

  const resultText = (
    scoreA: number,
    scoreB: number,
    teamA: string[],
    teamB: string[],
  ) => {
    if (scoreA === scoreB) return 'Match Draw'
    const winnerIds = scoreA > scoreB ? teamA : teamB
    const first = memberById[winnerIds[0]]?.name ?? 'Unknown'
    const second = memberById[winnerIds[1]]?.name ?? 'Unknown'
    return `${first} & ${second} wins!`
  }

  const formatWaitingTime = (waitingSince: number) => {
    const elapsed = Math.max(0, Date.now() - waitingSince)
    const minutes = String(Math.floor(elapsed / 60000)).padStart(2, '0')
    const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')
    return `${minutes}:${seconds}`
  }

const getTotalGames = (
  stats: MemberStats,
) => {
  return (
    stats.gamesPlayed +
    stats.missedGames
  )
}

const getSortedPlayers = () => {
  const queueList =
    buildQueueList(session)

  const queueOrderMap = new Map(
    queueList.map((id, index) => [
      id,
      index,
    ]),
  )

  const allPlayers =
    session.playingIds.map((id) => ({
      id,
      status:
        getSessionPlayerStatus(
          id,
          session,
        ),
      stats: session.stats[id],
    }))

  if (playersSort === 'queue') {
    return [...allPlayers].sort(
      (a, b) => {
        const aIndex =
          queueOrderMap.get(a.id) ??
          Infinity

        const bIndex =
          queueOrderMap.get(b.id) ??
          Infinity

        return aIndex - bIndex
      },
    )
  }

  const sortByCategory = (
    a: {
      id: string
      stats: MemberStats
    },
    b: {
      id: string
      stats: MemberStats
    },
  ) => {
    if (playersSort === 'totalGames') {
      return (
        getTotalGames(b.stats) -
        getTotalGames(a.stats)
      )
    }

    if (playersSort === 'wins') {
      return (
        b.stats.wins -
        a.stats.wins
      )
    }

    if (playersSort === 'skill') {
      return (
        skillScore(
          memberById[b.id].skill,
        ) -
        skillScore(
          memberById[a.id].skill,
        )
      )
    }

    if (playersSort === 'name') {
      return memberById[
        a.id
      ].name.localeCompare(
        memberById[b.id].name,
      )
    }

    return 0
  }

  return [...allPlayers].sort(
    sortByCategory,
  )
}

  const sortedPlayers = getSortedPlayers()

  return (
    <section className="stack">
      <article className="card">
        <div className="session-head">
          <h3>{session.name} - {dateLabel}</h3>
          <p>Courts: {session.courts.length}</p>
        </div>
        <div className="section-title">
          <h3>Court Section</h3>
          <button className="primary small" onClick={onAddCourt}>
            Add Court
          </button>
        </div>
        <div className="court-grid">
          {session.courts.map((court, idx) => (
            <div key={court.id} className="court">
              <div className="section-title">
                <strong>Court {idx + 1}</strong>
                {court.teamA.length === 0 && court.teamB.length === 0 && (
                  <button
                    className="danger small"
                    onClick={() => onRemoveCourt(court.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
              {court.teamA.length === 0 ? (
                <p className="available">Available</p>
              ) : (
                <>
                  <p>
                    Start Time: <strong>{formatClock(court.startedAt ?? Date.now())}</strong>
                  </p>
                  <p>
                    Elapsed Time: <strong>{formatElapsed(court.startedAt)}</strong>
                  </p>
                  <p className="court-center court-matchline">
                    <strong>{memberById[court.teamA[0]]?.name} & {memberById[court.teamA[1]]?.name}</strong> vs{' '}
                    <strong>{memberById[court.teamB[0]]?.name} & {memberById[court.teamB[1]]?.name}</strong>
                  </p>
                  <div className="score-row">
                    <button
                      className="primary"
                      onClick={() =>
                        setResultModal({
                          courtId: court.id,
                          courtLabel: `Court ${idx + 1}`,
                          startedAt: court.startedAt,
                          teamA: [...court.teamA],
                          teamB: [...court.teamB],
                          scoreA: 0,
                          scoreB: 0,
                        })
                      }
                    >
                      Complete Match
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <div className="section-title">
          <h3>Match Making</h3>
          <div className="actions">
            <button className="primary small" onClick={onGenerateRoster}>
              Generate
            </button>
            {manualPickIds.length === 4 && (
              <button className="play small" onClick={onQueueManualRoster}>
                Queue Manual
              </button>
            )}
          </div>
        </div>
        <div className="court-grid">
          {session.rosters.map((roster, idx) => (
            <div key={roster.id} className="queue-card">
              <strong>Queue {idx + 1}</strong> 
              
              <div className="roster-teams">
                <div className="team-column team-a">
                  <div className="team-label">Team A</div>
                  {roster.playerIds.slice(0, 2).map((memberId, slotIndex) => (
                    <button
                      key={`${roster.id}-${memberId}-${slotIndex}`}
                      className="link-btn roster-slot"
                      onClick={() =>
                        setReplaceModal({
                          rosterId: roster.id,
                          slotIndex,
                          currentMemberId: memberId,
                        })
                      }
                    >
                      {memberById[memberId]?.name ?? 'Unknown'}
                    </button>
                  ))}
                </div>
                <div className="team-divider">vs</div>
                <div className="team-column team-b">
                  <div className="team-label">Team B</div>
                  {roster.playerIds.slice(2, 4).map((memberId, slotIndex) => (
                    <button
                      key={`${roster.id}-${memberId}-${slotIndex + 2}`}
                      className="link-btn roster-slot"
                      onClick={() =>
                        setReplaceModal({
                          rosterId: roster.id,
                          slotIndex: slotIndex + 2,
                          currentMemberId: memberId,
                        })
                      }
                    >
                      {memberById[memberId]?.name ?? 'Unknown'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="row-actions">
                <button onClick={() => onShuffleRoster(roster.id)}>
                  Shuffle
                </button>
                <button className="play" onClick={() => onAssignToCourt(roster.id)}>
                  Play
                </button>
                <button className="danger" onClick={() => onDissolveRoster(roster.id)}>
                  Dissolve
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        
        <div className="section-title">
          <h3>Players List</h3>
          <label>
            Sort:
            <select
              value={playersSort}
              onChange={(e) => onChangePlayersSort(e.target.value as typeof playersSort)}
            >
              <option value="queue">Current Queue</option>
              <option value="totalGames">Total Games</option>
              <option value="wins">Wins</option>
              <option value="skill">Skill Level</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        <div className="list player-grid">
          {sortedPlayers.map(({ id: memberId, status, stats }) => (
            <div
              key={memberId}
              className={`row row-table row-skill ${status} ${skillBorderClass(
                memberById[memberId].skill,
              )}`}
            >
              <div className="row-col-name">
                <strong>{memberById[memberId].name}</strong>
                <p>{memberById[memberId].skill}
                </p>
              </div>
              <div className="row-player-stats">
                <p>
                  G:{stats.gamesPlayed}  W:{stats.wins}
                  {stats.missedGames > 0 ? `  M:${stats.missedGames}` : ''}
                </p><span className="queue-player-time">
                  {status === 'playing'
                    ? 'In Game'
                    : formatWaitingTime(stats.waitingSince)}
                </span>
              </div>
              <div className="row-col-action queue-player-action">
                <button
                  className={manualPickIds.includes(memberId) ? 'selected' : ''}
                  onClick={() => onToggleManualPick(memberId)}
                >
                  {manualPickIds.includes(memberId) ? 'Unpick' : 'Pick'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <Modal
        open={Boolean(replaceModal)}
        title="Replace Player"
        onClose={() => setReplaceModal(null)}
      >
        <div className="list">
          {[...session.playingIds]
            .filter((memberId) => {
              const onCourt = session.courts.some((court) =>
                [...court.teamA, ...court.teamB].includes(memberId),
              )
              if (onCourt) return false
              const usedInOtherRoster = session.rosters.some(
                (roster) =>
                  roster.id !== replaceModal?.rosterId &&
                  roster.playerIds.includes(memberId),
              )
              return !usedInOtherRoster
            })
            .map((memberId) => (
              <button
                key={memberId}
                className={`row ${memberId === replaceModal?.currentMemberId ? 'selected' : ''}`}
                onClick={() => {
                  if (!replaceModal) return
                  onReplaceRosterPlayer(replaceModal.rosterId, replaceModal.slotIndex, memberId)
                  setReplaceModal(null)
                }}
              >
                <span>{memberById[memberId]?.name ?? 'Unknown'}</span>
                <span>{memberById[memberId]?.skill ?? ''}</span>
              </button>
            ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(resultModal)}
        title="Game Result"
        onClose={() => setResultModal(null)}
        footer={
          <>
            <button onClick={() => setResultModal(null)}>Cancel</button>
            <button
              className="primary"
              onClick={() => {
                if (!resultModal) return
                onEndMatch(resultModal.courtId, resultModal.scoreA, resultModal.scoreB)
                setResultModal(null)
              }}
            >
              Confirm
            </button>
          </>
        }
      >
        {resultModal && (
          <div className="result-sheet">
            <h4>{resultModal.courtLabel}</h4>
            <p>
              Start Time: <strong>{formatClock(resultModal.startedAt ?? Date.now())}</strong>
            </p>
            <p>
              Elapsed Time: <strong>{formatElapsed(resultModal.startedAt)}</strong>
            </p>
            <div className="result-row">
              <span>{memberById[resultModal.teamA[0]]?.name ?? 'Player1A'}</span>
              <input
                type="number"
                min={0}
                value={resultModal.scoreA}
                onChange={(event) =>
                  setResultModal((prev) =>
                    prev ? { ...prev, scoreA: Number(event.target.value) || 0 } : prev,
                  )
                }
              />
              <span>vs</span>
              <input
                type="number"
                min={0}
                value={resultModal.scoreB}
                onChange={(event) =>
                  setResultModal((prev) =>
                    prev ? { ...prev, scoreB: Number(event.target.value) || 0 } : prev,
                  )
                }
              />
              <span>{memberById[resultModal.teamB[0]]?.name ?? 'Player1B'}</span>
            </div>
            <div className="result-row">
              <span>{memberById[resultModal.teamA[1]]?.name ?? 'Player2A'}</span>
              <span />
              <span />
              <span />
              <span>{memberById[resultModal.teamB[1]]?.name ?? 'Player2B'}</span>
            </div>
            <p className="winner-line">
              {resultText(
                resultModal.scoreA,
                resultModal.scoreB,
                resultModal.teamA,
                resultModal.teamB,
              )}
            </p>
          </div>
        )}
      </Modal>
    </section>
  )
}
