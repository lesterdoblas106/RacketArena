import { getQueueSkill, isSmartQueueMode, reconcileEloRatings, eloRatingAdjustment, eloStartingRating } from '../lib/eloRatings'
import { createId } from '../lib/createId'
import { useEffect, useMemo, useState } from 'react'
import { loadState, saveState } from '../lib/storage'
import {
  createSession,
  seedMembers,
  skillOrder,
  type MatchHistory,
  type Member,
  type MatchmakingMode,
  type Session,
  type SessionHistory,
  type Skill,
  type WinLoseStackState,
} from '../types/app'
import { toast } from 'sonner'
import { appendResultToStacks, buildStackRotation, buildUpcomingStackMatches, lockReturningMatches, removePlayersFromStacks, restorePlayersToStacks, skipNextStackPlayer } from '../lib/stacking'

import {
  clearLatePriority, getAdditionalMissedGames, getCourtWaitingRecords, getCurrentBenchWait, snapshotCourtWaiting, rollbackCourtWaiting,
  getFinishedCourtWait, getTotalGames, isCourtLineupAvailable, recordBenchWaits,
} from '../lib/queueSession'
import { saveScoringHistory } from '../lib/scoringHistoryStorage'
import { scoringHistoryLimit, type AutomaticScoring, type ScoredArrangement, type ScoringSearch, type ScoringSnapshot } from '../lib/smartQueueInspector'
import { compatibilityLayers, findSmartQueuePool } from '../lib/smartQueueCandidates'
import { buildPairingCounts, calculateWaitingScore, selectSmartQueueArrangement, smartQueueFormula } from '../lib/smartQueueScoring'

const capitalizeName = (name: string) =>
  name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : name

const removeCalibrationPlayer = (
  stack: WinLoseStackState,
  memberId: string,
  stats: Session['stats'],
): WinLoseStackState => {
  const initialPlayerIds = stack.initialPlayerIds.filter((id) => id !== memberId)
  return {
    ...stack,
    initialPlayerIds,
    calibrationComplete:
      stack.calibrationComplete ||
      initialPlayerIds.length === 0 ||
      initialPlayerIds.every((id) => (stats[id]?.gamesPlayed ?? 0) > 0),
  }
}

