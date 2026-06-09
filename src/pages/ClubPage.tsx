import { useState, type FormEvent } from 'react'
import { Modal, ModalForm } from '../components/Modal'
import { skillOrder, type Member, type Session, type Skill } from '../types/app'

type ClubPageProps = {
  sessions: Session[]
  members: Member[]
  clubQueueSort: 'date' | 'name'
  clubMemberSort: 'name' | 'skill'
  onChangeQueueSort: (value: 'date' | 'name') => void
  onChangeMemberSort: (value: 'name' | 'skill') => void
  onCreateQueue: (queue:{name: string, createdAt: string}) => void
  onOpenSession: (sessionId: string) => void
  onEditQueue: (sessionId: string, name: string) => void
  onDeleteQueue: (sessionId: string) => void
  onAddMember: (name: string, skill: Skill) => void
  onAddMembersBulk: (names: string[], defaultSkill?: Skill) => void
  onEditMember: (memberId: string, name: string, skill: Skill) => void
  onDeleteMember: (memberId: string) => void
}

const skillBorderClass = (skill: Skill) =>
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

export function ClubPage({
  sessions,
  members,
  clubQueueSort,
  clubMemberSort,
  onChangeQueueSort,
  onChangeMemberSort,
  onCreateQueue,
  onOpenSession,
  onEditQueue,
  onDeleteQueue,
  onAddMember,
  onAddMembersBulk,
  onEditMember,
  onDeleteMember,
}: ClubPageProps) {
  const [createQueueOpen, setCreateQueueOpen] = useState(false)
  const [editQueueId, setEditQueueId] = useState<string | null>(null)
  const [queueName, setQueueName] = useState('')
  const [memberModal, setMemberModal] = useState<{
    mode: 'create' | 'edit'
    memberId: string | null
    name: string
    skill: Skill
  } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{
    type: 'queue' | 'member'
    id: string
    label: string
  } | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkMembersText, setBulkMembersText] = useState('')

  const editingQueue = sessions.find((session) => session.id === editQueueId) ?? null

  const openEditQueue = (sessionId: string) => {
    const target = sessions.find((session) => session.id === sessionId)
    if (!target) return
    setEditQueueId(sessionId)
    setQueueName(target.name)
  }

  const openEditMember = (memberId: string) => {
    const target = members.find((member) => member.id === memberId)
    if (!target) return
    setMemberModal({
      mode: 'edit',
      memberId,
      name: target.name,
      skill: target.skill,
    })
  }

  const submitCreateQueue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!queueName.trim()) return
     
    const newQueue = {
      name: queueName.trim(),
      createdAt: new Date().toISOString()
    }
    onCreateQueue(newQueue)
    setQueueName('')
    setCreateQueueOpen(false)
  }

  const submitEditQueue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editQueueId || !queueName.trim()) return
    onEditQueue(editQueueId, queueName.trim())
    setEditQueueId(null)
    setQueueName('')
  }

  const submitMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!memberModal || !memberModal.name.trim()) return
    if (memberModal.mode === 'create') {
      onAddMember(memberModal.name.trim(), memberModal.skill)
    } else if (memberModal.memberId) {
      onEditMember(memberModal.memberId, memberModal.name.trim(), memberModal.skill)
    }
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
    <section className="club-page">
      <article className="card">
        <div className="section-title">
          <h3>Queue History</h3>
          
        </div>
        <div className="toolbar">
          <label>
            Sort:
            <select
              value={clubQueueSort}
              onChange={(e) =>
                onChangeQueueSort(e.target.value as 'date' | 'name')
              }
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        <div className="queue-history-grid">
          <button
            type="button"
            className="queue-history-card queue-history-card-add"
            onClick={() => {
              setQueueName('')
              setCreateQueueOpen(true)
            }}
          >
            <div className="queue-history-add-icon">+</div>
            <div className="queue-history-card-title">Create new queue</div>
          </button>

          {sessions.map((session) => (
            <div key={session.id} className="queue-history-card">
              <button
                type="button"
                className="link-btn queue-history-card-title"
                onClick={() => onOpenSession(session.id)}
              >
                {session.name}
              </button>
              <div className="queue-history-card-footer">
                <span className="queue-history-card-meta">
                  {new Date(session.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <div className="queue-history-card-actions">
                  <button className="ghost small" onClick={() => openEditQueue(session.id)}>
                    Edit
                  </button>
                  <button
                    className="danger small"
                    onClick={() =>
                      setDeleteModal({ type: 'queue', id: session.id, label: session.name })
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <div className="section-title">
          <h3>Club Members <span className="subtle">({members.length})</span></h3>
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
              onClick={() =>
                setMemberModal({
                  mode: 'create',
                  memberId: null,
                  name: '',
                  skill: 'Intermediate',
                })
              }
            >
              Add Member
            </button>
          </div>
        </div>
        <div className="toolbar">
          <label>
            Sort:
            <select
              value={clubMemberSort}
              onChange={(e) => onChangeMemberSort(e.target.value as 'name' | 'skill')}
            >
              <option value="name">Name</option>
              <option value="skill">Skill Level</option>
            </select>
          </label>
        </div>
        <div className="list">
          {members.map((member) => (
            <div
              key={member.id}
              className={`row row-table row-skill club-member-row ${skillBorderClass(member.skill)}`}
            >
              <div className="row-col-name">
                <strong>{member.name}</strong>
              </div>
              <div className="row-col-skill">{member.skill}</div>
              <div className="row-col-action club-member-actions">
                <button className="ghost small" onClick={() => openEditMember(member.id)}>
                  Edit
                </button>
                <button
                  className="danger small"
                  onClick={() =>
                    setDeleteModal({ type: 'member', id: member.id, label: member.name })
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <ModalForm
        open={createQueueOpen}
        title="Create Queue"
        onClose={() => setCreateQueueOpen(false)}
        onSubmit={submitCreateQueue}
        submitLabel="Create"
      >
        <label className="field">
          Queue Name
          <input
            autoFocus
            value={queueName}
            onChange={(event) => setQueueName(event.target.value)}
            placeholder="Mpact Sundays - 25/04/26"
            required
          />
        </label>
      </ModalForm>

      <ModalForm
        open={Boolean(editingQueue)}
        title="Edit Queue"
        onClose={() => setEditQueueId(null)}
        onSubmit={submitEditQueue}
        submitLabel="Save"
      >
        <label className="field">
          Queue Name
          <input
            autoFocus
            value={queueName}
            onChange={(event) => setQueueName(event.target.value)}
            required
          />
        </label>
      </ModalForm>

      <ModalForm
        open={bulkModalOpen}
        title="Bulk Add Members"
        onClose={() => setBulkModalOpen(false)}
        onSubmit={submitBulkMembers}
        submitLabel="Add All"
      >
        <label className="field">
          One member per line
          <div className="bulk-help">
            Add a skill number after the name: 1 Newbie, 2 Beginner, 3 Low
            Intermediate, 4 Intermediate, 5 High Intermediate, 6 Advanced, 7
            Elite. No number defaults to Intermediate.
          </div>
          <textarea
            className="bulk-textarea"
            value={bulkMembersText}
            onChange={(event) => setBulkMembersText(event.target.value)}
            placeholder={'Anthony 3\nBawaw 5\nJohn'}
            required
          />
        </label>
      </ModalForm>

      <ModalForm
        open={Boolean(memberModal)}
        title={memberModal?.mode === 'edit' ? 'Edit Member' : 'Add Member'}
        onClose={() => setMemberModal(null)}
        onSubmit={submitMember}
        submitLabel={memberModal?.mode === 'edit' ? 'Save' : 'Add'}
      >
        <label className="field">
          Player Name
          <input
            autoFocus
            value={memberModal?.name ?? ''}
            onChange={(event) =>
              setMemberModal((prev) =>
                prev ? { ...prev, name: event.target.value } : prev,
              )
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
              <option
                key={skill}
                value={skill}
                style={{
                  backgroundColor: skillColor(skill),
                  color: skillTextColor(skill),
                }}
              >
                {skill}
              </option>
            ))}
          </select>
        </label>
      </ModalForm>

      <Modal
        open={Boolean(deleteModal)}
        title={`Delete ${deleteModal?.type === 'queue' ? 'Queue' : 'Member'}?`}
        onClose={() => setDeleteModal(null)}
        footer={
          <>
            <button onClick={() => setDeleteModal(null)}>Cancel</button>
            <button
              className="danger"
              onClick={() => {
                if (!deleteModal) return
                if (deleteModal.type === 'queue') onDeleteQueue(deleteModal.id)
                if (deleteModal.type === 'member') onDeleteMember(deleteModal.id)
                setDeleteModal(null)
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p>
          {deleteModal?.type === 'queue'
            ? `Remove queue "${deleteModal?.label}"?`
            : `Remove member "${deleteModal?.label}" from all queues?`}
        </p>
      </Modal>
    </section>
  )
}
