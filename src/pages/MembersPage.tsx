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
    Advanced: 'skill-advanced',
    Elite: 'skill-elite',
  })[skill]
  const skillColor = (skill: Skill) =>
  ({
    Newbie: '#d1d5db',
    Beginner: '#fde047',
    'Low Intermediate': '#22c55e',
    Intermediate: '#3b82f6',
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

    onAddMembersBulk(lines, 'Low Intermediate')
    setBulkMembersText('')
    setBulkModalOpen(false)
  }

  return (
    <section className="members-page">
      <div className="section-title">
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

        <label>
          Sort:
          <select
            value={playingSort}
            onChange={(e) => onChangeSort(e.target.value as typeof playingSort)}
          >
            <option value="arrival">Arrival Time</option>
            <option value="games">Games Played</option>
            <option value="wins">Wins</option>
            <option value="skill">Skill Level</option>
            <option value="name">Name</option>
            <option value="queue">Queue</option>
          </select>
        </label>
      </div>

      <div className="grid-two">
        <article className="card member-section-card">
          <h4>Currently Playing ({session.playingIds.length})</h4>
          <div className="list">
            {activePlayingMembers.map((memberId) => {
              const stats = session.stats[memberId]
              return (
                <div
                  key={memberId}
                  className={`row row-table row-skill ${skillBorderClass(memberById[memberId].skill)}`}
                >
                  <div className="row-col-name">
                    <strong>{memberById[memberId].name}</strong>
                  </div>
                  <div className="row-col-skill">{memberById[memberId].skill}</div>
                  <div className="row-col-stats">
                    <span>G:{stats.gamesPlayed}</span>
                    <span>W:{stats.wins}</span>
                  </div>
                  <div className="row-col-action">
                    <button className="danger" onClick={() => onResign(memberId)}>
                      Resign
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
                  className={`row row-table row-skill ${skillBorderClass(memberById[memberId].skill)}`}
                >
                  <div className="row-col-name">
                    <strong>{memberById[memberId].name}</strong>
                  </div>
                  <div className="row-col-skill">{memberById[memberId].skill}</div>
                  <div className="row-col-stats">
                    <span>G:{session.stats[memberId].gamesPlayed}</span>
                    <span>W:{session.stats[memberId].wins}</span>
                  </div>
                  <div className="row-col-action">
                    <button className="play" onClick={() => onMoveToPlaying(memberId)}>
                      Play
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
          One member per line (default skill: Low Intermediate)
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
