import { useState, type FormEvent } from 'react'
import { ModalForm } from '../components/Modal'
import { skillOrder, type Member, type Session, type Skill } from '../types/app'

type MembersPageProps = {
  session: Session
  memberById: Record<string, Member>
  playingSort: 'arrival' | 'games' | 'wins' | 'skill' | 'name' | 'queue'
  onChangeSort: (
    value: 'arrival' | 'games' | 'wins' | 'skill' | 'name' | 'queue',
  ) => void
  activePlayingMembers: string[]
  onMoveToPlaying: (memberId: string) => void
  onResign: (memberId: string) => void
  onAddMember: (name: string, skill: Skill) => void
  onAddMembersBulk: (names: string[], defaultSkill?: Skill) => void
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

const skillTextColor = (skill: Skill) =>
  skill === 'Newbie' || skill === 'Beginner' ? '#0A1F44' : '#ffffff'

export function MembersPage({
  session,
  memberById,
  playingSort,
  onChangeSort,
  activePlayingMembers,
  onMoveToPlaying,
  onResign,
  onAddMember,
  onAddMembersBulk,
}: MembersPageProps) {
  const [memberModal, setMemberModal] = useState<{ name: string; skill: Skill } | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkMembersText, setBulkMembersText] = useState('')

  const submitMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!memberModal || !memberModal.name.trim()) return
    onAddMember(memberModal.name.trim(), memberModal.skill)
    setMemberModal(null)
  }

  const submitBulkMembers = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const lines = bulkMembersText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (!lines.length) return

    onAddMembersBulk(lines, 'Intermediate')
    setBulkMembersText('')
    setBulkModalOpen(false)
  }

  return (
    <section className="members-page">
    <div className="section-title members-header">
      <div className="actions">
        <button
          className="ghost small"
          onClick={() => {
            setBulkMembersText('')
            setBulkModalOpen(true)
          }}
        >
          Bulk Add
        </button>

        <button
          className="primary small"
          onClick={() => setMemberModal({ name: '', skill: 'Intermediate' })}
        >
          Add Member
        </button>
      </div>
    </div>


      <div className="grid-two">
        <article className="card member-section-card">
        <div className="member-card-header">
          <h4>Currently Playing ({session.playingIds.length})</h4>

          <select
            value={playingSort}
            onChange={(e) => onChangeSort(e.target.value as typeof playingSort)}
          >
            <option value="arrival">Arrival</option>
            <option value="games">Games</option>
            <option value="wins">Wins</option>
            <option value="skill">Skill</option>
            <option value="name">Name</option>
            <option value="queue">Queue</option>
          </select>
        </div>

          <div className="list">
            {activePlayingMembers.map((memberId) => {
              const stats = session.stats[memberId]
              return (
                <div
                  key={memberId}
                  className={`row row-skill ${skillBorderClass(memberById[memberId].skill)}`}
                >
                  <div className="compact-player-row">
                    <strong>{memberById[memberId].name}</strong>

                    <div className="compact-player-meta">
                      <span className="compact-skill">
                        {memberById[memberId].skill}
                      </span>

                      <span className="compact-stats">
                        G:{stats.gamesPlayed} W:{stats.wins}
                        {session.stats[memberId].missedGames > 0 ? `  M:${session.stats[memberId].missedGames}` : ''}
                      </span>
                    </div>

                    <button
                      className="danger small"
                      onClick={() => onResign(memberId)}
                      title='Resign'
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 20 20" fill="currentColor"
                      style={{ width: '15px', height: '15px' }} 
                      className="size-5">
                        <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2.046 15.253c-.058.468.172.92.57 1.175A9.953 9.953 0 0 0 8 18c1.982 0 3.83-.578 5.384-1.573.398-.254.628-.707.57-1.175a6.001 6.001 0 0 0-11.908 0ZM12.75 7.75a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z" />
                      </svg>
                      
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </article>
        <article className="card member-section-card">
          <h4>Non-Playing Members ({session.nonPlayingIds.length})</h4>
          <div className="list">
            {[...session.nonPlayingIds]
              .sort((a, b) => memberById[a].name.localeCompare(memberById[b].name))
              .map((memberId) => (
                <div
                  key={memberId}
                  className={`row row-skill ${skillBorderClass(memberById[memberId].skill)}`}
                >
                  <div className="compact-player-row">
                    <strong>{memberById[memberId].name}</strong>

                    <div className="compact-player-meta">
                      <span className="compact-skill">
                        {memberById[memberId].skill}
                      </span>

                      <span className="compact-stats">
                        G:{session.stats[memberId].gamesPlayed} W:{session.stats[memberId].wins}
                        {session.stats[memberId].missedGames > 0 ? `  M:${session.stats[memberId].missedGames}` : ''}
                      </span>
                      
                    </div>

                    <button
                      className="play small"
                      onClick={() => onMoveToPlaying(memberId)}
                      title='Move to Playing'
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 20 20" fill="currentColor"                       
                      style={{ width: '15px', height: '15px' }} 
                      className="size-5">
                      <path d="M10 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM16.25 5.75a.75.75 0 0 0-1.5 0v2h-2a.75.75 0 0 0 0 1.5h2v2a.75.75 0 0 0 1.5 0v-2h2a.75.75 0 0 0 0-1.5h-2v-2Z" />
                    </svg>

                    </button>
                  </div>
                </div>
              ))}
          </div>
        </article>
      </div>
      <ModalForm
        open={bulkModalOpen}
        title="Bulk Add Members"
        onClose={() => setBulkModalOpen(false)}
        onSubmit={submitBulkMembers}
        submitLabel="Add All"
      >
        <label className="field">
          One member per line (default skill: Intermediate)
          <textarea
            className="bulk-textarea"
            value={bulkMembersText}
            onChange={(event) => setBulkMembersText(event.target.value)}
            placeholder={'Alex\nBrent\nCara\nDale'}
            required
          />
        </label>
      </ModalForm>

      <ModalForm
        open={Boolean(memberModal)}
        title="Add Member"
        onClose={() => setMemberModal(null)}
        onSubmit={submitMember}
        submitLabel="Add"
      >
        <label className="field">
          Player Name
          <input
            autoFocus
            value={memberModal?.name ?? ''}
            onChange={(event) =>
              setMemberModal((prev) => (prev ? { ...prev, name: event.target.value } : prev))
            }
            required
          />
        </label>
        <label className="field">
          Skill
          <select
            value={memberModal?.skill ?? 'Intermediate'}
            onChange={(event) =>
              setMemberModal((prev) =>
                prev ? { ...prev, skill: event.target.value as Skill } : prev,
              )
            }
          >
            {skillOrder.map((skill) => (
              <option key={skill} value={skill} 
                style={{
                  backgroundColor: skillColor(skill),
                  color: skillTextColor(skill),
                }}>
                {skill}
              </option>
            ))}
          </select>
        </label>
      </ModalForm>
    </section>
  )
}
