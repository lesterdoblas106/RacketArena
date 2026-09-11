import { useState } from 'react'
import './App.css'
import { BottomNav } from './components/BottomNav'
// import { Modal } from './components/Modal'
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
import TourModal from "./components/onboarding/TourModal";

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
    playersSort,
    setPlayersSort,
    manualPickIds,
    openSession,
    createQueue,
    editQueue,
    deleteQueue,
    addMember,
    addMembersBulk,
    addVisitors,
    editMember,
    deleteMember,
    editVisitor,
    deleteVisitor,
    moveToPlaying,
    resignFromPlaying,
    setParticipant,
    addCourt,
    removeCourt,
    renameCourt,
    updateHistoryMatch,
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
    startSession,
    endSession,
  } = useRacketArenaState()
  const [rankingSort, setRankingSort] = useState<'score'|'winRate' | 'games' | 'name' | 'skill'>(
    'score',
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
      members: 'Attendance',
      queue: 'Queue',
      ranking: 'Ranking',
      history: 'History',
      payment: 'Payment',
      landing: 'Home',
    }[currentPage] ?? 'Racket Arena'
    const pageToTourIndex = {
    landing: 0,
    club: 0,
    members: 3,
    queue: 4,
    ranking: 8,
    history: 9,
    payment: 10,
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
                    clubMembers={sortedClubMembers}
                    onMoveToPlaying={moveToPlaying}
                    onResign={resignFromPlaying}
                    onSetParticipant={setParticipant}
                    onAddVisitors={addVisitors}
                    onEditVisitor={editVisitor}
                    onDeleteVisitor={deleteVisitor}
                    onStartQueue={startSession}
                    onEndQueue={endSession}
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
                    <HistoryPage
                      session={activeSession}
                      memberById={memberById}
                      exportSessionCSV={exportSessionCSV}
                      updateHistoryMatch={updateHistoryMatch}
                    />
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

      {/* <Modal
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
      </Modal> */}
      <TourModal
        open={helpOpen}
        startPage={pageToTourIndex[currentPage] ?? 0}
        onClose={() => setHelpOpen(false)}
      />
    </>
  )
}

export default App