export function useRacketArenaState() {
  const [initial] = useState(() => {
    const persisted = loadState()
    if (persisted) {
      return {
        ...persisted,
        sessions: persisted.sessions.map((session) => {
          const migrated = {
            ...session,
          startedAt: Object.prototype.hasOwnProperty.call(session, 'startedAt')
            ? session.startedAt
            : new Date(session.createdAt).getTime(),
          endedAt: session.endedAt ?? null,
          // Existing sessions used nonPlayingIds for the old Available Members
          // section. Keep those as club members; only already-active players
          // become participants during the migration.
          participantIds: session.participantIds ?? session.playingIds ?? [],
          visitors: session.visitors ?? [],
          matchmakingMode: session.matchmakingMode ?? 'smart-queue',
          winLoseStack: {
            unplayed: session.winLoseStack?.unplayed ?? [],
            winners: session.winLoseStack?.winners ?? [],
            losers: session.winLoseStack?.losers ?? [],
            returning: session.winLoseStack?.returning ?? [],
            returningMatches: session.winLoseStack?.returningMatches ?? [],
            prioritizedPlayerIds: session.winLoseStack?.prioritizedPlayerIds,
            playingNext: session.winLoseStack?.playingNext ?? 'winner',
            initialPlayerIds: session.winLoseStack?.initialPlayerIds ?? [],
            // Existing started sessions predate calibration tracking, so retain
            // their established rotation behavior rather than exempting them.
            calibrationComplete: session.winLoseStack?.calibrationComplete ?? Boolean(session.startedAt),
            manualMatches: session.winLoseStack?.manualMatches ?? [],
            teamRotation: session.winLoseStack?.teamRotation ?? 0,
          },
          history: session.history ?? [],
          stats: Object.fromEntries(
            Object.entries(session.stats).map(([memberId, stats]) => [
              memberId,
              {
                ...stats,
              },
            ]),
          ),
          courts: session.courts.map((court, courtIndex) => ({
            ...court,
            name: court.name ?? `Court ${courtIndex + 1}`,
            startedAt: court.startedAt ?? null,
          })),
          }
          return reconcileEloRatings(migrated)
        }),
      }
    }
    return {
      members: seedMembers,
      sessions: [createSession('Mpact Sundays', seedMembers)],
      activeSessionId: null as string | null,
    }
  })

  const [members, setMembers] = useState(initial.members)
  const [sessions, setSessions] = useState<Session[]>(initial.sessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initial.activeSessionId,
  )
  const [clubMemberSort, setClubMemberSort] = useState<'name' | 'skill'>('name')
  const [clubQueueSort, setClubQueueSort] = useState<'date' | 'name'>('date')
  const [playingSort, setPlayingSort] = useState<
    'arrival' | 'games' | 'wins' | 'skill' | 'name' | 'queue'
  >('arrival')
  const [playersSort, setPlayersSort] = useState<
    'queue' | 'waitingTime' | 'totalGames' | 'skill' | 'name'
  >('queue')
  const [manualPickIds, setManualPickIds] = useState<string[]>([])
  const [clock, setClock] = useState(() => Date.now())

  const resolvedActiveSessionId =
    activeSessionId && sessions.some((session) => session.id === activeSessionId)
      ? activeSessionId
      : null

  useEffect(() => {
    saveState({
      members,
      sessions,
      activeSessionId: resolvedActiveSessionId,
    })
  }, [members, sessions, resolvedActiveSessionId])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === resolvedActiveSessionId) ?? null,
    [sessions, resolvedActiveSessionId],
  )

  const scoringSnapshots = activeSession?.scoringSnapshots
  useEffect(() => {
    if (!resolvedActiveSessionId || !scoringSnapshots?.length) return
    void saveScoringHistory(resolvedActiveSessionId, scoringSnapshots).catch((error) => {
      console.warn('Unable to save match scoring history', error)
    })
  }, [resolvedActiveSessionId, scoringSnapshots])

  const memberById = useMemo(
    () =>
      [...members, ...sessions.flatMap((session) => session.visitors ?? [])].reduce<
        Record<string, Member>
      >((acc, member) => ((acc[member.id] = member), acc), {}),
    [members, sessions],
  )

  const queuesForClub = [...sessions].sort((a, b) => {
    if (clubQueueSort === 'date') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    if (clubQueueSort === 'name') {
      return a.name.localeCompare(b.name)
    }
    return 0
  })

  const sortedClubMembers = [...members].sort((a, b) => {
    if (clubMemberSort === 'skill') {
      return skillOrder.indexOf(b.skill) - skillOrder.indexOf(a.skill)
    }
    return a.name.localeCompare(b.name)
  })

  const skillScore = (skill: Skill) => skillOrder.indexOf(skill)

  const openSession = (sessionId: string) => {
    setActiveSessionId(sessionId)
    setManualPickIds([])
  }

  const upsertStatsForNewMember = (memberId: string) => {
    setSessions((prev) =>
      prev.map((session) => ({
        ...session,
        nonPlayingIds: [...session.nonPlayingIds, memberId].sort(),
        stats: {
          ...session.stats,
          [memberId]: {
            gamesPlayed: 0,
            wins: 0,
            missedGames: 0,
            joinedAt: Object.keys(session.stats).length + 1,
            waitingSince: Date.now(),
            totalWaitMs:0,
            waitPeriods:0,
            averageWaitMs: 0,
          },
        },
      })),
    )
  }

  const createQueue = (queue: { name: string, createdAt: string, matchmakingMode?: MatchmakingMode }) => {
    if (!queue.name.trim()) return
    const session = createSession(queue.name.trim(), members)
    setSessions((prev) => [
      { 
        ...session,
        createdAt: queue.createdAt,
        matchmakingMode: queue.matchmakingMode ?? 'smart-queue',
        ...(queue.matchmakingMode === 'elo-smart-queue' ? { eloRatings: Object.fromEntries(members.map(({ id }) => [id, eloStartingRating])) } : {}),
      },
      ...prev
    ])
    return session.id
  }

  const editQueue = (queueId: string, name: string, matchmakingMode: MatchmakingMode) => {
    const target = sessions.find((s) => s.id === queueId)
    if (!target || !name.trim()) return
    if (target.endedAt != null) {
      toast.warning('This session has ended and can’t be edited.')
      return
    }
    if (target.startedAt != null && target.matchmakingMode !== matchmakingMode) {
      toast.warning('Matchmaking mode can’t be changed after the queue starts.')
      return
    }

    if (queueId === activeSessionId && target.matchmakingMode !== matchmakingMode) {
      setManualPickIds([])
    }

    setSessions((prev) => prev.map((session) => {
      if (session.id !== queueId || session.endedAt != null) return session
      if (session.matchmakingMode === matchmakingMode) {
        return { ...session, name: name.trim() }
      }
      if (session.startedAt != null) return session

      const inGame = new Set(session.courts.flatMap((court) => [...court.teamA, ...court.teamB]))
      return {
        ...session,
        name: name.trim(),
        matchmakingMode,
        ...(matchmakingMode === 'elo-smart-queue' ? { eloRatings: Object.fromEntries(Object.keys(session.stats).map(id => [id, eloStartingRating])) } : {}),
        rosters: [],
        winLoseStack: {
          unplayed: matchmakingMode === 'win-lose-stack'
            ? session.playingIds.filter((id) => !inGame.has(id))
            : [],
          winners: [],
          losers: [],
          playingNext: 'winner',
          initialPlayerIds: [],
          calibrationComplete: false,
          manualMatches: [],
          teamRotation: 0,
        },
      }
    }))
  }

  const editActiveSessionDetails = (name: string, matchmakingMode: MatchmakingMode) => {
    if (!name.trim()) return
    updateActiveSession((session) => {
      if (session.startedAt) return session

      const changedToStack = matchmakingMode === 'win-lose-stack' && session.matchmakingMode !== 'win-lose-stack'
      const knownStackPlayers = new Set([
        ...session.winLoseStack.unplayed,
        ...session.winLoseStack.winners,
        ...session.winLoseStack.losers,
        ...(session.winLoseStack.returning ?? []),
      ])
      return {
        ...session,
        name: name.trim(),
        matchmakingMode,
        winLoseStack: changedToStack
          ? {
              ...session.winLoseStack,
              unplayed: [...session.winLoseStack.unplayed, ...session.playingIds.filter((id) => !knownStackPlayers.has(id))],
            }
          : session.winLoseStack,
      }
    })
  }

  const deleteQueue = (queueId: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== queueId))
    if (activeSessionId === queueId) {
      setActiveSessionId(null)
    }
  }

  const addMember = (name: string, skill: Skill) => {
    if (!name.trim() || !skillOrder.includes(skill)) return
    const newMember = { id: createId(), name: capitalizeName(name.trim()), skill }
    setMembers((prev) => [...prev, newMember])
    upsertStatsForNewMember(newMember.id)
  }

  const addMembersBulk = (names: string[], defaultSkill: Skill = 'Intermediate') => {
    const existingNameSet = new Set(members.map((member) => member.name.toLowerCase()))
    if (!skillOrder.includes(defaultSkill)) return

    const cleanedMembers = names
      .map((line) => {
        const trimmedLine = line.trim()
        const match = trimmedLine.match(/^(.*?)(?:\s+([1-7]))?$/)
        const name = (match?.[1] ?? trimmedLine).trim()
        const skillNumber = match?.[2] ? Number(match[2]) : null

        return {
          name: capitalizeName(name),
          skill: skillNumber ? skillOrder[skillNumber - 1] : defaultSkill,
        }
      })
      .filter((member) => member.name)
      .filter((member) => !existingNameSet.has(member.name.toLowerCase()))
      .filter(
        (member, index, array) =>
          array.findIndex(
            (item) => item.name.toLowerCase() === member.name.toLowerCase(),
          ) === index,
      )

    if (!cleanedMembers.length) return

    const newMembers = cleanedMembers.map((member) => ({
      id: createId(),
      name: member.name,
      skill: member.skill,
    }))

    setMembers((prev) => [...prev, ...newMembers])
    newMembers.forEach((member) => upsertStatsForNewMember(member.id))
  }

  const editMember = (memberId: string, name: string, skill: Skill) => {
    const target = members.find((m) => m.id === memberId)
    if (!target) return
    if (!name.trim() || !skillOrder.includes(skill)) return
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, name: name.trim(), skill } : m)),
    )
  }

  const deleteMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    setSessions((prev) =>
      prev.map((session) => ({
        ...session,
        nonPlayingIds: session.nonPlayingIds.filter((id) => id !== memberId),
        participantIds: (session.participantIds ?? []).filter((id) => id !== memberId),
        playingIds: session.playingIds.filter((id) => id !== memberId),
        winLoseStack: removePlayersFromStacks(session.winLoseStack, [memberId]),
        rosters: session.rosters
          .map((r) => ({ ...r, playerIds: r.playerIds.filter((id) => id !== memberId) }))
          .filter((r) => r.playerIds.length === 4),
        courts: session.courts.map((court) => ({
          ...court,
          teamA: court.teamA.filter((id) => id !== memberId),
          teamB: court.teamB.filter((id) => id !== memberId),
        })),
      })),
    )
  }

  const updateActiveSession = (updater: (session: Session) => Session) => {
    if (!activeSessionId) return
    setSessions((prev) =>
      prev.map((session) => (session.id === activeSessionId ? reconcileEloRatings(updater(session)) : session)),
    )
  }

  const addVisitors = (names: string[], defaultSkill: Skill = 'Intermediate') => {
    if (!activeSessionId || !skillOrder.includes(defaultSkill)) return
    const isWinLoseStack = activeSession?.matchmakingMode === 'win-lose-stack'

    const cleanedVisitors = names
      .map((line) => {
        const trimmedLine = line.trim()
        if (isWinLoseStack) {
          return { name: capitalizeName(trimmedLine), skill: defaultSkill }
        }
        const match = trimmedLine.match(/^(.*?)(?:\s+([1-7]))?$/)
        const name = (match?.[1] ?? trimmedLine).trim()
        const skillNumber = match?.[2] ? Number(match[2]) : null
        return {
          name: capitalizeName(name),
          skill: skillNumber ? skillOrder[skillNumber - 1] : defaultSkill,
        }
      })
      .filter((visitor) => visitor.name)

    updateActiveSession((session) => {
      const existingNames = new Set((session.visitors ?? []).map((visitor) => visitor.name.toLowerCase()))
      const uniqueVisitors = cleanedVisitors.filter(
        (visitor, index) =>
          !existingNames.has(visitor.name.toLowerCase()) &&
          cleanedVisitors.findIndex((item) => item.name.toLowerCase() === visitor.name.toLowerCase()) === index,
      )
      if (!uniqueVisitors.length) return session

      const newVisitors = uniqueVisitors.map((visitor) => ({
        ...visitor,
        id: createId(),
      }))
      const now = Date.now()
      const stats = { ...session.stats }
      const nextJoinedAt = Object.keys(stats).length
      newVisitors.forEach((visitor, index) => {
        stats[visitor.id] = {
          gamesPlayed: 0,
          wins: 0,
          missedGames: 0,
          joinedAt: nextJoinedAt + index + 1,
          waitingSince: now,
          totalWaitMs: 0,
          waitPeriods: 0,
          averageWaitMs: 0,
        }
      })

      return {
        ...session,
        visitors: [...(session.visitors ?? []), ...newVisitors],
        participantIds: [...session.participantIds, ...newVisitors.map((visitor) => visitor.id)],
        stats,
      }
    })
  }

  const editVisitor = (visitorId: string, name: string, skill: Skill) => {
    if (!name.trim() || !skillOrder.includes(skill)) return
    updateActiveSession((session) => ({
      ...session,
      visitors: (session.visitors ?? []).map((visitor) =>
        visitor.id === visitorId ? { ...visitor, name: name.trim(), skill } : visitor,
      ),
    }))
  }

  const deleteVisitor = (visitorId: string) => {
    updateActiveSession((session) => {
      const updatedRosters = session.rosters
        .map((roster) => ({
          ...roster,
          playerIds: roster.playerIds.filter((id) => id !== visitorId),
        }))
        .filter((roster) => roster.playerIds.length > 0)
      return {
        ...session,
        visitors: (session.visitors ?? []).filter((visitor) => visitor.id !== visitorId),
        participantIds: session.participantIds.filter((id) => id !== visitorId),
        playingIds: session.playingIds.filter((id) => id !== visitorId),
        priorityList: session.priorityList.filter((id) => id !== visitorId),
        playerList: session.playerList.filter((id) => id !== visitorId),
        winLoseStack: removePlayersFromStacks(session.winLoseStack, [visitorId]),
        rosters: updatedRosters,
        courts: session.courts.map((court) => ({
          ...court,
          teamA: court.teamA.filter((id) => id !== visitorId),
          teamB: court.teamB.filter((id) => id !== visitorId),
        })),
      }
    })
  }
  
  const moveToPlaying = (memberId: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeSessionId) return session
        if (session.playingIds.includes(memberId)) {
          return session
        }

        const memberStats = session.stats[memberId]

        const additionalMissedGames = getAdditionalMissedGames(session, memberStats)
        const missedGames = isSmartQueueMode(session.matchmakingMode)
          ? memberStats.missedGames + additionalMissedGames
          : Math.max(memberStats.missedGames, additionalMissedGames)

        const arrivedAt = Date.now()
        const updatedStats = {
          ...memberStats,
          missedGames,
          // Arrival is always recorded. The waiting clock starts at the session
          // start for early arrivals, or at arrival for players joining later.
          waitingSince: session.startedAt ? arrivedAt : memberStats.waitingSince,
          joinedAtTime: memberStats.joinedAtTime ?? arrivedAt,
        }

        const shouldPrioritize = isSmartQueueMode(session.matchmakingMode)
          ? additionalMissedGames > 0
          : missedGames > 0
        const isReturning = memberStats.gamesPlayed > 0

        return {
          ...session,

          playingIds: [...session.playingIds, memberId],
          ...(session.matchmakingMode === 'elo-smart-queue' ? { eloRatings: { ...session.eloRatings, [memberId]: session.eloRatings?.[memberId] ?? eloStartingRating } } : {}),

          participantIds: session.participantIds.includes(memberId)
            ? session.participantIds
            : [...session.participantIds, memberId],

          priorityList: shouldPrioritize
            ? [...session.priorityList, memberId]
            : session.priorityList,

          playerList: shouldPrioritize
            ? session.playerList
            : [...session.playerList, memberId],

          stats: {
            ...session.stats,
            [memberId]: updatedStats,
          },
          winLoseStack:
            session.matchmakingMode === 'win-lose-stack'
              ? lockReturningMatches({
                  ...session.winLoseStack,
                  initialPlayerIds:
                    !isReturning && session.startedAt && !session.winLoseStack.calibrationComplete &&
                    !session.winLoseStack.initialPlayerIds.includes(memberId)
                      ? [...session.winLoseStack.initialPlayerIds, memberId]
                      : session.winLoseStack.initialPlayerIds,
                  unplayed: isReturning || session.winLoseStack.unplayed.includes(memberId) ||
                    session.winLoseStack.winners.includes(memberId) ||
                    session.winLoseStack.losers.includes(memberId)
                    ? session.winLoseStack.unplayed
                    : [...session.winLoseStack.unplayed, memberId],
                  returning: isReturning && !session.winLoseStack.returning?.includes(memberId)
                    ? [...(session.winLoseStack.returning ?? []), memberId]
                    : session.winLoseStack.returning,
                }, session.courts)
              : session.winLoseStack,
        }
      }),
    )
  }
  
  const resignFromPlaying = (memberId: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeSessionId) return session
        const updatedRosters = session.rosters
          .map((roster) => ({
            ...roster,
            playerIds: roster.playerIds.filter(
              (id) => id !== memberId,
            ),
          }))
          .filter((roster) => roster.playerIds.length > 0)
          const affectedRosterIndex = session.rosters.findIndex((roster) =>
          roster.playerIds.includes(memberId),
        )

          const memberName = memberById[memberId]?.name ?? 'Player'

          if (affectedRosterIndex !== -1) {
            toast.warning(
              `${memberName} has resigned. Queue #${
                affectedRosterIndex + 1
              } now lacks players.`,
            )
          }

        return {
          ...session,

          playingIds: session.playingIds.filter(
            (id) => id !== memberId,
          ),

          priorityList: session.priorityList.filter(
            (id) => id !== memberId,
          ),

          playerList: session.playerList.filter(
            (id) => id !== memberId,
          ),

          rosters: updatedRosters,
          
          stats: {
            ...session.stats,
            [memberId]: {
              ...session.stats[memberId],
              waitingSince: Date.now(),
            },
          },
          winLoseStack:
            session.matchmakingMode === 'win-lose-stack'
              ? removeCalibrationPlayer(
                  removePlayersFromStacks(session.winLoseStack, [memberId]),
                  memberId,
                  session.stats,
                )
              : session.winLoseStack,
        }
      }),
    )
  }

  const setParticipant = (memberId: string, isParticipant: boolean) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeSessionId) return session
        const participantIds = session.participantIds ?? []
        if (isParticipant) {
          if (participantIds.includes(memberId)) return session
          return { ...session, participantIds: [...participantIds, memberId] }
        }

        if (!participantIds.includes(memberId)) return session
        const updatedRosters = session.rosters
          .map((roster) => ({
            ...roster,
            playerIds: roster.playerIds.filter((id) => id !== memberId),
          }))
          .filter((roster) => roster.playerIds.length > 0)
        return {
          ...session,
          participantIds: participantIds.filter((id) => id !== memberId),
          playingIds: session.playingIds.filter((id) => id !== memberId),
          priorityList: session.priorityList.filter((id) => id !== memberId),
          playerList: session.playerList.filter((id) => id !== memberId),
          rosters: updatedRosters,
          stats: {
            ...session.stats,
            [memberId]: {
              ...session.stats[memberId],
              waitingSince: Date.now(),
            },
          },
          winLoseStack:
            session.matchmakingMode === 'win-lose-stack'
              ? removeCalibrationPlayer(
                  removePlayersFromStacks(session.winLoseStack, [memberId]),
                  memberId,
                  session.stats,
                )
              : session.winLoseStack,
        }
      }),
    )
  }

  const getSkillLevel = (memberId: string) => {
    return activeSession ? getQueueSkill(activeSession, memberById[memberId]) : skillOrder.indexOf(memberById[memberId].skill) + 1
  }
      
  const getTeammateCount = (
    session: Session,
    playerA: string,
    playerB: string,
  ) => {
    let count = 0

    for (const match of session.history) {
      const teamA =
        match.teamA.includes(playerA) &&
        match.teamA.includes(playerB)

      const teamB =
        match.teamB.includes(playerA) &&
        match.teamB.includes(playerB)

      if (teamA || teamB) {
        count++
      }
    }

    return count
  }

  const getOpponentCount = (
    session: Session,
    playerA: string,
    playerB: string,
  ) => {
    let count = 0

    for (const match of session.history) {
      const teamA =
        match.teamA.includes(playerA)

      const teamB =
        match.teamB.includes(playerA)

      const playerBOnTeamA =
        match.teamA.includes(playerB)

      const playerBOnTeamB =
        match.teamB.includes(playerB)

      const wereOpponents =
        (teamA && playerBOnTeamB) ||
        (teamB && playerBOnTeamA)

      if (wereOpponents) {
        count++
      }
    }

    return count
  }

  const getDiversityScore = (
    session: Session,
    teamA: string[],
    teamB: string[],
  ) => {
    let score = 0

    score +=
      getTeammateCount(
        session,
        teamA[0],
        teamA[1],
      ) * 10

    score +=
      getTeammateCount(
        session,
        teamB[0],
        teamB[1],
      ) * 10

    for (const a of teamA) {
      for (const b of teamB) {
        score +=
          getOpponentCount(
            session,
            a,
            b,
          ) * 2
      }
    }

    return score
  }
  const getInGamePenalty = (
    players: string[],
    inGamePlayers: Set<string>,
  ) => {
    const inGameCount =
      players.filter((playerId) =>
        inGamePlayers.has(playerId),
      ).length

    return inGameCount * 100
  }
  // const getGameGapPenalty = (
  //   session: Session,
  //   players: string[],
  //   inGamePlayers: Set<string>,
  // ) => {
  //   const availablePlayers =
  //     session.playingIds.filter(
  //       (playerId) =>
  //         !inGamePlayers.has(playerId),
  //     )

  //   if (availablePlayers.length === 0) {
  //     return 0
  //   }

  //   const lowestTotalGames = Math.min(
  //     ...availablePlayers.map(
  //       (playerId) =>
  //         getTotalGames(
  //           session.stats[playerId],
  //         ),
  //     ),
  //   )

  //   return players.reduce(
  //     (penalty, playerId) => {
  //       const playerTotalGames =
  //         getTotalGames(
  //           session.stats[playerId],
  //         )

  //       const gamesAboveMinimum =
  //         Math.max(
  //           0,
  //           playerTotalGames - lowestTotalGames,
  //         )

  //       return (
  //         penalty +
  //         gamesAboveMinimum * 60
  //       )
  //     },
  //     0,
  //   )
  // }
  const getSkillOutlierPenalty = (
    players: string[],
  ) => {
    const skills =
      players.map((playerId) =>
        getSkillLevel(playerId),
      )

    const lowestSkill =
      Math.min(...skills)

    const highestSkill =
      Math.max(...skills)

    const skillSpread =
      highestSkill - lowestSkill

    if (skillSpread <= 1) {
      return 0
    }

    return (skillSpread - 1) * 25 
  }
  const getTeamBalancePenalty = (
    teamA: string[],
    teamB: string[],
  ) => {
    const teamASkill =
      teamA.reduce(
        (total, playerId) =>
          total + getSkillLevel(playerId),
        0,
      )

    const teamBSkill =
      teamB.reduce(
        (total, playerId) =>
          total + getSkillLevel(playerId),
        0, 
      )

    const skillGap =
      Math.abs(
        teamASkill - teamBSkill,
      )

    return skillGap * 15
  }
  const getRosterGameGap = (
    session: Session,
    players: string[],
  ) => {
    const inGamePlayers = new Set(
      session.courts.flatMap(court => [
        ...court.teamA,
        ...court.teamB,
      ]),
    )

    const totals = players.map(playerId => {
      return (
        getTotalGames(session.stats[playerId]) +
        (inGamePlayers.has(playerId) ? 1 : 0)
      )
    })

    return (
      Math.max(...totals) -
      Math.min(...totals)
    )
  }
  const getFairnessScore = (
    session: Session,
    memberId: string,
  ) => {
    if (!session.startedAt) return 0

    const stats = session.stats[memberId]

    const inGame = session.courts.some(({ teamA, teamB }) =>
      teamA.includes(memberId) || teamB.includes(memberId),
    )
    return calculateWaitingScore(getCurrentBenchWait(session, memberId, clock, inGame), stats.averageWaitMs ?? 0)
  }

