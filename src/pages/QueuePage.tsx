import { getSessionSkill, getSessionSkillLabel, skillBorderClass } from '../lib/skillDisplay'
import { getEloRating, getQueueSkill } from '../lib/eloRatings'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '../components/Modal'
import type { Member, MemberStats, Session } from '../types/app'
import { TrophyIcon, FlagIcon, TrashIcon, BoltIcon, ArrowPathRoundedSquareIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { Timer, Watch } from 'lucide-react'
import { toast } from 'sonner'
import { WinLoseStackView } from './WinLoseStackView'
import { MatchScoringInspector } from '../components/MatchScoringInspector'
import { getCurrentBenchWait, getTotalGames } from '../lib/queueSession'
import { calculateWaitingScore } from '../lib/smartQueueScoring'

type QueuePageProps = {
  session: Session
  memberById: Record<string, Member>
  playersSort: 'queue' | 'waitingTime' | 'totalGames' | 'skill' | 'name'
  manualPickIds: string[]
  onChangePlayersSort: (
    value: 'queue' | 'waitingTime' | 'totalGames' | 'skill' | 'name',
  ) => void
  onAddCourt: () => void
  onRemoveCourt: (courtId: string) => void
  onRenameCourt: (courtId: string, name: string) => void
  onEndMatch: (courtId: string, scoreA: number, scoreB: number) => void
  forfeitMatch: (courtId: string) => void

  onGenerateRoster: () => void
  onQueueManualRoster: () => void
  onAssignToCourt: (rosterId: string, courtId?: string) => void
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
  onAssignStackMatchToCourt: (matchId: string | null, courtId: string, playerIds: string[]) => void
  onPrioritizeStackMatch: (playerIds: string[]) => void
  onSkipStackPlayer: (playerId: string) => void
  onCreateStackManualMatch: () => void
  onDissolveStackManualMatch: (matchId: string) => void
  onShuffleStackTeams: () => void
}

export function QueuePage({
  session,
  memberById,
  playersSort,
  manualPickIds,
  onChangePlayersSort,
  onAddCourt,
  onRemoveCourt,
  onRenameCourt,
  onEndMatch,
  forfeitMatch,

  onGenerateRoster,
  onQueueManualRoster,
  onAssignToCourt,
  onDissolveRoster,
  onReplaceRosterPlayer,
  onToggleManualPick,
  getSessionPlayerStatus,
  onShuffleRoster,
  buildQueueList,
  onAssignStackMatchToCourt,
  onPrioritizeStackMatch,
  onSkipStackPlayer,
  onCreateStackManualMatch,
  onDissolveStackManualMatch,
  onShuffleStackTeams,
}: QueuePageProps) {
  const queuePanelRef = useRef<HTMLElement>(null)
  const [drawConfirmationOpen, setDrawConfirmationOpen] = useState(false)

  useEffect(() => {
    const panel = queuePanelRef.current
    const grid = panel?.querySelector<HTMLElement>(':scope > .court-grid')
    if (!panel || !grid) return

    const desktop = window.matchMedia('(min-width: 761px)')
    const scrollRosters = (event: WheelEvent) => {
      if (!desktop.matches || event.defaultPrevented || !event.cancelable ||
          event.ctrlKey || event.shiftKey || !event.deltaY ||
          Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return

      const maxScroll = grid.scrollWidth - grid.clientWidth
      if (maxScroll <= 0 || (event.deltaY < 0 && grid.scrollLeft <= 0) ||
          (event.deltaY > 0 && grid.scrollLeft >= maxScroll - 1)) return

      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? grid.clientWidth
        : 1
      event.preventDefault()
      grid.scrollLeft += event.deltaY * unit
    }

    panel.addEventListener('wheel', scrollRosters, { passive: false })
    return () => panel.removeEventListener('wheel', scrollRosters)
  }, [session.matchmakingMode])

  if (session.matchmakingMode === 'win-lose-stack') {
    return <WinLoseStackView
      session={session}
      memberById={memberById}
      manualPickIds={manualPickIds}
      onToggleManualPick={onToggleManualPick}
      onCreateManualMatch={onCreateStackManualMatch}
      onDissolveManualMatch={onDissolveStackManualMatch}
      onAssignMatch={onAssignStackMatchToCourt}
      onPrioritizeMatch={onPrioritizeStackMatch}
      onSkipPlayer={onSkipStackPlayer}
      onShuffleTeams={onShuffleStackTeams}
      onAddCourt={onAddCourt}
      onRemoveCourt={onRemoveCourt}
      onRenameCourt={onRenameCourt}
      onEndMatch={onEndMatch}
    />
  }
  const [clock, setClock] = useState(() => Date.now())
  const isQueueEnded = Boolean(session.endedAt)
  const isQueueStarted = Boolean(session.startedAt)
  const now = session.endedAt ?? clock
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
  const [courtSelectionModal, setCourtSelectionModal] = useState<{
    rosterId: string
    availableCourts: string[]
  } | null>(null)
  
  const [forfeitModal, setForfeitModal] = useState<{
    courtId: string
    courtName: string
    teamA:string[]
    teamB:string[]
  } | null>(null)


  const getVacantCourts = () => {
    return session.courts.filter(
      (court) => court.teamA.length === 0 && court.teamB.length === 0
    ).map(c => c.id)
  }
  const activeCount =
  session.courts.length - getVacantCourts().length

  const handlePlayClick = (rosterId: string) => {
    if (!isQueueStarted) {
      toast.warning('Please start the queue before sending players to a court.')
      return
    }

    const vacantCourts = getVacantCourts()
    if (vacantCourts.length >= 2) {
      setCourtSelectionModal({
        rosterId,
        availableCourts: vacantCourts,
      })
    } else if (vacantCourts.length === 1) {
      onAssignToCourt(rosterId)
    }
  }

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
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
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


  const formatDurationMs = (durationMs?: number,): string => {
    if (!durationMs) return '00:00'
    const minutes = String(Math.floor(durationMs / 60000)).padStart(2, '0')
    const seconds = String(Math.floor((durationMs % 60000) / 1000,),).padStart(2, '0')
    return `${minutes}:${seconds}`
  }
  const getFairnessScore = (memberId: string) => {
    if (!session.startedAt) return 0
    return calculateWaitingScore(getCurrentWaitMs(memberId), session.stats[memberId].averageWaitMs ?? 0)
  }
  const getSkillScore = (skill: Member['skill']) => {
    switch (skill) {
      case 'Newbie':
        return 1
      case 'Beginner':
        return 2
      case 'Low Intermediate':
        return 3
      case 'Intermediate':
        return 4
      case 'High Intermediate':
        return 5
      case 'Advanced':
        return 6
      case 'Elite':
        return 7
      default:
        return '?'
    }
  }

  const getTeamSkillTotal = (playerIds: string[]) =>
    playerIds.reduce((total, memberId) => {
      const member = memberById[memberId]

      if (!member) {
        return total
      }

      return total + getQueueSkill(session, member)
    }, 0)

  const getCurrentWaitMs = (id: string) =>
    getCurrentBenchWait(session, id, now, getSessionPlayerStatus(id, session) === 'playing')

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

      if (playersSort === 'waitingTime') {
        const waitDifference = getCurrentWaitMs(b.id) - getCurrentWaitMs(a.id)
        return waitDifference || memberById[a.id].name.localeCompare(memberById[b.id].name)
      }

      if (playersSort === 'skill') {
        return (
          getQueueSkill(session, memberById[b.id]) - getQueueSkill(session, memberById[a.id])
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
  const inGameCount = sortedPlayers.filter(
    ({ status }) => status === 'playing'
  ).length

  const queueCount = sortedPlayers.filter(
    ({ status }) => status === 'queueing'
  ).length

  const waitingCount = sortedPlayers.filter(
    ({ status }) => status === 'waiting'
  ).length
  const totalPlayers = sortedPlayers.length

  return (
    <>
    <section className="queue-layout">
      <article className="card courts-panel">
        <header className="court-header">
          <div className="court-header-info">
            <h3 className="court-title">Courts</h3>

            <span className="court-badge court-badge-active">
              {activeCount} in play
            </span>

            <span className="court-badge court-badge-open">
              {session.courts.length - activeCount} open
            </span>
          </div>

          <button
            onClick={onAddCourt}
            className="court-add-button"
            disabled={isQueueEnded}
          >
            <svg xmlns="http://www.w3.org/2000/svg" 
            height="24px" 
            viewBox="0 -960 960 960" 
            width="24px" fill="#ffffff">
            <path d="M520-320h200v-320H520v320Zm-280 0h200v-320H240v320Zm520-320v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80ZM160-240v-480 480Zm720-320v320q0 33-23.5 56.5T800-160H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h440v80H160v480h640v-320h80Z"/>
          </svg>
          </button>
        </header>

        <div className="court-grid">
          {session.courts.map((court, idx) => {
            const active = court.teamA.length > 0 || court.teamB.length > 0
            return (
            <div key={court.id}             
              className={`court ${
                court.teamA.length > 0 ? 'court-active' : ''
              }`}>
              <div className="court-card-header">
                <input
                  className="court-name-input"
                  aria-label={`Court ${idx + 1} name`}
                  value={court.name}
                    onChange={(event) => onRenameCourt(court.id, event.target.value)}
                  disabled={isQueueEnded}
                  onBlur={(event) =>
                    onRenameCourt(
                      court.id,
                      event.target.value.trim() || `Court ${idx + 1}`,
                    )
                  }
                />
                {active ? (
                    <span className="live-badge">
                      <span className="live-dot"></span>
                    LIVE
                  </span>
                ) : (
                  <button
                    onClick={() => onRemoveCourt(court.id)}
                    aria-label="Remove court"
                    className="court-remove-button"
                    disabled={isQueueEnded}
                  >
                    <TrashIcon width={16} height={16}  className="court-remove-icon" />
                  </button>
                )}
              </div>
              {court.teamA.length === 0 ? (
                <p className="court-status-open">Available — assign a match</p>
              ) : (
                <>
                  <div className="court-time-row">
                    <span>
                      ⏱ {formatElapsed(court.startedAt)}
                    </span>
                    <span>
                      ▶︎ <strong>{formatClock(court.startedAt ?? now)}</strong>
                    </span>

                  </div>
                  <div className="court-match">
                    <div className="court-team">
                      <strong>{memberById[court.teamA[0]]?.name}</strong>
                      <span>{memberById[court.teamA[1]]?.name}</span>
                    </div>

                    <div className="court-vs">
                      vs
                    </div>

                    <div className="court-team ">
                      <strong>{memberById[court.teamB[0]]?.name}</strong>
                      <span>{memberById[court.teamB[1]]?.name}</span>
                    </div>
                  </div>
                  <div className="court-actions">
                    
                    <button
                      className="forfeit-btn"
                      disabled={isQueueEnded}
                      onClick={() => {
                        setForfeitModal({
                          courtId: court.id,
                          courtName: court.name ?? 
                          `Court ${session.courts.findIndex((c) => c.id === court.id) + 1}`,
                          teamA: [...court.teamA],
                          teamB: [...court.teamB],
                        })
                      }}
                    >
                      <FlagIcon width={16} height={16} />
                      <span className="button-label">Forfeit</span>
                    </button>
                    <button className="end-match-btn"
                      disabled={isQueueEnded}
                      onClick={() =>
                        setResultModal({
                          courtId: court.id,
                          courtLabel: court.name || `Court ${idx + 1}`,
                          startedAt: court.startedAt,
                          teamA: [...court.teamA],
                          teamB: [...court.teamB],
                          scoreA: 0,
                          scoreB: 0,
                        })
                      }>
                      <TrophyIcon width={16} height={16} />
                      <span className="button-label">End Match</span>
                    </button>

                  </div>
                </>
              )}
            </div>
          )})}
        </div>
      </article>

      <article ref={queuePanelRef} className="card queue-panel">
        <header className="matchmaking-header">
          <div className="matchmaking-header-info">
            <h2 className="matchmaking-title">Match Making</h2>

            <span className="matchmaking-badge">
              {session.rosters.length} queued
            </span>
          </div>

        </header>
        <div className="court-grid">
          {session.rosters.map((roster, idx) => {
            const teamAIds = roster.playerIds.slice(0, 2)
            const teamBIds = roster.playerIds.slice(2, 4)

            const skillA = getTeamSkillTotal(teamAIds)
            const skillB = getTeamSkillTotal(teamBIds)

            const diff = Math.abs(skillA - skillB)
            const balanced = diff <= 1

            return (
            <div
              key={roster.id}
              className={`queue-card ${
                balanced
                  ? "queue-card-balanced"
                  : "queue-card-unbalanced"
              }`}
            >
              <div className="queue-header">
                <strong>Queue {idx + 1}</strong>

                <span
                  className={
                    balanced
                      ? "queue-balance queue-balance-good"
                      : "queue-balance queue-balance-warning"
                  }
                >
                  {balanced ? "Balanced" : `+${diff} Gap`}
                </span>
              </div>
                          
              <div className="compact-roster-lines">
                <div className="roster-line team-a">
                  <div className="roster-team-players">
                    {teamAIds.map((memberId, slotIndex) => (
                      <button
                        key={`${roster.id}-${memberId}-${slotIndex}`}
                        className="link-btn compact-roster-player"
                        disabled={isQueueEnded}
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
                  <span className="team-skill-total" title={session.matchmakingMode === 'elo-smart-queue' ? 'Team Elo rating total' : 'Team skill total'}>
                    {getTeamSkillTotal(teamAIds)}
                  </span>
                </div>

                <div className="roster-line team-b">
                  <div className="roster-team-players">
                    {teamBIds.map((memberId, slotIndex) => (
                      <button
                        key={`${roster.id}-${memberId}-${slotIndex + 2}`}
                        className="link-btn compact-roster-player"
                        disabled={isQueueEnded}
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
                  <span className="team-skill-total" title={session.matchmakingMode === 'elo-smart-queue' ? 'Team Elo rating total' : 'Team skill total'}>
                    {getTeamSkillTotal(teamBIds)}
                  </span>
                </div>
              </div>
              {/* Buttons */}
              <div className="row-actions">
                
                <button
                  className="queue-action-btn"
                  disabled={isQueueEnded}
                  onClick={() => onShuffleRoster(roster.id)}
                >
                  <ArrowPathRoundedSquareIcon width={16} height={16}/>
                </button>
                <button
                  className="queue-action-btn danger"
                  disabled={isQueueEnded}
                  onClick={() => onDissolveRoster(roster.id)}
                >
                  <TrashIcon width={16} height={16}/>
                </button>
                <button
                  className="queue-play-btn"
                  disabled={isQueueEnded}
                  onClick={() => handlePlayClick(roster.id)}
                >
                  <PaperAirplaneIcon width={16} height={16}/>
                  <span className="button-label">Send to Court</span>
                </button>
                
              </div>
            </div>
            )
          })}
        </div>
        
      </article>

      <article className="card players-panel">
        
        <div className="players-header">
          <div className="players-header-top">
            <div className="players-title-group">
              <h3>
                Players
                <span className="players-count">
                  {totalPlayers}
                </span>
              </h3>
              
            </div>
            <select
              value={playersSort}
              onChange={(e) => onChangePlayersSort(e.target.value as typeof playersSort)}
            >
              <option value="queue">Current Queue</option>
              <option value="waitingTime">Waiting Time</option>
              <option value="name">Name</option>
              <option value="totalGames">Total Games</option>
              <option value="skill">{session.matchmakingMode === 'elo-smart-queue' ? 'Elo Rating' : 'Skill Level'}</option>
            </select>
          </div>

          <div className="players-summary"> 
            <span className="status-badge status-badge-playing">
              {inGameCount} In Game
            </span>

            <span className="status-badge status-badge-queue">
              {queueCount} Queued
            </span>

            <span className="status-badge status-badge-waiting">
              {waitingCount} Waiting
            </span>
          </div>
            
            
          <div className="actions generate-row">            
            <button
              onClick={onGenerateRoster}
              className="matchmaking-generate-btn"
              disabled={isQueueEnded}
            >
              <BoltIcon className="matchmaking-btn-icon" />
              <span className="matchmaking-btn-label">
                Generate Match
              </span>
            </button>
          </div>
          
        </div>
        <div className="list player-grid">
          {sortedPlayers.map(({ id: memberId, status, stats }) => {
            const pickIndex = manualPickIds.indexOf(memberId)

            let manualPickClass = ''
            if (pickIndex >= 0) {
              manualPickClass =
                pickIndex < 2
                  ? 'queue-player-selected-team-a'
                  : 'queue-player-selected-team-b'
            }

            return (
              <button
                key={memberId}
                className={`row row-table row-skill queue-player-card ${status} ${manualPickClass} ${skillBorderClass(getSessionSkill(session, memberById[memberId]))}`}
                disabled={isQueueEnded || status === 'queueing'}
                onClick={() => {
                  if (status !== 'queueing') {
                    onToggleManualPick(memberId)
                  }
                }}
              >
                <div className="queue-player-top">
                  <strong>
                    {memberById[memberId].name} - {session.matchmakingMode === 'elo-smart-queue' ? '' : 'S'}
                    {session.matchmakingMode === 'elo-smart-queue' ? getEloRating(session, memberId).toFixed(1) : getSkillScore(memberById[memberId].skill)}
                  </strong>

                  <span className="queue-player-score">
                    {pickIndex >= 0 ? (
                      <span
                        className={`queue-selected-badge ${
                          pickIndex < 2
                            ? 'queue-selected-badge-team-a'
                            : 'queue-selected-badge-team-b'
                        }`}
                      >
                        {pickIndex < 2 ? 'Team A' : 'Team B'}
                      </span>
                    ) : status === 'playing' ? (
                      ''
                    ) : (
                      <>
                        <Watch size={16} />
                        {Math.round(getFairnessScore(memberId) / 60000)}
                      </>
                    )}
                  </span>
                </div>

                <div className="queue-player-bottom">
                  <span className="queue-player-stats">
                    G:{stats.gamesPlayed} W:{stats.wins}
                    {stats.missedGames > 0 ? ` M:${stats.missedGames}` : ''}
                  </span>

                  <span className="queue-player-time">
                    {status === 'playing' ? (
                      'In Game'
                    ) : (
                      <>
                        <Timer size={14} />
                        {formatDurationMs(getCurrentWaitMs(memberId))}
                      </>
                    )}
                  </span>
                </div>
              </button>
            )
          })}
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
              const usedInRoster = session.rosters.some(
                (roster) => roster.playerIds.includes(memberId),
              )
              return memberId === replaceModal?.currentMemberId || !usedInRoster
            })
            .sort((a, b) =>
              (memberById[a]?.name ?? '').localeCompare(memberById[b]?.name ?? ''),
            )
            .map((memberId) => (
              <button
                key={memberId}
                className={`replace-player-btn ${
                  memberId === replaceModal?.currentMemberId
                    ? 'replace-player-btn-selected'
                    : ''
                }`}
                onClick={() => {
                  if (!replaceModal) return

                  onReplaceRosterPlayer(
                    replaceModal.rosterId,
                    replaceModal.slotIndex,
                    memberId,
                  )

                  setReplaceModal(null)
                }}
              >
              <>
              <span className="replace-player-info">
                <span
                  className={`skill-dot ${skillBorderClass(getSessionSkill(session, memberById[memberId]))}`}
                />

                <span className="replace-player-name">
                  {memberById[memberId]?.name ?? 'Unknown'}
                </span>
              </span>

              <span className="replace-player-skill">
                {memberById[memberId] ? getSessionSkillLabel(session, memberById[memberId]) : ''}
              </span>
            </>
              </button>
            ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(resultModal) && !drawConfirmationOpen}
        title="Game Result"
        onClose={() => setResultModal(null)}
        footer={
          <>
            <button onClick={() => setResultModal(null)}>Cancel</button>
            <button
              className="primary"
              onClick={() => {
                if (!resultModal) return
                if (resultModal.scoreA === resultModal.scoreB) {
                  setDrawConfirmationOpen(true)
                  return
                }
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
                  value={resultModal.scoreA === 0 ? '' : resultModal.scoreA}
                  placeholder="0"
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
                  value={resultModal.scoreB === 0 ? '' : resultModal.scoreB}
                  placeholder="0"
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

      <Modal
        open={Boolean(resultModal) && drawConfirmationOpen}
        title="Confirm Draw"
        onClose={() => setDrawConfirmationOpen(false)}
        footer={
          <>
            <button onClick={() => setDrawConfirmationOpen(false)}>No</button>
            <button
              className="primary"
              onClick={() => {
                if (!resultModal) return
                onEndMatch(resultModal.courtId, resultModal.scoreA, resultModal.scoreB)
                setDrawConfirmationOpen(false)
                setResultModal(null)
              }}
            >
              Yes
            </button>
          </>
        }
      >
        <p>Are you sure this match is a Draw?</p>
      </Modal>

      <Modal
        open={Boolean(courtSelectionModal)}
        title="Select Court"
        onClose={() => setCourtSelectionModal(null)}
      >
        <div className="list">
          {courtSelectionModal?.availableCourts.map((courtId) => {
            const court = session.courts.find((c) => c.id === courtId)
            return (
              <button
                key={courtId}
                className="row"
                onClick={() => {
                  if (!courtSelectionModal) return
                  onAssignToCourt(courtSelectionModal.rosterId, courtId)
                  setCourtSelectionModal(null)
                }}
              >
                <span>{court?.name ?? 'Unknown Court'}</span>
              </button>
            )
          })}
        </div>
      </Modal>
      
      {manualPickIds.length > 0 && (
        <div className="floating-selection-panel">
          {manualPickIds.length < 4 ? (
            <span className="selection-count">
              Players Selected {manualPickIds.length}/4
            </span>
          ) : (
            <button
              className="floating-match-btn primary"
              disabled={isQueueEnded}
              onClick={onQueueManualRoster}
            >
              Create Manual Match
            </button>
          )}
        </div>
      )}
      <Modal
        open={Boolean(forfeitModal)}
        title="Forfeit Match?"
        onClose={() => setForfeitModal(null)}
        footer={
          <>
            <button onClick={() => setForfeitModal(null)}>
              Cancel
            </button>

            <button
              className="danger"
              onClick={() => {
                if (!forfeitMatch) return

                forfeitMatch(forfeitModal!.courtId)

                setForfeitModal(null)
              }}
            >
              Forfeit
            </button>
          </>
        }
      >
        <p>Forfeit the match on "{forfeitModal?.courtName}"?</p>

        <p>
          <strong>Team A</strong>
          <br />
          {forfeitModal?.teamA
            .map((id) => memberById[id]?.name ?? id)
            .join(', ')}
        </p>

        <p>
          <strong>Team B</strong>
          <br />
          {forfeitModal?.teamB
            .map((id) => memberById[id]?.name ?? id)
            .join(', ')}
        </p>

        <p>This will immediately end the current match.</p>
      </Modal>
    </section>
    {import.meta.env.DEV && (
      <MatchScoringInspector
        key={session.id}
        sessionId={session.id}
        snapshots={session.scoringSnapshots}
      />
    )}
    </>
      
  )
}
