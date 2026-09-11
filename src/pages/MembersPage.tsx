import { useMemo, useState, type FormEvent } from 'react'
import { Modal, ModalForm } from '../components/Modal'
import { skillOrder, type Member, type Session, type Skill } from '../types/app'
import { toast } from 'sonner'

type MembersPageProps = {
  session: Session
  memberById: Record<string, Member>
  clubMembers: Member[]
  onMoveToPlaying: (memberId: string) => void
  onResign: (memberId: string) => void
  onSetParticipant: (memberId: string, isParticipant: boolean) => void
  onAddVisitors: (names: string[], defaultSkill?: Skill) => void
  onEditVisitor: (visitorId: string, name: string, skill: Skill) => void
  onDeleteVisitor: (visitorId: string) => void
  onStartQueue: () => void
  onEndQueue: (endedAt?: number) => void
}

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

const skillColor = (skill: Skill) =>
  ({
    Newbie: '#d1d5db',
    Beginner: '#fde047',
    'Low Intermediate': '#22c55e',
    Intermediate: '#3b82f6',
    'High Intermediate': '#8b5cf6',
    Advanced: '#ef4444',
    Elite: '#111827',
  })[skill]

const PlayerActionIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '15px', height: '15px' }}>
    <path d="M10 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM16.25 5.75a.75.75 0 0 0-1.5 0v2h-2a.75.75 0 0 0 0 1.5h2v2a.75.75 0 0 0 1.5 0v-2h2a.75.75 0 0 0 0-1.5h-2v-2Z" />
  </svg>
)

const ResignIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '15px', height: '15px' }}>
    <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2.046 15.253c-.058.468.172.92.57 1.175A9.953 9.953 0 0 0 8 18c1.982 0 3.83-.578 5.384-1.573.398-.254.628-.707.57-1.175a6.001 6.001 0 0 0-11.908 0ZM12.75 7.75a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z" />
  </svg>
)
const ExitIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"  style={{ width: '20px', height: '20px' }}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
</svg>
)
const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
</svg>

)