const buildMatchSet = (
  session: Session,
  queueList: string[],
  preferredBasePlayerId?: string,
) => {
  const searches: ScoringSearch[] = []
  const queuedPlayers = new Set(
    session.rosters.flatMap(
      (roster) => roster.playerIds,
    ),
  )
  const inGamePlayers = new Set(
    session.courts.flatMap((court) => [...court.teamA, ...court.teamB]),
  )
  const activeCourts = session.courts
    .filter((court) => court.teamA.length > 0 && court.startedAt !== null)
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))

  const waitingPlayers = new Set(session.playingIds.filter(
    (id) => !queuedPlayers.has(id) && !inGamePlayers.has(id),
  ))
  const immediate = findCompatibleRoster(
    session, [...waitingPlayers], preferredBasePlayerId, queuedPlayers, inGamePlayers, inGamePlayers, searches, 'Bench players',
  )
  if (immediate) return immediate

  if (waitingPlayers.size === 3) {
    const eligiblePlayers = new Set(waitingPlayers)
    for (const court of activeCourts) {
      for (const id of [...court.teamA, ...court.teamB]) {
        if (!queuedPlayers.has(id)) eligiblePlayers.add(id)
      }
      const candidates = [...new Set([...queueList, ...eligiblePlayers])]
        .filter((id) => eligiblePlayers.has(id))
      const roster = findCompatibleRoster(
        session, candidates, preferredBasePlayerId, queuedPlayers, inGamePlayers, new Set(), searches, `Bench and upcoming courts through ${court.name}`,
      )
      if (roster) return roster
    }
    return null
  }

  const n = session.rosters.length - activeCourts.length + 1
  const eligibleCourtCount = n <= 0 || activeCourts.length === 0
    ? 0
    : Math.min(
        activeCourts.length,
        Math.max(1, Math.round(n / activeCourts.length)),
      )
  if (!eligibleCourtCount) return null
  const futurePlayers = new Set(activeCourts.slice(0, eligibleCourtCount)
    .flatMap(({ teamA, teamB }) => [...teamA, ...teamB]))
  const blockedInGamePlayers = new Set([...inGamePlayers].filter((id) => !futurePlayers.has(id)))
  return findCompatibleRoster(
    session, [...new Set([...queueList, ...session.playingIds])], preferredBasePlayerId,
    queuedPlayers, inGamePlayers, blockedInGamePlayers, searches, 'Future roster',
  )
}

