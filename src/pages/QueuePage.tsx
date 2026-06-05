import { useEffect,  useState } from 'react'
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
  forfeitMatch: (courtId: string) => void
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
  forfeitMatch,
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
      'High Intermediate': 'skill-high-intermediate',
      Advanced: 'skill-advanced',
      Elite: 'skill-elite',
    })[skill]

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // const dateLabel = useMemo(() => {
  //   const now = new Date()
  //   return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear()).slice(-2)}`
  // }, [])

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
          {/* <h3>{session.name} - {dateLabel}</h3> */}
          {/* <p>Courts: {session.courts.length}</p> */}
        </div>
        <div className="section-title">
          <h3>Court Section ({session.courts.length})
          <button onClick={onAddCourt}
            title="Add Court"
          >
            <svg xmlns="http://www.w3.org/2000/svg" 
            height="24px" 
            viewBox="0 -960 960 960" 
            width="24px" fill="#1f1f1f">
            <path d="M520-320h200v-320H520v320Zm-280 0h200v-320H240v320Zm520-320v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80ZM160-240v-480 480Zm720-320v320q0 33-23.5 56.5T800-160H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h440v80H160v480h640v-320h80Z"/>
          </svg>
          </button></h3>
        </div>
        <div className="court-grid">
          {session.courts.map((court, idx) => (
            <div key={court.id} className="court">
              <div className="section-title">
                <strong>Court {idx + 1}</strong>
                {court.teamA.length === 0 && court.teamB.length === 0 && (
                  <button
                  className="icon-btn remove-btn" 
                  onClick={() => onRemoveCourt(court.id)} 
                  title='Remove Court'> 
                  <svg xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="size-6"                  
                  style={{ width: '20px', height: '20px' }} 
                  >
                    <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                  </svg>

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
                      End Match
                    </button>
                    <button
                      className="ghost small"
                      onClick={() => {
                        forfeitMatch(court.id)}
                      }
                    >
                      Forfeit
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
        </div>
        <div className="court-grid">
          {session.rosters.map((roster, idx) => (
            <div key={roster.id} className="queue-card">
              <strong>Queue {idx + 1}</strong> 
                          
            <div className="compact-roster-lines">
              <div className="roster-line team-a">
                {roster.playerIds.slice(0, 2).map((memberId, slotIndex) => (
                  <button
                    key={`${roster.id}-${memberId}-${slotIndex}`}
                    className="link-btn compact-roster-player"
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
                )).reduce((prev, curr) => [prev, ' - ', curr] as any)}
              </div>

              <div className="roster-line team-b">
                {roster.playerIds.slice(2, 4).map((memberId, slotIndex) => (
                  <button
                    key={`${roster.id}-${memberId}-${slotIndex + 2}`}
                    className="link-btn compact-roster-player"
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
                )).reduce((prev, curr) => [prev, ' - ', curr] as any)}
              </div>
            </div>
              {/* Buttons */}
              <div className="row-actions">
                {/* Shuffle */}
                <button onClick={() => onShuffleRoster(roster.id)}
                  title='Shuffle Players'>
                  <svg xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 20 20" fill="currentColor" 
                  className="size-5"                  
                  style={{ width: '24px', height: '24px' }} >
                    <path fillRule="evenodd" d="M10 4.5c1.215 0 2.417.055 3.604.162a.68.68 0 0 1 .615.597c.124 1.038.208 2.088.25 3.15l-1.689-1.69a.75.75 0 0 0-1.06 1.061l2.999 3a.75.75 0 0 0 1.06 0l3.001-3a.75.75 0 1 0-1.06-1.06l-1.748 1.747a41.31 41.31 0 0 0-.264-3.386 2.18 2.18 0 0 0-1.97-1.913 41.512 41.512 0 0 0-7.477 0 2.18 2.18 0 0 0-1.969 1.913 41.16 41.16 0 0 0-.16 1.61.75.75 0 1 0 1.495.12c.041-.52.093-1.038.154-1.552a.68.68 0 0 1 .615-.597A40.012 40.012 0 0 1 10 4.5ZM5.281 9.22a.75.75 0 0 0-1.06 0l-3.001 3a.75.75 0 1 0 1.06 1.06l1.748-1.747c.042 1.141.13 2.27.264 3.386a2.18 2.18 0 0 0 1.97 1.913 41.533 41.533 0 0 0 7.477 0 2.18 2.18 0 0 0 1.969-1.913c.064-.534.117-1.071.16-1.61a.75.75 0 1 0-1.495-.12c-.041.52-.093 1.037-.154 1.552a.68.68 0 0 1-.615.597 40.013 40.013 0 0 1-7.208 0 .68.68 0 0 1-.615-.597 39.785 39.785 0 0 1-.25-3.15l1.689 1.69a.75.75 0 0 0 1.06-1.061l-2.999-3Z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Dissolve */}
                <button className="danger" onClick={() => onDissolveRoster(roster.id)}
                  title='Dissolve Roster'>
                  <svg xmlns="http://www.w3.org/2000/svg" 
                  height="24px" viewBox="0 -960 960 960" 
                  width="24px" 
                  fill="currentColor">
                    <path d="m609-181 70-70 70 70 30-30-69-69 70-70-30-30-70 70-70-70-30 30 70 70-70 70 29 29Zm-489 21v-640l572 240h-12q-35 0-66 8t-60 22L200-680v140l240 60-240 60v140l216-92q-8 23-12 45.5t-4 46.5v2L120-160Zm418.5 21.5Q480-197 480-280t58.5-141.5Q597-480 680-480t141.5 58.5Q880-363 880-280t-58.5 141.5Q763-80 680-80t-141.5-58.5ZM200-372v-308 400-92Z"/></svg>
                </button>

                {/* Play */}
                <button className="play" onClick={() => onAssignToCourt(roster.id)}
                  title='Assign to Court'>
                  <svg xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 20 20" 
                  fill="currentColor" 
                  className="size-5"
                  style={{ width: '20px', height: '20px' }} >
                    <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
                  </svg>
                
                </button>
                
              </div>
            </div>
          ))}
        </div>
        
          <div className="actions generate-row">
            <button className="primary generate-btn" onClick={onGenerateRoster}>
              Generate
            </button>
          </div>
      </article>

      <article className="card">
        
        <div className="players-header">
          <h3>Players List</h3>
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
        </div>
        <div className="list player-grid">
          {sortedPlayers.map(({ id: memberId, status, stats }) => (
          <button
            key={memberId}
            className={`row row-table row-skill queue-player-card ${status} ${
              manualPickIds.includes(memberId) ? 'queue-player-selected' : ''
            } ${skillBorderClass(memberById[memberId].skill)}`}
            disabled={status === 'queueing'}
            onClick={() => {
              if (status !== 'queueing') {
                onToggleManualPick(memberId)
              }
            }}
          >

            <div className="queue-player-top">
              <strong>{memberById[memberId].name}</strong>

              <span className="queue-player-stats">                
                  G:{stats.gamesPlayed}  W:{stats.wins}
                  {stats.missedGames > 0 ? `  M:${stats.missedGames}` : ''}
              </span>
            </div>

            <div className="queue-player-bottom">
              <span className="compact-skill">
                {memberById[memberId].skill}
              </span>

              <span className="queue-player-time">
                {status === 'playing'
                    ? 'In Game'
                    : formatWaitingTime(stats.waitingSince)}
              </span>
            </div>
            </button>
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
          <div className="modern-result-sheet">

            <div className="result-meta">
              <h4>{resultModal.courtLabel}</h4>

              <span>
                {formatElapsed(resultModal.startedAt)}
              </span>
            </div>

            <div className="result-team team-a-result">
              <div className="result-team-players">
                <strong>
                  {memberById[resultModal.teamA[0]]?.name ?? 'Player1'}
                </strong>

                <span>
                  {memberById[resultModal.teamA[1]]?.name ?? 'Player2'}
                </span>
              </div>

              <div className="score-controls">
                <button
                  type="button"
                  className="score-btn"
                  onClick={() =>
                    setResultModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            scoreA: Math.max(0, prev.scoreA - 1),
                          }
                        : prev,
                    )
                  }
                >
                  −
                </button>

                <input
                  type="number"
                  min={0}
                  value={resultModal.scoreA}
                  onChange={(event) =>
                    setResultModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            scoreA: Number(event.target.value) || 0,
                          }
                        : prev,
                    )
                  }
                />

                <button
                  type="button"
                  className="score-btn"
                  onClick={() =>
                    setResultModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            scoreA: prev.scoreA + 1,
                          }
                        : prev,
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>

            <div className="result-vs">
              VS
            </div>

            <div className="result-team team-b-result">
              <div className="result-team-players">
                <strong>
                  {memberById[resultModal.teamB[0]]?.name ?? 'Player1'}
                </strong>

                <span>
                  {memberById[resultModal.teamB[1]]?.name ?? 'Player2'}
                </span>
              </div>

              <div className="score-controls">
                <button
                  type="button"
                  className="score-btn"
                  onClick={() =>
                    setResultModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            scoreB: Math.max(0, prev.scoreB - 1),
                          }
                        : prev,
                    )
                  }
                >
                  −
                </button>

                <input
                  type="number"
                  min={0}
                  value={resultModal.scoreB}
                  onChange={(event) =>
                    setResultModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            scoreB: Number(event.target.value) || 0,
                          }
                        : prev,
                    )
                  }
                />

                <button
                  type="button"
                  className="score-btn"
                  onClick={() =>
                    setResultModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            scoreB: prev.scoreB + 1,
                          }
                        : prev,
                    )
                  }
                >
                  +
                </button>
              </div>
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
      
      {manualPickIds.length === 4 && (
        <button
          className="floating-match-btn primary"
          onClick={onQueueManualRoster}
        >
          Create Match
        </button>
      )}
    </section>
      
  )
}