export function MembersPage({ session, memberById, clubMembers, onMoveToPlaying, onResign, onSetParticipant, onAddVisitors, onEditVisitor, onDeleteVisitor, onStartQueue, onEndQueue }: MembersPageProps) {
  const [visitorModalOpen, setVisitorModalOpen] = useState(false)
  const [clubMembersOpen, setClubMembersOpen] = useState(false)
  const [visitorText, setVisitorText] = useState('')
  const [editingVisitor, setEditingVisitor] = useState<Member | null>(null)
  const [visitorDeleteModal, setVisitorDeleteModal] = useState<Member | null>(null)
  const [resignModal, setResignModal] = useState<{ memberId: string; label: string } | null>(null)
  const [endQueueCheckOpen, setEndQueueCheckOpen] = useState(false)
  const [endQueueConfirmOpen, setEndQueueConfirmOpen] = useState(false)
  const [participantSort, setParticipantSort] = useState<'name' | 'status'>('name')

  const isQueueEnded = Boolean(session.endedAt)
  const isQueueStarted = Boolean(session.startedAt)
  const hasActiveCourt = session.courts.some((court) => court.teamA.length > 0 || court.teamB.length > 0)
  const hasPendingQueue = session.rosters.length > 0
  const participantIds = session.participantIds ?? []
  const visitors = session.visitors ?? []
  const visitorIds = new Set(visitors.map((visitor) => visitor.id))
  const memberParticipantCount = participantIds.filter((id) => !visitorIds.has(id)).length
  const clubMemberIds = useMemo(
    () => [...clubMembers].sort((a, b) => a.name.localeCompare(b.name)).map((member) => member.id),
    [clubMembers],
  )
  const statusFor = (memberId: string) => {
    if (session.playingIds.includes(memberId)) return 'Playing'
    if ((session.stats[memberId]?.gamesPlayed ?? 0) > 0) return `Resting (${session.stats[memberId].gamesPlayed})`
    return 'Not arrived'
  }
  const sortedParticipantIds = [...participantIds].sort((a, b) => {
    if (participantSort === 'status') {
      const statusRank = (memberId: string) => {
        if (session.playingIds.includes(memberId)) return 0
        if ((session.stats[memberId]?.gamesPlayed ?? 0) > 0) return 1
        return 2
      }
      const statusComparison = statusRank(a) - statusRank(b)
      if (statusComparison !== 0) return statusComparison
    }
    return memberById[a].name.localeCompare(memberById[b].name)
  })
  const queueStatusLabel = session.endedAt ? 'Ended' : session.startedAt ? 'Started' : 'Not Started'
  const queueHeaderClass = session.endedAt ? 'queue-session-header queue-session-header-ended' : session.startedAt ? 'queue-session-header queue-session-header-started' : 'queue-session-header queue-session-header-not-started'

  const handleEndQueuePreCheck = () => {
    if (hasActiveCourt || hasPendingQueue) {
      toast.error('Failed to End Queue Session, make sure Courts are empty and there is no pending Queue.')
      setEndQueueCheckOpen(false)
      return
    }
    setEndQueueCheckOpen(false)
    setEndQueueConfirmOpen(true)
  }
  const submitVisitors = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const lines = visitorText.split('\n').map((line) => line.trim()).filter(Boolean)
    if (!lines.length) return
    onAddVisitors(lines, 'Intermediate')
    setVisitorText('')
    setVisitorModalOpen(false)
  }
  const renderMoveToPlayingButton = (memberId: string) => (
    <button className="play small participant-action" disabled={isQueueEnded} onClick={() => onMoveToPlaying(memberId)} title="Play" aria-label="Play">
      <PlayIcon/>
    </button>
  )

  return (
    <section className="members-page">
      <article className="card queue-session-card">
        <div className={queueHeaderClass}>
          <div>
            <span className="queue-session-label">Queue Session</span>
            <div className="queue-session-title-row">
              <h3>{session.name ?? 'Current Queue'}</h3>
              <span className="queue-session-member-count">{participantIds.length} participants</span>
            </div>
          </div>
          <span className="queue-session-status">{queueStatusLabel}</span>
        </div>
        <div className="queue-session-stats">
          <div>
            <strong>{session.playingIds.length}</strong>
            <span>Playing</span>
          </div>
          <div>
            <strong>{participantIds.filter((id) => !session.playingIds.includes(id) && (session.stats[id]?.gamesPlayed ?? 0) > 0).length}</strong>
            <span>Resting</span>
          </div>
          <div>
            <strong>{participantIds.filter((id) => !session.playingIds.includes(id) && (session.stats[id]?.gamesPlayed ?? 0) === 0).length}</strong>
            <span>Not arrived</span>
          </div>
        </div>
        <div className="queue-session-actions">
          {isQueueStarted ? 
          <button className="danger small" onClick={() => setEndQueueCheckOpen(true)} disabled={isQueueEnded}>{session.endedAt ? 'Queue Ended' : 'End Queue'}</button> : 
          <button className="primary small" onClick={onStartQueue} disabled={isQueueEnded}>Start Queue</button>}
        </div>
      </article>

      <article className="card member-section-card">
        <div className="member-card-header">
          <h4>Participants ({participantIds.length})</h4>
          <div className="member-card-actions">
            <select value={participantSort} onChange={(event) => setParticipantSort(event.target.value as 'name' | 'status')}>
              <option value="name">Name</option>
              <option value="status">Status</option></select>
              <button className="primary small" onClick={() => setClubMembersOpen(true)}>Manage</button>
            </div>
          </div>
        {visitors.length > 0 && (
          <p className="participant-breakdown">
            Members {memberParticipantCount}, Visitors {visitors.length}
          </p>
        )}
        <div className="list">{sortedParticipantIds.length ? sortedParticipantIds.map((memberId) => {
          const status = statusFor(memberId)
          const isPlaying = session.playingIds.includes(memberId)
          const isResting = !isPlaying && (session.stats[memberId]?.gamesPlayed ?? 0) > 0
          return <div key={memberId} className={`row row-skill ${skillBorderClass(memberById[memberId].skill)} ${isPlaying ? 'participant-playing' : isResting ? 'participant-resting' : ''}`}><div className="compact-player-row"><strong>{memberById[memberId].name}</strong><div className="compact-player-meta"><span className="compact-skill" style={{ color: skillColor(memberById[memberId].skill) }}>{memberById[memberId].skill}</span><span className={`compact-stats participant-status ${isPlaying ? 'participant-status-playing' : isResting ? 'participant-status-resting' : 'participant-status-not-arrived'}`}>{status}</span></div>{isPlaying ? <button className="danger small participant-action" disabled={isQueueEnded} onClick={() => setResignModal({ memberId, label: memberById[memberId].name })} title="Exit" aria-label="Exit"><ExitIcon /></button> : renderMoveToPlayingButton(memberId)}</div></div>
        }) : <p className="subtle">No participants yet. Select club members with Manage.</p>}</div>
      </article>

      <article className="card member-section-card">
        <div className="member-card-header">
          <h4>Visitors ({visitors.length})</h4>
          <button className="primary small" disabled={isQueueEnded} onClick={() => { setVisitorText(''); setVisitorModalOpen(true) }}>Add Visitors</button>
        </div>
        {visitors.length ? (
          <div className="club-member-list visitor-list">
            {visitors.map((visitor) => {
              const isEditing = editingVisitor?.id === visitor.id
              return (
                <div key={visitor.id} className={`club-member-card ${skillBorderClass(visitor.skill)}`}>
                  <div className="club-member-info">
                    {isEditing ? (
                      <>
                        <input
                          className="club-member-inline-input"
                          value={editingVisitor.name}
                          onChange={(event) => setEditingVisitor({ ...editingVisitor, name: event.target.value })}
                        />
                        <select
                          className="club-member-inline-skill"
                          value={editingVisitor.skill}
                          onChange={(event) => setEditingVisitor({ ...editingVisitor, skill: event.target.value as Skill })}
                        >
                          {skillOrder.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
                        </select>
                      </>
                    ) : (
                      <>
                        <p className="club-member-name">{visitor.name}</p>
                        <p className="club-member-skill" style={{ color: skillColor(visitor.skill) }}>{visitor.skill}</p>
                      </>
                    )}
                  </div>
                  <div className="club-card-actions club-member-actions">
                    {isEditing ? (
                      <>
                        <button className="club-action-button club-action-save" onClick={() => { onEditVisitor(visitor.id, editingVisitor.name, editingVisitor.skill); setEditingVisitor(null) }} disabled={!editingVisitor.name.trim()}>Save</button>
                        <button className="club-action-button club-action-cancel" onClick={() => setEditingVisitor(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="club-action-button club-action-edit" onClick={() => setEditingVisitor(visitor)}>Edit</button>
                        <button className="club-action-button club-action-delete" onClick={() => setVisitorDeleteModal(visitor)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : <p className="subtle">No visitors added for this session.</p>}
      </article>

      <Modal
        open={clubMembersOpen}
        title={`Club Members (${session.playingIds.length} playing)`}
        onClose={() => setClubMembersOpen(false)}
        footer={
          <div className="club-members-modal-footer">
            <button onClick={() => setClubMembersOpen(false)}>Done</button>
          </div>
        }
      >
        <div className="list">{clubMemberIds.map((memberId) => {
          const selected = participantIds.includes(memberId)
          return <div key={memberId} className={`row row-skill ${skillBorderClass(memberById[memberId].skill)} ${selected ? 'participant-playing' : ''}`}>
            <div className="compact-player-row">
              <strong>{memberById[memberId].name}</strong>
              <div className="compact-player-meta">
                <span className="compact-skill" style={{ color: skillColor(memberById[memberId].skill) }}>{memberById[memberId].skill}</span>
              </div>
              <button className={selected ? 'danger small' : 'play small'} disabled={isQueueEnded} onClick={() => onSetParticipant(memberId, !selected)} title={selected ? 'Remove participant' : 'Make participant'}>{selected ? <ResignIcon /> : <PlayerActionIcon />}</button>
              </div>
            </div>
        })}</div>
      </Modal>

      <ModalForm open={visitorModalOpen} title="Add Visitors" onClose={() => setVisitorModalOpen(false)} onSubmit={submitVisitors} submitLabel="Add Visitors"><label className="field">One visitor per line<div className="bulk-help">Add a skill number after the name: 1-Newbie | 2-Beginner | 3-Low Intermediate | 4-Intermediate | 5-High Intermediate | 6-Advanced | 7-Elite. | No number defaults to Intermediate.</div><textarea className="bulk-textarea" value={visitorText} onChange={(event) => setVisitorText(event.target.value)} placeholder={'Anthony 3\nBawaw 5\nJohn'} required /></label></ModalForm>
      <Modal open={Boolean(visitorDeleteModal)} title="Delete Visitor?" onClose={() => setVisitorDeleteModal(null)} footer={<><button onClick={() => setVisitorDeleteModal(null)}>Cancel</button><button className="danger" onClick={() => { if (!visitorDeleteModal) return; onDeleteVisitor(visitorDeleteModal.id); setVisitorDeleteModal(null) }}>Delete</button></>}><p>Remove "{visitorDeleteModal?.name}" from this session?</p></Modal>
      <Modal open={Boolean(resignModal)} title="Exit Player?" onClose={() => setResignModal(null)} footer={<><button onClick={() => setResignModal(null)}>Cancel</button><button className="danger" disabled={isQueueEnded} onClick={() => { if (!resignModal) return; onResign(resignModal.memberId); setResignModal(null) }}>Exit</button></>}><p>Remove "{resignModal?.label}" from the playing list? They will remain a participant.</p></Modal>
      <Modal open={endQueueCheckOpen} title="Before Ending Queue" onClose={() => setEndQueueCheckOpen(false)} footer={<><button onClick={() => setEndQueueCheckOpen(false)}>Cancel</button><button className="primary" onClick={handleEndQueuePreCheck}>Continue</button></>}><p>Make sure all courts are empty and there is no pending queue.</p></Modal>
      <Modal open={endQueueConfirmOpen} title="End Queueing Session?" onClose={() => setEndQueueConfirmOpen(false)} footer={<><button onClick={() => setEndQueueConfirmOpen(false)}>Cancel</button><button className="danger" onClick={() => { onEndQueue(Date.now()); setEndQueueConfirmOpen(false) }}>End Queue</button></>}><p>Are you sure you want to end this Queueing Session? Once Ended, you can no longer Generate new matches.</p></Modal>
    </section>
  )
}
