import { useState, useEffect, type FormEvent } from 'react'
import { Modal, ModalForm } from '../components/Modal'
import { skillOrder, type Member, type Session, type Skill } from '../types/app'
import TourModal from "../components/onboarding/TourModal";

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
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberSkill, setNewMemberSkill] = useState<Skill>('Intermediate')
  const [editingMember, setEditingMember] = useState<{
    id: string
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
  const [showTour, setShowTour] = useState(false);

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
    setEditingMember({
      id: memberId,
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

  const submitNewMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newMemberName.trim()) return
    onAddMember(newMemberName.trim(), newMemberSkill)
    setNewMemberName('')
    setNewMemberSkill('Intermediate')
  }

  const saveMemberEdit = (memberId: string) => {
    if (!editingMember || !editingMember.name.trim()) return
    onEditMember(memberId, editingMember.name.trim(), editingMember.skill)
    setEditingMember(null)
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
  const [isQueueHistoryExpanded, setIsQueueHistoryExpanded] = useState(false)

  useEffect(() => {
      const completed = localStorage.getItem("tourCompleted");

      if (!completed) {
          setShowTour(true);
      }
  }, []);

  return (
        <section className="club-page">
      <div className="club-page-content">
        {/* Queue History */}
        <article className="club-section-card">
          <header className="club-section-header">
            <div className="club-section-heading">
              <h2>Queue History</h2>
              <p>Manage and organize your queues</p>
            </div>
              <label className="club-sort-control">
                <span>Sort:</span>

                <select
                  value={clubQueueSort}
                  onChange={(event) =>
                    onChangeQueueSort(
                      event.target.value as 'date' | 'name',
                    )
                  }
                >
                  <option value="date">Date</option>
                  <option value="name">Name</option>
                </select>
              </label>
          </header>
          <div className="queue-history-content">
          <div className="club-section-body">
            <div
              className={`club-queue-grid queue-history-card-list ${
                isQueueHistoryExpanded ? 'queue-history-expanded' : ''
              }`}
            >
              <button
                type="button"
                className="club-create-queue-card"
                onClick={() => {
                  setQueueName('')
                  setCreateQueueOpen(true)
                }}
              >
                <span className="club-create-queue-icon">
                  +
                </span>

                <span className="club-create-queue-label">
                  Create Queue
                </span>
              </button>

              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  className={
                    session.endedAt
                      ? `club-queue-card club-queue-card-ended ${
                          index >= 3 ? 'club-queue-card--mobile-overflow' : ''
                        }`
                      : `club-queue-card ${
                          index >= 3 ? 'club-queue-card--mobile-overflow' : ''
                        }`
                  }
                >
                  <button
                    type="button"
                    className="club-queue-card-title"
                    onClick={() =>
                      onOpenSession(session.id)
                    }
                  >
                    {session.name}
                    {session.endedAt && (
                      <span className="club-queue-ended-label">
                        - session ended
                      </span>
                    )}
                  </button>

                  <div className="club-queue-card-date">
                    {new Date(
                      session.createdAt,
                    ).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>

                  <div className="club-card-actions">
                    <button
                      type="button"
                      className="club-action-button club-action-edit"
                      onClick={() =>
                        openEditQueue(session.id)
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="club-action-button club-action-delete"
                      onClick={() =>
                        setDeleteModal({
                          type: 'queue',
                          id: session.id,
                          label: session.name,
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {sessions.length > 3 && (
              <button
                type="button"
                className="queue-history-list-toggle"
                onClick={() =>
                  setIsQueueHistoryExpanded((current) => !current)
                }
                aria-expanded={isQueueHistoryExpanded}
              >
                {isQueueHistoryExpanded ? 'Show less' : 'Show more'}
              </button>
            )}

            {sessions.length === 0 && (
              <div className="club-empty-state">
                <p>
                  No queues yet. Create your first queue to
                  get started.
                </p>
              </div>
            )}
          </div>
          
          </div>
        </article>

        {/* Club Members */}
        <article className="club-section-card">
          <header className="club-section-header">
            <div className="club-section-heading">
              <h2>Club Members</h2>

              <p>
                {members.length}{' '}
                {members.length === 1
                  ? 'member'
                  : 'members'}{' '}
                in your club
              </p>
            </div>

            <div className="club-member-toolbar">
              <select
                className="club-member-sort"
                value={clubMemberSort}
                onChange={(event) =>
                  onChangeMemberSort(
                    event.target.value as
                      | 'name'
                      | 'skill',
                  )
                }
              >
                <option value="name">
                  Sort by Name
                </option>

                <option value="skill">
                  Sort by Skill
                </option>
              </select>

              <button
                type="button"
                className="club-toolbar-button club-toolbar-secondary"
                onClick={() => {
                  setBulkMembersText('')
                  setBulkModalOpen(true)
                }}
              >
                Bulk Add
              </button>

            </div>
          </header>

          <div className="club-section-body">
            <form className="club-add-member-form" onSubmit={submitNewMember}>
              <input
                value={newMemberName}
                onChange={(event) => setNewMemberName(event.target.value)}
                placeholder="Name"
                aria-label="Member name"
              />
              <select
                value={newMemberSkill}
                onChange={(event) => setNewMemberSkill(event.target.value as Skill)}
                aria-label="Skill level"
              >
                {skillOrder.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
              </select>
              <button className="club-add-member-save" type="submit" disabled={!newMemberName.trim()}>
                Save
              </button>
            </form>
            {members.length > 0 ? (
              <div className="club-member-list">
                {members.map((member) => {
                  const isEditing = editingMember?.id === member.id
                  return (
                  <div
                    key={member.id}
                    className="club-member-card"
                    style={{
                      borderLeftColor: skillColor(
                        member.skill,
                      ),
                    }}
                  >
                    <div className="club-member-info">
                      {isEditing ? <input className="club-member-inline-input" value={editingMember.name} onChange={(event) => setEditingMember((current) => current ? { ...current, name: event.target.value } : current)} aria-label={`Name for ${member.name}`} /> : <p className="club-member-name">{member.name}</p>}
                      {isEditing ? <select className="club-member-inline-skill" value={editingMember.skill} onChange={(event) => setEditingMember((current) => current ? { ...current, skill: event.target.value as Skill } : current)} aria-label={`Skill for ${member.name}`}>{skillOrder.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select> : <p className="club-member-skill" style={{ color: skillColor(member.skill) }}>{member.skill}</p>}
                    </div>

                    <div className="club-card-actions club-member-actions">
                      {isEditing ? <><button type="button" className="club-action-button club-action-save" onClick={() => saveMemberEdit(member.id)} disabled={!editingMember.name.trim()}>Save</button><button type="button" className="club-action-button club-action-cancel" onClick={() => setEditingMember(null)}>Cancel</button></> : <><button type="button" className="club-action-button club-action-edit" onClick={() => openEditMember(member.id)}>Edit</button><button type="button" className="club-action-button club-action-delete" onClick={() => setDeleteModal({ type: 'member', id: member.id, label: member.name })}>Delete</button></>}
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <div className="club-empty-state">
                <p>
                  No members yet. Add your first member to
                  get started.
                </p>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* Create Queue */}
      <ModalForm
        open={createQueueOpen}
        title="Create Queue"
        onClose={() => setCreateQueueOpen(false)}
        onSubmit={submitCreateQueue}
        submitLabel="Create"
      >
        <div className="club-modal-fields">
          <label className="club-form-field">
            <span>Queue Name</span>

            <input
              autoFocus
              value={queueName}
              onChange={(event) =>
                setQueueName(event.target.value)
              }
              placeholder="e.g., Mpact Sundays - 25/04/26"
              required
            />
          </label>
        </div>
      </ModalForm>

      {/* Edit Queue */}
      <ModalForm
        open={Boolean(editingQueue)}
        title="Edit Queue"
        onClose={() => setEditQueueId(null)}
        onSubmit={submitEditQueue}
        submitLabel="Save"
      >
        <div className="club-modal-fields">
          <label className="club-form-field">
            <span>Queue Name</span>

            <input
              autoFocus
              value={queueName}
              onChange={(event) =>
                setQueueName(event.target.value)
              }
              required
            />
          </label>
        </div>
      </ModalForm>

      {/* Bulk Add Members */}
      <ModalForm
        open={bulkModalOpen}
        title="Bulk Add Members"
        onClose={() => setBulkModalOpen(false)}
        onSubmit={submitBulkMembers}
        submitLabel="Add All"
      >
        <div className="club-modal-fields">
          <label className="club-form-field">
            <span>One member per line</span>

            <div className="club-bulk-help">
              <p className="club-bulk-help-title">
                Format: Name [Skill Level]
              </p>

              <p>
                1 = Newbie, 2 = Beginner, 3 = Low
                Intermediate, 4 = Intermediate, 5 = High
                Intermediate, 6 = Advanced, 7 = Elite
              </p>

              <p>
                Defaults to Intermediate if no number is
                specified.
              </p>
            </div>

            <textarea
              value={bulkMembersText}
              onChange={(event) =>
                setBulkMembersText(event.target.value)
              }
              placeholder={'Anthony 3\nBawaw 5\nJohn'}
              required
              rows={6}
            />
          </label>
        </div>
      </ModalForm>

      {/* Delete Confirmation */}
      <Modal
        open={Boolean(deleteModal)}
        title={`Delete ${
          deleteModal?.type === 'queue'
            ? 'Queue'
            : 'Member'
        }?`}
        onClose={() => setDeleteModal(null)}
        footer={
          <div className="club-delete-footer">
            <button
              type="button"
              className="club-delete-cancel"
              onClick={() => setDeleteModal(null)}
            >
              Cancel
            </button>

            <button
              type="button"
              className="club-delete-confirm"
              onClick={() => {
                if (!deleteModal) return

                if (deleteModal.type === 'queue') {
                  onDeleteQueue(deleteModal.id)
                }

                if (deleteModal.type === 'member') {
                  onDeleteMember(deleteModal.id)
                }

                setDeleteModal(null)
              }}
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="club-delete-message">
          {deleteModal?.type === 'queue'
            ? `Remove queue "${deleteModal?.label}"? This action cannot be undone.`
            : `Remove member "${deleteModal?.label}" from all queues? This action cannot be undone.`}
        </p>
      </Modal>

      <TourModal
        open={showTour}
        startPage={0}
        onClose={() => setShowTour(false)}
      />
    </section>
    // <section className="club-page">
    //   <div className="club-page-content">
    //     <article className="card">
    //       <div className="section-title">
    //         <h3>Queue History</h3>
            
    //       </div>
    //       <div className="toolbar">
    //         <label>
    //           Sort:
    //           <select
    //             value={clubQueueSort}
    //             onChange={(e) =>
    //               onChangeQueueSort(e.target.value as 'date' | 'name')
    //             }
    //           >
    //             <option value="date">Date</option>
    //             <option value="name">Name</option>
    //           </select>
    //         </label>
    //       </div>
    //       <div className="queue-history-grid">
    //         <button
    //           type="button"
    //           className="queue-history-card queue-history-card-add"
    //           onClick={() => {
    //             setQueueName('')
    //             setCreateQueueOpen(true)
    //           }}
    //         >
    //           <div className="queue-history-add-icon">+</div>
    //           <div className="queue-history-card-title">Create new queue</div>
    //         </button>

    //         {sessions.map((session) => (
    //           <div key={session.id} className="queue-history-card">
    //             <button
    //               type="button"
    //               className="link-btn queue-history-card-title"
    //               onClick={() => onOpenSession(session.id)}
    //             >
    //               {session.name}
    //             </button>
    //             <div className="queue-history-card-footer">
    //               <span className="queue-history-card-meta">
    //                 {new Date(session.createdAt).toLocaleString('en-US', {
    //                   month: 'short',
    //                   day: 'numeric',
    //                   year: 'numeric',
    //                   hour: 'numeric',
    //                   minute: '2-digit',
    //                 })}
    //               </span>
    //               <div className="queue-history-card-actions">
    //                 <button className="ghost small" onClick={() => openEditQueue(session.id)}>
    //                   Edit
    //                 </button>
    //                 <button
    //                   className="danger small"
    //                   onClick={() =>
    //                     setDeleteModal({ type: 'queue', id: session.id, label: session.name })
    //                   }
    //                 >
    //                   Delete
    //                 </button>
    //               </div>
    //             </div>
    //           </div>
    //         ))}
    //       </div>
    //     </article>

    //     <article className="card">
    //       <div className="section-title">
    //         <h3>Club Members <span className="subtle">({members.length})</span></h3>
    //         <div className="actions">
    //           <button
    //             className="ghost small"
    //             onClick={() => {
    //               setBulkMembersText('')
    //               setBulkModalOpen(true)
    //             }}
    //           >
    //             Bulk Add
    //           </button>
    //           <button
    //             className="primary small"
    //             onClick={() =>
    //               setMemberModal({
    //                 mode: 'create',
    //                 memberId: null,
    //                 name: '',
    //                 skill: 'Intermediate',
    //               })
    //             }
    //           >
    //             Add Member
    //           </button>
    //         </div>
    //       </div>
    //       <div className="toolbar">
    //         <label>
    //           Sort:
    //           <select
    //             value={clubMemberSort}
    //             onChange={(e) => onChangeMemberSort(e.target.value as 'name' | 'skill')}
    //           >
    //             <option value="name">Name</option>
    //             <option value="skill">Skill Level</option>
    //           </select>
    //         </label>
    //       </div>
    //       <div className="list">
    //         {members.map((member) => (
    //           <div
    //             key={member.id}
    //             className={`row row-table row-skill club-member-row ${skillBorderClass(member.skill)}`}
    //           >
    //             <div className="row-col-name">
    //               <strong>{member.name}</strong>
    //             </div>
    //             <div className="row-col-skill">{member.skill}</div>
    //             <div className="row-col-action club-member-actions">
    //               <button className="ghost small" onClick={() => openEditMember(member.id)}>
    //                 Edit
    //               </button>
    //               <button
    //                 className="danger small"
    //                 onClick={() =>
    //                   setDeleteModal({ type: 'member', id: member.id, label: member.name })
    //                 }
    //               >
    //                 Delete
    //               </button>
    //             </div>
    //           </div>
    //         ))}
    //       </div>
    //     </article>
    //   </div>

    //   <ModalForm
    //     open={createQueueOpen}
    //     title="Create Queue"
    //     onClose={() => setCreateQueueOpen(false)}
    //     onSubmit={submitCreateQueue}
    //     submitLabel="Create"
    //   >
    //     <label className="field">
    //       Queue Name
    //       <input
    //         autoFocus
    //         value={queueName}
    //         onChange={(event) => setQueueName(event.target.value)}
    //         placeholder="Mpact Sundays - 25/04/26"
    //         required
    //       />
    //     </label>
    //   </ModalForm>

    //   <ModalForm
    //     open={Boolean(editingQueue)}
    //     title="Edit Queue"
    //     onClose={() => setEditQueueId(null)}
    //     onSubmit={submitEditQueue}
    //     submitLabel="Save"
    //   >
    //     <label className="field">
    //       Queue Name
    //       <input
    //         autoFocus
    //         value={queueName}
    //         onChange={(event) => setQueueName(event.target.value)}
    //         required
    //       />
    //     </label>
    //   </ModalForm>

    //   <ModalForm
    //     open={bulkModalOpen}
    //     title="Bulk Add Members"
    //     onClose={() => setBulkModalOpen(false)}
    //     onSubmit={submitBulkMembers}
    //     submitLabel="Add All"
    //   >
    //     <label className="field">
    //       One member per line
    //       <div className="bulk-help">
    //         Add a skill number after the name: 
    //          1-Newbie |  
    //         2-Beginner |  
    //         3-Low Intermediate |  
    //         4-Intermediate | 
    //         5-High Intermediate |  
    //         6-Advanced |  
    //         7-Elite. | No number defaults to Intermediate.
    //       </div>
    //       <textarea
    //         className="bulk-textarea"
    //         value={bulkMembersText}
    //         onChange={(event) => setBulkMembersText(event.target.value)}
    //         placeholder={'Anthony 3\nBawaw 5\nJohn'}
    //         required
    //       />
    //     </label>
    //   </ModalForm>

    //   <ModalForm
    //     open={Boolean(memberModal)}
    //     title={memberModal?.mode === 'edit' ? 'Edit Member' : 'Add Member'}
    //     onClose={() => setMemberModal(null)}
    //     onSubmit={submitMember}
    //     submitLabel={memberModal?.mode === 'edit' ? 'Save' : 'Add'}
    //   >
    //     <label className="field">
    //       Player Name
    //       <input
    //         autoFocus
    //         value={memberModal?.name ?? ''}
    //         onChange={(event) =>
    //           setMemberModal((prev) =>
    //             prev ? { ...prev, name: event.target.value } : prev,
    //           )
    //         }
    //         required
    //       />
    //     </label>
    //     <label className="field">
    //       Skill
    //       <select
    //         value={memberModal?.skill ?? 'Intermediate'}
    //         onChange={(event) =>
    //           setMemberModal((prev) =>
    //             prev ? { ...prev, skill: event.target.value as Skill } : prev,
    //           )
    //         }
    //       >
    //         {skillOrder.map((skill) => (
    //           <option
    //             key={skill}
    //             value={skill}
    //             style={{
    //               backgroundColor: skillColor(skill),
    //               color: skillTextColor(skill),
    //             }}
    //           >
    //             {skill}
    //           </option>
    //         ))}
    //       </select>
    //     </label>
    //   </ModalForm>

    //   <Modal
    //     open={Boolean(deleteModal)}
    //     title={`Delete ${deleteModal?.type === 'queue' ? 'Queue' : 'Member'}?`}
    //     onClose={() => setDeleteModal(null)}
    //     footer={
    //       <>
    //         <button onClick={() => setDeleteModal(null)}>Cancel</button>
    //         <button
    //           className="danger"
    //           onClick={() => {
    //             if (!deleteModal) return
    //             if (deleteModal.type === 'queue') onDeleteQueue(deleteModal.id)
    //             if (deleteModal.type === 'member') onDeleteMember(deleteModal.id)
    //             setDeleteModal(null)
    //           }}
    //         >
    //           Delete
    //         </button>
    //       </>
    //     }
    //   >
    //     <p>
    //       {deleteModal?.type === 'queue'
    //         ? `Remove queue "${deleteModal?.label}"?`
    //         : `Remove member "${deleteModal?.label}" from all queues?`}
    //     </p>
    //   </Modal>
    //   <TourModal
    //     open={showTour}
    //     startPage={0}
    //     onClose={() => setShowTour(false)}
    // />
    // </section>
  )
}
