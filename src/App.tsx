import { useState } from 'react'
import './App.css'
import { BottomNav } from './components/BottomNav'
import { TopBar } from './components/TopBar'
import { useRacketArenaState } from './hooks/useRacketArenaState'
import { ClubPage } from './pages/ClubPage'
import { HistoryPage } from './pages/HistoryPage'
import { LandingPage } from './pages/LandingPage'
import { MembersPage } from './pages/MembersPage'
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
  } = useRacketArenaState()
  const [rankingSort, setRankingSort] = useState<'winRate' | 'games' | 'name' | 'skill'>(
    'winRate',
  )
  const [rankingSkillFilter, setRankingSkillFilter] = useState<Skill | 'all'>('all')
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
    return 'club'
  }

  const currentPage = getCurrentPage()
  const showHome = currentPage !== 'club' && currentPage !== 'landing'

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
          showHome={showHome}
          onHome={() => navigate('/club')}
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
                  <HistoryPage session={activeSession} memberById={memberById} />
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
    </>
  )
}

export default App