const findCompatibleRoster = (
  session: Session,
  queueList: string[],
  preferredBasePlayerId: string | undefined,
  queuedPlayers: ReadonlySet<string>,
  inGamePlayers: Set<string>,
  blockedInGamePlayers: ReadonlySet<string>,
  searches: ScoringSearch[],
  label: string,
): AutomaticScoring | null => {
  const priority = new Set(session.priorityList)
  const arrivalOrder = new Map(session.playingIds.map((id, index) => [id, index]))
  const now = Date.now()
  const search: ScoringSearch = { label, players: {}, orderedIds: [], excluded: [], layers: [] }
  searches.push(search)
  const supplied = new Set(queueList)
  for (const id of new Set([...session.playingIds, ...queueList])) {
    const reason = queuedPlayers.has(id) ? 'Already in a queued roster'
      : !arrivalOrder.has(id) ? 'Outside active attendance'
      : !session.stats[id] || !memberById[id] ? 'Missing player data'
      : blockedInGamePlayers.has(id) || (!supplied.has(id) && inGamePlayers.has(id)) ? 'On court outside this search pool'
      : !supplied.has(id) ? 'Outside this search pool'
      : null
    if (reason) search.excluded.push({ name: memberById[id]?.name ?? id, reason })
  }
  if (queueList.length < 4) return null
  const players = [...new Set(queueList)]
    .filter((id) =>
      arrivalOrder.has(id) && session.stats[id] && memberById[id]
      && !queuedPlayers.has(id) && !blockedInGamePlayers.has(id),
    )
    .map((id) => {
      const stats = session.stats[id]
      const currentWait = getCurrentBenchWait(session, id, now, inGamePlayers.has(id))
      return {
        id,
        name: memberById[id].name,
        gamesPlayed: stats.gamesPlayed,
        missedGames: stats.missedGames,
        currentWait,
        averageWait: stats.averageWaitMs ?? 0,
        totalGames: getTotalGames(stats),
        skill: getQueueSkill(session, memberById[id]),
        waitingScore: calculateWaitingScore(currentWait, stats.averageWaitMs ?? 0),
        latePriority: priority.has(id),
        arrivalOrder: arrivalOrder.get(id)!,
      }
    })
  search.players = Object.fromEntries(players.map((player) => [player.id, player]))
  const pool = findSmartQueuePool(players, preferredBasePlayerId, {
    onOrder: (ids) => { search.orderedIds = ids },
    onLayer: (attempt) => { search.layers.push(attempt) },
  })
  if (!pool) return null

  const maxWaitingScore = players.reduce((max, player) => Math.max(max, player.waitingScore), 0)
  const arrangements: ScoredArrangement[] = []
  const winner = selectSmartQueueArrangement(
    pool.base, pool.candidates, maxWaitingScore, buildPairingCounts(session.history),
    ([[a, b], [c, d]], score) => {
      arrangements.push({ teams: [[a.id, b.id], [c.id, d.id]], score })
    },
  )
  if (!winner) return null
  const winnerIds = winner.teams.flat().map(({ id }) => id)
  const winnerIndex = arrangements.findIndex(({ teams }) =>
    teams.flat().every((id, index) => id === winnerIds[index]),
  )
  return {
    players: search.players,
    searches, thresholds: compatibilityLayers, formula: { ...smartQueueFormula },
    baseId: pool.base.id, preferredBaseId: preferredBasePlayerId, layer: pool.layer,
    arrangements, winnerIndex,
    reason: 'Uses the first successful compatibility layer, reserves available places for eligible Late Priority players in queue order, then selects the highest composite score. Exact ties go to the arrangement evaluated first.',
  }
}

  const balanceTeams = (
    playerIds: string[],
  ) => {
    if (playerIds.length !== 4) {
      return playerIds
    }

    const getTotalSkill = (ids: string[]) =>
      ids.reduce(
        (sum, id) => sum + getSkillLevel(id),
        0,
      )

    const combinations = [
      [
        [playerIds[0], playerIds[1]],
        [playerIds[2], playerIds[3]],
      ],
      [
        [playerIds[0], playerIds[2]],
        [playerIds[1], playerIds[3]],
      ],
      [
        [playerIds[0], playerIds[3]],
        [playerIds[1], playerIds[2]],
      ],
    ]

    let bestMatch = combinations[0]
    let smallestDifference = Infinity

    for (const matchup of combinations) {
      const teamA = matchup[0]
      const teamB = matchup[1]

      const diff = Math.abs(
        getTotalSkill(teamA) -
          getTotalSkill(teamB),
      )

      if (diff < smallestDifference) {
        smallestDifference = diff
        bestMatch = matchup
      }
    }

    return [
      ...bestMatch[0],
      ...bestMatch[1],
    ]
  }

  const buildSelectedPairMatch = (
    session: Session,
    queueList: string[],
    selectedIds: string[],
  ) => {
    if (selectedIds.length !== 2) {
      return []
    }

    const queuedPlayers = new Set(
      session.rosters.flatMap(
        (roster) => roster.playerIds,
      ),
    )

    const [playerA, playerB] = selectedIds

    const teamASkill =
      getSkillLevel(playerA) +
      getSkillLevel(playerB)

    const lowestSkill = Math.min(
      getSkillLevel(playerA),
      getSkillLevel(playerB),
    )
    let bestRoster: string[] = []
    let bestGameGap = Infinity
    let lowestScore = Infinity

    const inGamePlayers = new Set(
      session.courts.flatMap((court) => [
        ...court.teamA,
        ...court.teamB,
      ]),
    )

    for (const playerC of queueList) {
      if (
        selectedIds.includes(playerC) ||
        queuedPlayers.has(playerC)
      ) {
        continue
      }

      const playerCSkill =
        getSkillLevel(playerC)

      if (
        playerCSkill !== lowestSkill &&
        playerCSkill !== lowestSkill + 1
      ) {
        continue
      }

      for (const playerD of queueList) {
        if (
          selectedIds.includes(playerD) ||
          playerD === playerC ||
          queuedPlayers.has(playerD)
        ) {
          continue
        }

        const teamBSkill =
          playerCSkill +
          getSkillLevel(playerD)

        const skillDifference = Math.abs(
          teamASkill - teamBSkill,
        )

        if (skillDifference > 2) {
          continue
        }

        const rosterPlayers = [
          playerA,
          playerB,
          playerC,
          playerD,
        ]

        const rosterGameGap =
          getRosterGameGap(
            session,
            rosterPlayers,
          )

        const diversityScore =
          getDiversityScore(
            session,
            [playerA, playerB],
            [playerC, playerD],
          )

        const inGamePenalty =
          getInGamePenalty(
            rosterPlayers,
            inGamePlayers,
          )

        const skillOutlierPenalty =
          getSkillOutlierPenalty(
            rosterPlayers,
          )

        const teamBalancePenalty =
          getTeamBalancePenalty(
            [playerA, playerB],
            [playerC, playerD],
          )

        const waitingReward =
          Math.round(
            rosterPlayers.reduce(
              (sum, playerId) =>
                sum +
                getFairnessScore(session, playerId),
              0,
            ) / 60000,
          )

        const totalScore =
          diversityScore +
          inGamePenalty +
          skillOutlierPenalty +
          teamBalancePenalty -
          waitingReward

        if (rosterGameGap < bestGameGap) {
          bestGameGap = rosterGameGap
          lowestScore = totalScore
          bestRoster = rosterPlayers
        } else if (
          rosterGameGap === bestGameGap &&
          totalScore < lowestScore
        ) {
          lowestScore = totalScore
          bestRoster = rosterPlayers
        }
      }
    }

    return bestRoster
  }
  const generateRoster = () => {
    const id = createId()
    const createdAt = new Date().toISOString()
    const snapshotFields = (session: Session, playerIds: string[], detail: { scoring: AutomaticScoring } | { manualReason: string }) => {
      const snapshot: ScoringSnapshot = { id, createdAt, playerNames: playerIds.map((id) => memberById[id]?.name ?? id), ...detail }
      return [snapshot, ...(session.scoringSnapshots ?? [])].slice(0, scoringHistoryLimit)
    }
    updateActiveSession((session) => {
      if (session.endedAt || !isSmartQueueMode(session.matchmakingMode)) return session
      const queueList = buildQueueList(session)

      const incompleteRosterIndex =
        session.rosters.findIndex(
          (roster) => roster.playerIds.length < 4,
        )

      if (incompleteRosterIndex !== -1) {
        const incompleteRoster =
          session.rosters[incompleteRosterIndex]

        const missingSlots =
          4 - incompleteRoster.playerIds.length

        const allQueuedPlayers = new Set(
          session.rosters.flatMap(
            (roster) => roster.playerIds,
          ),
        )

        const availablePlayers = queueList.filter(
          (id) =>
            !incompleteRoster.playerIds.includes(id) &&
            !allQueuedPlayers.has(id),
        )

        const selectedPlayers = balanceTeams([
          ...incompleteRoster.playerIds,
          ...availablePlayers.slice(0, missingSlots),
        ])

        const updatedRosters = [...session.rosters]

        updatedRosters[incompleteRosterIndex] = {
          ...incompleteRoster,
          playerIds: selectedPlayers,

          baseOrder: selectedPlayers, 
          rotationIndex: 0,
        }

        return {
          ...session,
          rosters: updatedRosters,
          ...(selectedPlayers.length === 4 ? { scoringSnapshots: snapshotFields(session, selectedPlayers, { manualReason: 'Completed an existing roster' }) } : {}),
        }
      }
      if (manualPickIds.length === 2) {
        const selectedMatch =
          buildSelectedPairMatch(
            session,
            queueList,
            manualPickIds,
          )

        if (selectedMatch.length < 4) {
          toast.warning(
            'Unable to find compatible opponents.',
          )

          return session
        }

        return {
          ...session,
          scoringSnapshots: snapshotFields(session, selectedMatch, { manualReason: 'Manually selected teammates' }),
          rosters: [
            ...session.rosters,
            {
              id,
              playerIds: selectedMatch,
              baseOrder: selectedMatch,
              rotationIndex: 0,
              createdAt,
            },
          ],
        }
      }
      if (manualPickIds.length > 1) return session
      const scoring = buildMatchSet(session, queueList, manualPickIds[0])

      if (!scoring) {
        toast.warning(
          'Not enough compatible players found.',
        )

        return session
      }

      const selectedPlayers = scoring.arrangements[scoring.winnerIndex].teams.flat()
      return {
        ...session,
        scoringSnapshots: snapshotFields(session, selectedPlayers, { scoring }),
        rosters: [
          ...session.rosters,
          {
            id,
            playerIds: selectedPlayers,
            baseOrder: selectedPlayers, 
            rotationIndex: 0,
            createdAt,
          },
        ],
      }
    })
    setManualPickIds([])
  }
  const rotateRosterOrder = (
      playerIds: string[],
    ): string[][] => {
      if (playerIds.length !== 4) {
        return [playerIds]
      }

      const [a, b, c, d] = playerIds

      const rotations = [ 
        [a, b, c, d], 
        [a, c, b, d], 
        [a, d, b, c],
    ] 
      return rotations
    }
  const shuffleRoster = (
    rosterId: string,
  ) =>
    updateActiveSession((session) => {
      const updatedRosters =
        session.rosters.map((roster) => {
          if (roster.id !== rosterId) {
            return roster
          }

          const baseOrder = 
            roster.baseOrder ?? 
            roster.playerIds
          
          const rotations =
            rotateRosterOrder(baseOrder)

          const nextIndex = 
          ((roster.rotationIndex ?? 0) + 1) % 
          rotations.length 

          return { 
            ...roster, 
            rotationIndex: nextIndex, 
            playerIds: rotations[nextIndex], 
          }
        })

      return {
        ...session,
        rosters: updatedRosters,
      }
    })

  const queueManualRoster = () => {
    if (manualPickIds.length !== 4) return
    const id = createId()
    const createdAt = new Date().toISOString()
    updateActiveSession((session) => {
      if (session.endedAt) return session
      const snapshot: ScoringSnapshot = {
        id, createdAt,
        playerNames: manualPickIds.map((id) => memberById[id]?.name ?? id),
        manualReason: 'Manually selected four players',
      }
      return {
        ...session,
        ...(isSmartQueueMode(session.matchmakingMode) ? {
          scoringSnapshots: [snapshot, ...(session.scoringSnapshots ?? [])].slice(0, scoringHistoryLimit),
        } : {}),
        rosters: [
          ...session.rosters,
          {
            id,
            playerIds: manualPickIds,
            baseOrder: manualPickIds,
            rotationIndex: 0,
            createdAt,
            
          },
        ],
      }
    })
    setManualPickIds([])
  } 

  const dissolveRoster = (
    rosterId: string,
  ) =>
    updateActiveSession((session) => {
      return {
        ...session,
        rosters: session.rosters.filter(
          (r) => r.id !== rosterId,
        ),
      }
    })


  const replaceRosterPlayer = (rosterId: string, slotIndex: number, memberId: string) =>
    updateActiveSession((session) => {
      const roster = session.rosters.find((item) => item.id === rosterId)
      if (!roster || slotIndex < 0 || slotIndex > 3) return session
      if (!session.playingIds.includes(memberId)) return session

      const alreadyUsedInQueue = session.rosters.some(
        (item) => item.playerIds.includes(memberId),
      )
      if (alreadyUsedInQueue && roster.playerIds[slotIndex] !== memberId) {
        return session
      }

      const updatedPlayerIds = [...roster.playerIds]
      updatedPlayerIds[slotIndex] = memberId
      if (new Set(updatedPlayerIds).size !== 4) return session

      return {
        ...session,
        rosters: session.rosters.map((item) =>
          item.id === rosterId
            ? {
                ...item,
                playerIds: updatedPlayerIds,
                baseOrder: updatedPlayerIds,
                rotationIndex: 0,
              }
            : item,
        ),
      }
    })

  const addCourt = () =>
    updateActiveSession((session) => ({
      ...session,
      courts: [
        ...session.courts,
        {
          id: createId(),
          name: `Court ${session.courts.length + 1}`,
          teamA: [],
          teamB: [],
          scoreA: 0,
          scoreB: 0,
          startedAt: null,
        },
      ],
    }))

  const removeCourt = (courtId: string) =>
    updateActiveSession((session) => {
      const target = session.courts.find((court) => court.id === courtId)
      if (!target || target.teamA.length || target.teamB.length) return session
      return { ...session, courts: session.courts.filter((court) => court.id !== courtId) }
    })

  const renameCourt = (courtId: string, name: string) =>
    updateActiveSession((session) => ({
      ...session,
      courts: session.courts.map((court, index) =>
        court.id === courtId
          ? { ...court, name: name || `Court ${index + 1}` }
          : court,
      ),
    }))

  const assignToCourt = (rosterId: string, courtId?: string) =>
    updateActiveSession((session) => {
      if (session.endedAt) return session
      if (!session.startedAt) {
        toast.warning('Please start the queue before sending players to a court.')
        return session
      }
      const roster = session.rosters.find((r) => r.id === rosterId)
      if (!roster || roster.playerIds.length !== 4) return session
      const court = courtId
        ? session.courts.find((c) => c.id === courtId && c.teamA.length === 0 && c.teamB.length === 0)
        : session.courts.find((c) => c.teamA.length === 0 && c.teamB.length === 0)
      if (!court) return session
      if (!isCourtLineupAvailable(session, roster.playerIds)) {
        toast.warning('Cannot start queue. One or more players are unavailable.')
        return session
      }

      const startedAt = Date.now()
      const waitingRecords = getCourtWaitingRecords(session, roster.playerIds, startedAt)
      const preMatchWaiting = isSmartQueueMode(session.matchmakingMode)
        ? snapshotCourtWaiting(session, roster.playerIds) : undefined
      const [a1, a2, b1, b2] = roster.playerIds
      return {
        ...session,
        ...clearLatePriority(session, roster.playerIds),
        stats: recordBenchWaits(session, waitingRecords),
        rosters: session.rosters.filter((r) => r.id !== rosterId),
        courts: session.courts.map((c) =>
          c.id === court.id
            ? {
                ...c,
                teamA: [a1, a2],
                teamB: [b1, b2],
                scoreA: 0,
                scoreB: 0,
                startedAt,
                waitingRecords,
                preMatchWaiting,
              }
            : c,
        ),
      }
    })

  const setStackPlayingNext = (playingNext: 'winner' | 'loser') =>
    updateActiveSession((session) =>
      session.matchmakingMode === 'win-lose-stack'
        ? { ...session, winLoseStack: { ...session.winLoseStack, playingNext } }
        : session,
    )

  const shuffleStackTeams = () =>
    updateActiveSession((session) =>
      session.matchmakingMode === 'win-lose-stack'
        ? {
            ...session,
            winLoseStack: {
              ...session.winLoseStack,
              teamRotation: ((session.winLoseStack.teamRotation ?? 0) + 1) % 3,
            },
          }
        : session,
    )

  const createStackManualMatch = () => {
    if (manualPickIds.length !== 4) return
    updateActiveSession((session) => {
      if (session.matchmakingMode !== 'win-lose-stack' || session.endedAt) return session
      const eligible = new Set([
        ...session.winLoseStack.unplayed,
        ...session.winLoseStack.winners,
        ...session.winLoseStack.losers,
        ...(session.winLoseStack.returning ?? []),
      ])
      if (manualPickIds.some((id) => !eligible.has(id))) return session
      const playerSources = Object.fromEntries(manualPickIds.map((id) => [
        id,
        session.winLoseStack.unplayed.includes(id)
          ? 'unplayed'
          : session.winLoseStack.winners.includes(id)
            ? 'winner'
            : session.winLoseStack.losers.includes(id)
              ? 'loser'
              : 'returning',
      ] as const))
      const stack = removePlayersFromStacks(session.winLoseStack, manualPickIds)
      return {
        ...session,
        winLoseStack: {
          ...stack,
          manualMatches: [...stack.manualMatches, {
            id: createId(),
            playerIds: [...manualPickIds],
            playerSources,
            createdAt: new Date().toISOString(),
          }],
        },
      }
    })
    setManualPickIds([])
  }

  const dissolveStackManualMatch = (matchId: string) =>
    updateActiveSession((session) => {
      const match = session.winLoseStack.manualMatches.find((item) => item.id === matchId)
      if (!match) return session
      const stack = { ...session.winLoseStack, manualMatches: session.winLoseStack.manualMatches.filter((item) => item.id !== matchId) }
      return { ...session, winLoseStack: restorePlayersToStacks(stack, match.playerSources) }
    })

  const skipStackPlayer = (playerId: string) =>
    updateActiveSession((session) => {
      if (session.matchmakingMode !== 'win-lose-stack' || session.endedAt) return session
      const stack = skipNextStackPlayer(session.winLoseStack, playerId, session.courts)
      if (!stack) {
        toast.warning('No replacement is available from the same stack.')
        return session
      }
      return { ...session, winLoseStack: stack }
    })

  const prioritizeStackMatch = (playerIds: string[]) =>
    updateActiveSession((session) => {
      if (session.matchmakingMode !== 'win-lose-stack' || session.endedAt) return session
      const match = buildUpcomingStackMatches(session.winLoseStack, session.courts).find((item) =>
        item.complete && item.playerIds.length === playerIds.length &&
        playerIds.every((id) => item.playerIds.includes(id)),
      )
      if (!match) return session
      return {
        ...session,
        winLoseStack: { ...session.winLoseStack, prioritizedPlayerIds: [...match.playerIds] },
      }
    })

  const assignStackMatchToCourt = (matchId: string | null, courtId: string, playerIds: string[]) =>
    updateActiveSession((session) => {
      if (session.matchmakingMode !== 'win-lose-stack' || session.endedAt || !session.startedAt) return session
      const court = courtId
        ? session.courts.find((item) => item.id === courtId && !item.teamA.length && !item.teamB.length)
        : session.courts.find((item) => !item.teamA.length && !item.teamB.length)
      if (!court) return session
      const manualMatch = matchId ? session.winLoseStack.manualMatches.find((item) => item.id === matchId) : null
      const next = buildUpcomingStackMatches(session.winLoseStack, session.courts)[0]
      if (!next?.complete || (next.id ?? null) !== matchId ||
          playerIds.some((id, index) => next.playerIds[index] !== id)) {
        toast.warning('The next match changed. Please select a court again.')
        return session
      }
      const automatic = !matchId && next?.complete && !next.manual ? next : null
      const match = manualMatch ?? automatic
      if (!match || !isCourtLineupAvailable(session, match.playerIds)) return session
      const stack = manualMatch
        ? { ...session.winLoseStack, manualMatches: session.winLoseStack.manualMatches.filter((item) => item.id !== manualMatch.id) }
        : { ...removePlayersFromStacks(session.winLoseStack, match.playerIds), playingNext: automatic!.playingNextAfter }
      const dispatchedIndex = manualMatch ? -1 : buildStackRotation(session.winLoseStack)
        .findIndex((item) => item.playerIds[0] === match.playerIds[0])
      const startedAt = Date.now()
      const waitingRecords = getCourtWaitingRecords(session, match.playerIds, startedAt)
      const [first, second, third, fourth] = match.playerIds
      const teams = [
        [[first, third], [second, fourth]],
        [[first, second], [third, fourth]],
        [[first, fourth], [second, third]],
      ][session.winLoseStack.teamRotation ?? 0]
      return {
        ...session,
        stats: recordBenchWaits(session, waitingRecords),
        winLoseStack: {
          ...stack,
          prioritizedPlayerIds: undefined,
          returningMatches: stack.returningMatches?.map((item) =>
            dispatchedIndex >= 0 && item.index > dispatchedIndex
              ? { ...item, index: item.index - 1 }
              : item,
          ),
        },
        courts: session.courts.map((item) => item.id === court.id ? {
          ...item,
          teamA: teams[0],
          teamB: teams[1],
          scoreA: 0,
          scoreB: 0,
          startedAt,
          waitingRecords,
          stackPlayerSources: match.playerSources,
        } : item),
      }
    })

  const updateCourtScore = (courtId: string, team: 'A' | 'B', value: number) =>
    updateActiveSession((session) => ({
      ...session,
      courts: session.courts.map((court) =>
        court.id === courtId
          ? {
              ...court,
              scoreA: team === 'A' ? value : court.scoreA,
              scoreB: team === 'B' ? value : court.scoreB,
            }
          : court,
      ),
    }))
  const forfeitMatch = (courtId: string) =>
    updateActiveSession((session) => {
      const target = session.courts.find((court) => court.id === courtId)
      if (!target || target.teamA.length === 0 || target.teamB.length === 0) return session
      
      const waiting = isSmartQueueMode(session.matchmakingMode)
        ? rollbackCourtWaiting(session, target)
        : { stats: getFinishedCourtWait(session, target, Date.now()).stats }
      return {
        ...session,
        ...waiting,
        winLoseStack:
          session.matchmakingMode === 'win-lose-stack' && target.stackPlayerSources
            ? restorePlayersToStacks(session.winLoseStack, target.stackPlayerSources)
            : session.winLoseStack,
        courts: session.courts.map((court) =>
          court.id === courtId
            ? {
                ...court,
                teamA: [],
                teamB: [],
                scoreA: 0,
                scoreB: 0,
                startedAt: null,
                waitingRecords: undefined,
                preMatchWaiting: undefined,
              }
            : court,
        ),
      }
    })

  const updateHistoryMatch = (
    matchId: string,
    changes: Pick<MatchHistory, 'teamA' | 'teamB' | 'scoreA' | 'scoreB'>,
  ) =>
    updateActiveSession((session) => {
      const match = session.history.find((item) => item.id === matchId)
      if (!match) return session

      const scoreA = Number.isFinite(changes.scoreA)
        ? Math.max(0, changes.scoreA)
        : 0
      const scoreB = Number.isFinite(changes.scoreB)
        ? Math.max(0, changes.scoreB)
        : 0
      const result: MatchHistory['result'] =
        scoreA === scoreB ? 'draw' : scoreA > scoreB ? 'teamA' : 'teamB'
      const previousWinners =
        match.result === 'teamA'
          ? match.teamA
          : match.result === 'teamB'
            ? match.teamB
            : []
      const nextWinners =
        result === 'teamA' ? changes.teamA : result === 'teamB' ? changes.teamB : []
      const updatedStats = { ...session.stats }

      for (const memberId of new Set([...previousWinners, ...nextWinners])) {
        const stats = updatedStats[memberId]
        if (!stats) continue
        updatedStats[memberId] = {
          ...stats,
          wins:
            stats.wins - (previousWinners.includes(memberId) ? 1 : 0) +
            (nextWinners.includes(memberId) ? 1 : 0),
        }
      }

      return {
        ...session,
        stats: updatedStats,
        history: session.history.map((item) =>
          item.id === matchId
            ? {
                ...item,
                teamA: changes.teamA,
                teamB: changes.teamB,
                scoreA,
                scoreB,
                result,
              }
            : item,
        ),
      }
    })

  const endMatch = (courtId: string, scoreA: number, scoreB: number) =>
    updateActiveSession((session) => {
      const target = session.courts.find((court) => court.id === courtId)
      if (!target || target.teamA.length === 0 || target.teamB.length === 0) return session
      const safeScoreA = Number.isFinite(scoreA) ? Math.max(0, scoreA) : 0
      const safeScoreB = Number.isFinite(scoreB) ? Math.max(0, scoreB) : 0
      const matchResult: MatchHistory['result'] =
        safeScoreA === safeScoreB ? 'draw' : safeScoreA > safeScoreB ? 'teamA' : 'teamB'
      const winnerIds =
        matchResult === 'draw'
          ? []
          : matchResult === 'teamA'
            ? target.teamA
            : target.teamB
      const endedAt = Date.now()
      const startedAt = target.startedAt ?? endedAt
      const matchPlayerIds = [...target.teamA, ...target.teamB]
      const { stats: updatedStats, waitingRecords } = getFinishedCourtWait(session, target, endedAt)
      for (const memberId of matchPlayerIds) {
        const stats = updatedStats[memberId]
        updatedStats[memberId] = {
          ...stats,
          gamesPlayed: stats.gamesPlayed + 1,
          wins: stats.wins + Number(winnerIds.includes(memberId)),
        }
      }

      const stackBeforeResult = session.matchmakingMode === 'win-lose-stack'
        ? lockReturningMatches(session.winLoseStack, session.courts)
        : session.winLoseStack
      const nextWinLoseStack =
        session.matchmakingMode === 'win-lose-stack'
          ? matchResult === 'draw'
            ? restorePlayersToStacks(stackBeforeResult, target.stackPlayerSources ?? {})
            : appendResultToStacks(
                stackBeforeResult,
                winnerIds,
                matchPlayerIds.filter((id) => !winnerIds.includes(id)),
              )
          : session.winLoseStack
      const calibrationComplete =
        nextWinLoseStack.calibrationComplete ||
        nextWinLoseStack.initialPlayerIds.length === 0 ||
        nextWinLoseStack.initialPlayerIds.every(
          (memberId) => (updatedStats[memberId]?.gamesPlayed ?? 0) > 0,
        )

      return {
        
        ...session,
        stats: updatedStats,
        ...(isSmartQueueMode(session.matchmakingMode)
          ? clearLatePriority(session, matchPlayerIds)
          : {}),
        winLoseStack:
          session.matchmakingMode === 'win-lose-stack'
            ? { ...nextWinLoseStack, calibrationComplete }
            : nextWinLoseStack,
        history: [
          {
            id: createId(),
            ...(session.matchmakingMode === 'elo-smart-queue' ? { eloAdjustment: eloRatingAdjustment } : {}),
            courtLabel:
              target.name ??
              `Court ${session.courts.findIndex((c) => c.id === courtId) + 1}`,
            teamA: [...target.teamA],
            teamB: [...target.teamB],
            scoreA: safeScoreA,
            scoreB: safeScoreB ,
            result: matchResult,
            startedAt,
            endedAt,
            durationMs: Math.max(0, endedAt - startedAt),
            waitingRecords,
          },
          ...session.history,
        ],
        courts: session.courts.map((court) =>
          court.id === courtId
            ? {
                ...court,
                teamA: [],
                teamB: [],
                scoreA: 0,
                scoreB: 0,
                startedAt: null,
                waitingRecords: undefined,
                preMatchWaiting: undefined,
                stackPlayerSources: undefined,
              }
            : court,
        ),
      }
    })

  const getSessionPlayerStatus = (memberId: string, session: Session) => {
    const onCourt = session.courts.some((court) =>
      [...court.teamA, ...court.teamB].includes(memberId),
    )
    if (onCourt) return 'playing'
    const inQueue = session.rosters.some((r) => r.playerIds.includes(memberId))
    if (inQueue) return 'queueing'
    return 'waiting'
  }

  const activePlayingMembers = useMemo(() => {
    if (!activeSession) return []
    return [...activeSession.playingIds].sort((a, b) => {
      const aMember = memberById[a]
      const bMember = memberById[b]
      const aStats = activeSession.stats[a]
      const bStats = activeSession.stats[b]
      switch (playingSort) {
        case 'games':
          return bStats.gamesPlayed - aStats.gamesPlayed
        case 'wins':
          return bStats.wins - aStats.wins
        case 'skill':
          return getQueueSkill(activeSession, bMember) - getQueueSkill(activeSession, aMember)
        case 'name':
          return aMember.name.localeCompare(bMember.name)
        case 'queue': {
          const queueList = buildQueueList(activeSession)

          return (
            queueList.indexOf(a) -
            queueList.indexOf(b)
          )
        }
        case 'arrival':
        default:
          return aStats.joinedAt - bStats.joinedAt
      }
    })
  }, [activeSession, memberById, playingSort, sessions])

  

