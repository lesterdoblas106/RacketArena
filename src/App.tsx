import { useState } from 'react'
import './App.css'
import { BottomNav } from './components/BottomNav'
import { Modal } from './components/Modal'
import { TopBar } from './components/TopBar'
import { useRacketArenaState } from './hooks/useRacketArenaState'
import { ClubPage } from './pages/ClubPage'
import { HistoryPage } from './pages/HistoryPage'
import { LandingPage } from './pages/LandingPage'
import { MembersPage } from './pages/MembersPage'
import { PaymentPage } from './pages/PaymentPage'
import { QueuePage } from './pages/QueuePage'
import { RankingPage } from './pages/RankingPage'
import type { Skill } from './types/app'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'

function App() {
  const {
    activeSession,
    memberById,
    queuesForClub,
    sortedClubMembers,
    clubQueueSort,
    clubMemberSort,
    setClubQueueSort,
    setClubMemberSort,
    playingSort,
    setPlayingSort,
    activePlayingMembers,
    playersSort,
    setPlayersSort,
    manualPickIds,
    openSession,
    createQueue,
    editQueue,
    deleteQueue,
    addMember,
    addMembersBulk,
    editMember,
    deleteMember,
    moveToPlaying,
    resignFromPlaying,
    addCourt,
    removeCourt,
    renameCourt,
    endMatch,
    generateRoster,
    queueManualRoster,
    assignToCourt,
    dissolveRoster,
    replaceRosterPlayer,
    getSessionPlayerStatus,
    skillScore,
    toggleManualPick,
    shuffleRoster,
    buildQueueList,
    forfeitMatch,
    exportSessionCSV,
  } = useRacketArenaState()
  const [rankingSort, setRankingSort] = useState<'winRate' | 'games' | 'name' | 'skill'>(
    'winRate',
  )
  const [rankingSkillFilter, setRankingSkillFilter] = useState<Skill | 'all'>('all')
  const [helpOpen, setHelpOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const getCurrentPage = () => {
    const path = location.pathname
    if (path === '/' || path === '') return 'landing'
    if (path === '/club') return 'club'
    if (path === '/members') return 'members'
    if (path === '/queue') return 'queue'
    if (path === '/ranking') return 'ranking'
    if (path === '/history') return 'history'
    if (path === '/payment') return 'payment'
    return 'club'
  }

  const currentPage = getCurrentPage()
  const showHome = currentPage !== 'club' && currentPage !== 'landing'
  const topBarPageLabel =
    {
      club: 'Club',
      members: 'Members',
      queue: 'Queue',
      ranking: 'Ranking',
      history: 'History',
      payment: 'Payment',
      landing: 'Home',
    }[currentPage] ?? 'Racket Arena'
  const helpContent =
    {
      club: {
        title: 'How to use Club',
        items: [
          'Create a queue for each playing session or open an existing queue from Queue History.',
          'Use the members area to add, bulk add, edit, or delete club members.',
          'Sort queue history by date or name, and sort members by name or skill level.',
        ],
        skillLevels: [
          { label: 'Newbie', color: '#d1d5db' },
          { label: 'Beginner', color: '#fde047' },
          { label: 'Low Intermediate', color: '#22c55e' },
          { label: 'Intermediate', color: '#3b82f6' },
          { label: 'High Intermediate', color: '#8b5cf6' },
          { label: 'Advanced', color: '#ef4444' },
          { label: 'Elite', color: '#111827' },
        ],
      },
      members: {
        title: 'How to use Members',
        items: [
          'Move members into Currently Playing before they can join court rotations and queue generation.',
          'Use Resign to move a player back to Non-Playing while keeping their session stats.',
          'Use sorting to review active players by arrival, games, wins, skill, name, or queue order.',
        ],
        skillLevels: [
          { label: 'Newbie', color: '#d1d5db' },
          { label: 'Beginner', color: '#fde047' },
          { label: 'Low Intermediate', color: '#22c55e' },
          { label: 'Intermediate', color: '#3b82f6' },
          { label: 'High Intermediate', color: '#8b5cf6' },
          { label: 'Advanced', color: '#ef4444' },
          { label: 'Elite', color: '#111827' },
        ],
      },
      queue: {
        title: 'How to use Queue',
        items: [
          'Press Generate to create a compatible roster from the current queue.',
          'Select one player before pressing Generate to make that player the base player for matchmaking.',
          'Select exactly four players from the Players List to create a manual match.',
          'Click a player name inside a roster to replace them, shuffle to rotate teammates, assign to court to start, or dissolve to remove the roster.',
          'Use Court Section to add, rename, remove empty courts, end matches, or forfeit active games.',
        ],
      },
      ranking: {
        title: 'How to use Ranking',
        items: [
          'Review player standings for the active session.',
          'Sort rankings by win rate, games, name, or skill.',
          'Use the skill filter to focus on a specific skill group.',
        ],
      },
      history: {
        title: 'How to use History',
        items: [
          'View completed matches with teams, score, result, court, and completion time.',
          "Filter history by player name to review a player's completed games.",
          'Use Export CSV to download thesis-ready session data, including player information, match records, team skill totals, and waiting-time records.',
        ],
      },
      payment: {
        title: 'How to use Payment',
        items: [
          'Enter court, shuttlecock, and individual payment values to calculate the amount due per participating player.',
          'Mark players as paid, choose their mode of payment, and add notes or reference numbers.',
          'Review collected totals by payment mode, such as Cash or GCash.',
          'Payment entries are saved per session when you move between pages.',
        ],
      },
      landing: {
        title: 'How to use RacketArena',
        items: [
          'Open the app to manage badminton sessions, player queues, court rotation, rankings, history, and payments.',
        ],
      },
    }[currentPage] ?? {
      title: 'How to use RacketArena',
      items: ['Use the bottom navigation to move between the main session tools.'],
    }

  const handleOpenSession = (sessionId: string) => {
    openSession(sessionId)
    navigate('/members')
  }

  const handleDeleteQueue = (queueId: string) => {
    deleteQueue(queueId)
    navigate('/club')
  }

  const handleNavSelect = (page: string) => {
    navigate(`/${page}`)
  }

  return (
    <>
      {currentPage !== 'landing' && (
        <TopBar
          title={activeSession?.name ?? 'Racket Arena'}
          pageLabel={topBarPageLabel}
          showHome={showHome}
          onHome={() => navigate('/club')}
          onInfo={() => setHelpOpen(true)}
        />
      )}

      {currentPage === 'landing' ? (
        <LandingPage onOpen={() => navigate('/club')} />
      ) : (
        <main className="app-shell">
          <Routes>
            <Route
              path="/club"
              element={
                <ClubPage
                  sessions={queuesForClub}
                  members={sortedClubMembers}
                  clubQueueSort={clubQueueSort}
                  clubMemberSort={clubMemberSort}
                  onChangeQueueSort={setClubQueueSort}
                  onChangeMemberSort={setClubMemberSort}
                  onCreateQueue={createQueue}
                  onOpenSession={handleOpenSession}
                  onEditQueue={editQueue}
                  onDeleteQueue={handleDeleteQueue}
                  onAddMember={addMember}
                  onAddMembersBulk={addMembersBulk}
                  onEditMember={editMember}
                  onDeleteMember={deleteMember}
                />
              }
            />
            <Route
              path="/members"
              element={
                activeSession ? (
                  <MembersPage
                    session={activeSession}
                    memberById={memberById}
                    playingSort={playingSort}
                    onChangeSort={setPlayingSort}
                    activePlayingMembers={activePlayingMembers}
                    onMoveToPlaying={moveToPlaying}
                    onResign={resignFromPlaying}
                    onAddMember={addMember}
                    onAddMembersBulk={addMembersBulk}
                  />
                ) : (
                  <Navigate to="/club" />
                )
              }
            />
            <Route
              path="/queue"
              element={
                activeSession ? (
                  <QueuePage
                    session={activeSession}
                    memberById={memberById}
                    playersSort={playersSort}
                    manualPickIds={manualPickIds}
                    onChangePlayersSort={setPlayersSort}
                    onAddCourt={addCourt}
                    onRemoveCourt={removeCourt}
                    onRenameCourt={renameCourt}
                    onEndMatch={endMatch}
                    onGenerateRoster={generateRoster}
                    onQueueManualRoster={queueManualRoster}
                    onAssignToCourt={assignToCourt}
                    onDissolveRoster={dissolveRoster}
                    onReplaceRosterPlayer={replaceRosterPlayer}
                    onToggleManualPick={toggleManualPick}
                    getSessionPlayerStatus={getSessionPlayerStatus}
                    skillScore={skillScore}
                    onShuffleRoster={shuffleRoster}
                    buildQueueList={buildQueueList}
                    forfeitMatch={forfeitMatch}
                  />
                ) : (
                  <Navigate to="/club" />
                )
              }
            />
            <Route
              path="/ranking"
              element={
                activeSession ? (
                  <RankingPage
                    session={activeSession}
                    memberById={memberById}
                    sortBy={rankingSort}
                    onSortBy={setRankingSort}
                    skillFilter={rankingSkillFilter}
                    onSkillFilter={setRankingSkillFilter}
                  />
                ) : (
                  <Navigate to="/club" />
                )
              }
            />
            <Route
              path="/history"
              element={
                activeSession ? (
                    <HistoryPage session={activeSession} memberById={memberById} exportSessionCSV={exportSessionCSV} />
                ) : (
                  <Navigate to="/club" />
                )
              }
            />
            <Route
              path="/payment"
              element={
                activeSession ? (
                  <PaymentPage
                    key={activeSession.id}
                    session={activeSession}
                    memberById={memberById}
                  />
                ) : (
                  <Navigate to="/club" />
                )
              }
            />
            <Route path="*" element={<Navigate to="/club" />} />
          </Routes>
        </main>
      )}

      {activeSession && currentPage !== 'landing' && (
        <BottomNav page={currentPage} onSelect={handleNavSelect} />
      )}

      <Modal
        open={helpOpen}
        title={helpContent.title}
        onClose={() => setHelpOpen(false)}
      >
        <div className="help-content">
          <ul>
            {helpContent.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {helpContent.skillLevels && (
            <div className="help-skill-levels">
              <h3>Skill Levels</h3>
              <div className="skill-levels-grid">
                {helpContent.skillLevels.map((level) => (
                  <div key={level.label} className="skill-level-item">
                    <div
                      className="skill-level-indicator"
                      style={{ borderLeftColor: level.color }}
                    ></div>
                    <span>{level.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="help-footer">
            <p>
              For feedback, inquiries, or to report an issue, please contact {' '}
              <a href="mailto:lesterdoblas@gmail.com">lesterdoblas@gmail.com</a>.
            </p>
            <p>© 2026 RacketArena. Developed by Lester John Doblas.</p>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default App