const buildQueueList = (
  session: Session,
) => {
  const inGamePlayers = new Set(
    session.courts.flatMap((court) => [
      ...court.teamA,
      ...court.teamB,
    ]),
  )

  const sortByWaitingTime = (
    a: string,
    b: string,
  ) => {
    return (
      getFairnessScore(session, b) -
      getFairnessScore(session, a)
    )
  }

  const priorityPlayers =
    [...session.priorityList]
      .sort(sortByWaitingTime)

  const regularPlayers =
    [...session.playerList]
      .sort((a, b) => {
      const aGames =
        getTotalGames(
          session.stats[a],
        ) +
        (inGamePlayers.has(a)
          ? 1
          : 0)

        const bGames =
          getTotalGames(
            session.stats[b],
          ) +
          (inGamePlayers.has(b)
            ? 1
            : 0)

          if (aGames !== bGames) {
            return aGames - bGames
          }

          const aInGame =
            inGamePlayers.has(a)

          const bInGame =
            inGamePlayers.has(b)

          if (aInGame !== bInGame) {
            return aInGame ? 1 : -1
          }


        return (
          getFairnessScore(session, b) -
          getFairnessScore(session, a)
        )
      })

  return [
    ...priorityPlayers,
    ...regularPlayers,
  ]
}

const buildSessionHistorySnapshot = (
  session: Session,
): SessionHistory => {
  const rankings =
    Object.entries(session.stats)
      .map(([memberId, stats]) => {
        const losses =
          stats.gamesPlayed - stats.wins

        const winRate =
          stats.gamesPlayed === 0
            ? 0
            : (stats.wins / stats.gamesPlayed) * 100

        return {
          memberId,

          skillLevel:
            memberById[memberId]?.skill ??
            'Newbie',

          totalGames:
            stats.gamesPlayed +
            stats.missedGames,

          wins: stats.wins,

          losses,

          missedGames:
            stats.missedGames,

          gamesPlayed:
            stats.gamesPlayed,

          winRate,
        }
      })
      .sort((a, b) => b.winRate - a.winRate)

  const lastMatch =
    session.history[0]

  return {
    id: createId(),

    title:
      session.name,

    createdAt:
      session.createdAt,

    endedAt:
      session.endedAt
        ? new Date(session.endedAt).toISOString()
        : lastMatch?.endedAt
        ? new Date(lastMatch.endedAt).toISOString()
        : new Date().toISOString(),

    totalMatches:
      session.history.length,

    totalPlayers:
      session.playerList.length,

    rankings,

    matches:
      session.history,
  }
}

const escapeCSVValue = (value: string) => {
  if (!/[",\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

const formatCSVDate = (timestamp?: number | null) =>
  timestamp ? new Date(timestamp).toISOString() : ''

const formatDuration = (durationMs?: number) => {
  if (durationMs === undefined) return ''

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

const csvFileName = (session: Session) =>
  `${session.name.replace(/[\\/:*?"<>|]/g, '-')}.csv`

const buildSessionCSV = (
  session: Session,
  memberById: Record<string, Member>,
) => {
  const skillValue = (memberId: string) => {
    const skill = memberById[memberId]?.skill

    if (!skill) return 0

    return skillOrder.indexOf(skill) + 1
  }

  const teamSkillTotal = (memberIds: string[]) =>
    memberIds.reduce((total, memberId) => total + skillValue(memberId), 0)

  const playerName = (memberId: string) =>
    memberById[memberId]?.name ?? 'Unknown'

  const matchWinner = (match: MatchHistory) => {
    if (match.result === 'draw') return 'Draw'

    return match.result === 'teamA' ? 'Team A' : 'Team B'
  }

  const matches = [...session.history].sort(
    (a, b) => (a.startedAt ?? a.endedAt) - (b.startedAt ?? b.endedAt),
  )

  const rows: string[][] = [
    ['Session Information'],
    ['Session Name', session.name],
    ['Session Created At', session.createdAt],
    ['Session Started At', formatCSVDate(session.startedAt)],
    ['Session Ended At', formatCSVDate(session.endedAt)],
    ['Exported At', new Date().toISOString()],
    [],
    ['Players Information'],
    [
      'Player ID',
      'Name',
      'Skill',
      'Skill Value',
      'Date Joined',
      'Games Played',
      'Wins',
      'Losses',
      'Missed Games',
      'Total Wait',
      'Average Wait',
      'Wait Periods',
    ],
  ]

  Object.entries(session.stats)
    .filter(([, stats]) => stats.joinedAtTime !== undefined && stats.joinedAtTime !== null)
    .sort(([, aStats], [, bStats]) => aStats.joinedAt - bStats.joinedAt)
    .forEach(([memberId, stats]) => {
      rows.push([
        memberId,
        playerName(memberId),
        memberById[memberId]?.skill ?? 'Unknown',
        `${skillValue(memberId)}`,
        formatCSVDate(stats.joinedAtTime),
        `${stats.gamesPlayed}`,
        `${stats.wins}`,
        `${Math.max(0, stats.gamesPlayed - stats.wins)}`,
        `${stats.missedGames}`,

        formatDuration(stats.totalWaitMs),
        formatDuration(stats.averageWaitMs),
        `${stats.waitPeriods}`,
      ])
    })

  rows.push(
    [],
    ['Queue Performance - Match Records'],
    [
      'Match Number',
      'Court',
      'Team A Players',
      'Team B Players',
      'Team A Skill Total',
      'Team B Skill Total',
      'Start Time',
      'End Time',
      'Match Duration',
      'Winner',
      'Team A Score',
      'Team B Score',
    ],
  )

  matches.forEach((match, index) => {
    rows.push([
      `${index + 1}`,
      match.courtLabel,
      match.teamA.map(playerName).join(' / '),
      match.teamB.map(playerName).join(' / '),
      `${teamSkillTotal(match.teamA)}`,
      `${teamSkillTotal(match.teamB)}`,
      formatCSVDate(match.startedAt),
      formatCSVDate(match.endedAt),
      formatDuration(
        match.durationMs ??
          (match.startedAt ? Math.max(0, match.endedAt - match.startedAt) : undefined),
      ),
      matchWinner(match),
      `${match.scoreA}`,
      `${match.scoreB}`,
    ])
  })

  rows.push(
    [],
    ['Waiting Time Records'],
    [
      'Match Number',
      'Player ID',
      'Player',
      'Game Number',
      'Waiting Started At',
      'Match Started At',
      'Waiting Duration',
      'Waiting Seconds',
    ],
  )

  matches.forEach((match, index) => {
    const matchPlayerIds = [...match.teamA, ...match.teamB]

    matchPlayerIds.forEach((memberId) => {
      const waitingRecord = match.waitingRecords?.find(
        (record) => record.memberId === memberId,
      )

      rows.push([
        `${index + 1}`,
        memberId,
        playerName(memberId),
        waitingRecord ? `${waitingRecord.gameNumber}` : '',
        formatCSVDate(waitingRecord?.waitingStartedAt),
        formatCSVDate(waitingRecord?.matchStartedAt ?? match.startedAt),
        formatDuration(waitingRecord?.waitingMs),
        waitingRecord ? `${Math.round(waitingRecord.waitingMs / 1000)}` : '',
      ])
    })
  })

  return rows
    .map((row) => row.map(escapeCSVValue).join(','))
    .join('\n')
}

const exportSessionCSV = (
  session: Session,
  memberById: Record<string, Member>,
) => {
  const csv = buildSessionCSV(session, memberById)

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
  })

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url

  link.setAttribute(
    'download',
    csvFileName(session),
  )

  document.body.appendChild(link)

  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const shareSessionCSV = async (
  session: Session,
  memberById: Record<string, Member>,
) => {
  const csv = buildSessionCSV(session, memberById)
  const file = new File([csv], csvFileName(session), {
    type: 'text/csv',
  })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: `${session.name} CSV`,
        text: 'Queue session CSV export',
        files: [file],
      })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      toast.error('Unable to open sharing. Downloading CSV instead.')
    }
  } else {
    toast.info('Sharing is not available here. Downloading CSV instead.')
  }

  exportSessionCSV(session, memberById)
}

/*
  const csv =
    rows
      .map((row) => row.map(escapeCSVValue).join(','))
      .join('\n')

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
  })

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url

  link.setAttribute(
    'download',
    `${session.name}.csv`,
  )

  document.body.appendChild(link)

  link.click()

  document.body.removeChild(link)
}
*/

const endSession = (endedAt = Date.now()) =>
  updateActiveSession((session) => {
    if (session.endedAt) return session
    const hasActiveCourt = session.courts.some(
      (court) => court.teamA.length > 0 || court.teamB.length > 0,
    )

    if (hasActiveCourt || session.rosters.length > 0) {
      toast.error(
        'Failed to End Queue Session, make sure Courts are empty and there is no pending Queue.',
      )
      return session
    }

    const snapshot = buildSessionHistorySnapshot({
      ...session,
      endedAt,
    })

    return {
      ...session,
      endedAt,
      sessionHistory: [
        snapshot,
        ...(session.sessionHistory ?? []),
      ],
    }
  })

const startSession = () =>
  updateActiveSession((session) => {
    if (session.startedAt || session.endedAt) return session

    const startedAt = Date.now()
    const updatedStats = { ...session.stats }

    for (const memberId of session.playingIds) {
      updatedStats[memberId] = {
        ...updatedStats[memberId],
        joinedAtTime: updatedStats[memberId].joinedAtTime ?? startedAt,
        waitingSince: startedAt,
      }
    }

    return {
      ...session,
      startedAt,
      stats: updatedStats,
      winLoseStack:
        session.matchmakingMode === 'win-lose-stack'
          ? (() => {
              const reservedPlayerIds = new Set(
                session.winLoseStack.manualMatches.flatMap((match) => match.playerIds),
              )
              const knownPlayerIds = new Set([
                ...session.winLoseStack.unplayed,
                ...session.winLoseStack.winners,
                ...session.winLoseStack.losers,
                ...(session.winLoseStack.returning ?? []),
                ...reservedPlayerIds,
              ])
              return {
                ...session.winLoseStack,
                initialPlayerIds: [...session.playingIds],
                calibrationComplete: session.playingIds.length === 0,
                unplayed: [
                  ...session.winLoseStack.unplayed,
                  ...session.playingIds.filter((id) => !knownPlayerIds.has(id)),
                ],
              }
            })()
          : session.winLoseStack,
    }
  })

  return {
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
    editActiveSessionDetails,
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
    updateCourtScore,
    updateHistoryMatch,
    endMatch,
    generateRoster,
    forfeitMatch,
    queueManualRoster,
    createStackManualMatch,
    dissolveStackManualMatch,
    assignToCourt,
    assignStackMatchToCourt,
    prioritizeStackMatch,
    skipStackPlayer,
    dissolveRoster,
    replaceRosterPlayer,
    getSessionPlayerStatus,
    skillScore,
    shuffleRoster,
    buildQueueList,
    setStackPlayingNext,
    shuffleStackTeams,
    exportSessionCSV,
    shareSessionCSV,
    startSession,
    endSession,
    toggleManualPick: (memberId: string) =>
      setManualPickIds((prev) =>
        prev.includes(memberId)
          ? prev.filter((id) => id !== memberId)
          : prev.length < 4
            ? [...prev, memberId]
            : prev,
      ),
  }
}
