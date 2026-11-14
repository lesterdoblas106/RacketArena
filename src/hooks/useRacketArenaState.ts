import { createId } from '../lib/createId'
import { useEffect, useMemo, useState } from 'react'
import { loadState, saveState } from '../lib/storage'
import {
  createSession,
  seedMembers,
  skillOrder,
  type MatchHistory,
  type Member,
  type MemberStats,
  type MatchmakingMode,
  type Session,
  type SessionHistory,
  type Skill,
  type WinLoseStackState,
} from '../types/app'
import { toast } from 'sonner'
import { appendResultToStacks, buildStackRotation, buildUpcomingStackMatches, lockReturningMatches, removePlayersFromStacks, restorePlayersToStacks, skipNextStackPlayer } from '../lib/stacking'

import { findSmartQueuePool } from '../lib/smartQueueCandidates'
import { calculateWaitingScore } from '../lib/smartQueueScoring'

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
          return migrated
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
    setSessions((prev) => [
      { 
        ...createSession(queue.name.trim(), members),
        createdAt: queue.createdAt,
        matchmakingMode: queue.matchmakingMode ?? 'smart-queue',
      },
      ...prev
    ])
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
      prev.map((session) => (session.id === activeSessionId ? updater(session) : session)),
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
  const getTotalGames = (stats: MemberStats) => {
    return stats.gamesPlayed + stats.missedGames
  }
  
  const moveToPlaying = (memberId: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeSessionId) return session
        if (session.playingIds.includes(memberId)) {
          return session
        }

        const memberStats = session.stats[memberId]

        const activeNonPriorityPlayers = session.playingIds.filter(
          (id) => !session.priorityList.includes(id),
        )

        let lowestTotalGames = 0

        if (activeNonPriorityPlayers.length > 0) {
          lowestTotalGames = Math.min(
            ...activeNonPriorityPlayers.map((id) =>
              getTotalGames(session.stats[id]),
            ),
          )
        }

        const playerTotalGames = getTotalGames(memberStats)

        const missedGames = Math.max(
          memberStats.missedGames,
          lowestTotalGames - playerTotalGames,
        )

        const arrivedAt = Date.now()
        const updatedStats = {
          ...memberStats,
          missedGames,
          // Arrival is always recorded. The waiting clock starts at the session
          // start for early arrivals, or at arrival for players joining later.
          waitingSince: session.startedAt ? arrivedAt : memberStats.waitingSince,
          joinedAtTime: memberStats.joinedAtTime ?? arrivedAt,
        }

        const shouldPrioritize = missedGames > 0
        const isReturning = memberStats.gamesPlayed > 0

        return {
          ...session,

          playingIds: [...session.playingIds, memberId],

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
    return skillOrder.indexOf(memberById[memberId].skill) + 1
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
  const getCombinationsOfThree = (
    players: string[],
  ) => {
    const combinations: string[][] = []

    for (let i = 0; i < players.length - 2; i++) {
      for (let j = i + 1; j < players.length - 1; j++ ) {
        for (let k = j + 1; k < players.length; k++) {
          combinations.push([
            players[i],
            players[j],
            players[k],
          ])
        }
      }
    }

    return combinations
  }
  const getTeamArrangements = (
    players: string[],
  ) => {
    const [a, b, c, d] = players

    return [
      {
        teamA: [a, b],
        teamB: [c, d],
      },
      {
        teamA: [a, c],
        teamB: [b, d],
      },
      {
        teamA: [a, d],
        teamB: [b, c],
      },
    ]
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

    const currentWait =
      Math.max(0, (session.endedAt ?? clock) - stats.waitingSince)

    const averageWait =
      stats.averageWaitMs ?? 0

    return (
      currentWait * 0.7 +
      averageWait * 0.3
    )
  }

const buildMatchSet = (
  session: Session,
  queueList: string[],
  preferredBasePlayerId?: string,
) => {
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
  if (waitingPlayers.size === 3) {
    const eligiblePlayers = new Set(waitingPlayers)
    for (const court of activeCourts) {
      for (const id of [...court.teamA, ...court.teamB]) {
        if (!queuedPlayers.has(id)) eligiblePlayers.add(id)
      }
      const candidates = [...new Set([...queueList, ...eligiblePlayers])]
        .filter((id) => eligiblePlayers.has(id))
      const roster = findCompatibleRoster(
        session, candidates, preferredBasePlayerId, queuedPlayers, inGamePlayers, new Set(),
      )
      if (roster.length === 4) return roster
    }
    return []
  }

  const n = session.rosters.length - activeCourts.length + 1
  const eligibleCourtCount = n <= 0 || activeCourts.length === 0
    ? 0
    : Math.min(
        activeCourts.length,
        Math.max(1, Math.round(n / activeCourts.length)),
      )
  const blockedInGamePlayers = new Set(
    activeCourts.slice(eligibleCourtCount).flatMap((court) => [...court.teamA, ...court.teamB]),
  )
  return findCompatibleRoster(
    session, queueList, preferredBasePlayerId, queuedPlayers, inGamePlayers, blockedInGamePlayers,
  )
}

const findCompatibleRoster = (
  session: Session,
  queueList: string[],
  preferredBasePlayerId: string | undefined,
  queuedPlayers: ReadonlySet<string>,
  inGamePlayers: Set<string>,
  blockedInGamePlayers: ReadonlySet<string>,
) => {
  const priority = new Set(session.priorityList)
  const now = Date.now()
  const players = [...new Set(queueList)]
    .filter((id) =>
      session.playingIds.includes(id) && session.stats[id] && memberById[id]
      && !queuedPlayers.has(id) && !blockedInGamePlayers.has(id),
    )
    .map((id) => {
      const stats = session.stats[id]
      const currentWait = session.startedAt && !inGamePlayers.has(id) ? Math.max(0, now - stats.waitingSince) : 0
      return {
        id,
        totalGames: getTotalGames(stats),
        skill: getSkillLevel(id),
        waitingScore: calculateWaitingScore(currentWait, stats.averageWaitMs ?? 0),
        latePriority: priority.has(id),
        arrivalOrder: stats.joinedAtTime ?? stats.joinedAt,
      }
    })
  const pool = findSmartQueuePool(players, preferredBasePlayerId)
  if (!pool) return []

  let bestRoster: string[] = []
  let bestGameGap = Infinity
  let lowestScore = Infinity
  for (const combination of getCombinationsOfThree(pool.candidates.map(({ id }) => id))) {
    for (const { teamA, teamB } of getTeamArrangements([pool.base.id, ...combination])) {
      const roster = [...teamA, ...teamB]
      const gameGap = getRosterGameGap(session, roster)
      const score = getDiversityScore(session, teamA, teamB)
        + getInGamePenalty(roster, inGamePlayers)
        + getSkillOutlierPenalty(roster)
        + getTeamBalancePenalty(teamA, teamB)
        - Math.round(roster.reduce((sum, id) => sum + getFairnessScore(session, id), 0) / 60000)
      if (gameGap < bestGameGap || (gameGap === bestGameGap && score < lowestScore)) {
        bestGameGap = gameGap
        lowestScore = score
        bestRoster = roster
      }
    }
  }
  return bestRoster
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
    updateActiveSession((session) => {
      if (session.endedAt) return session
      const queueList = buildQueueList(session)
      const queuedPlayers = new Set(
        session.rosters.flatMap((roster) => roster.playerIds),
      )
      const selectedBasePlayerId = manualPickIds.find(
        (memberId) =>
          queueList.includes(memberId) &&
          !queuedPlayers.has(memberId),
      )

      const incompleteRosterIndex =
        session.rosters.findIndex(
          (roster) => roster.playerIds.length < 4,
        )

      let selectedPlayers: string[]

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

        selectedPlayers = [
          ...incompleteRoster.playerIds,
          ...availablePlayers.slice(0, missingSlots),
        ]

        selectedPlayers =
          balanceTeams(selectedPlayers)

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
          rosters: [
            ...session.rosters,
            {
              id: createId(),
              playerIds: selectedMatch,
              baseOrder: selectedMatch,
              rotationIndex: 0,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      }
      const waitSetArr = buildMatchSet(
        session,
        queueList,
        selectedBasePlayerId,
      )

      if (waitSetArr.length < 4) {
        toast.warning(
          'Not enough compatible players found.',
        )

        return session
      }

      selectedPlayers =
        balanceTeams(waitSetArr)

      return {
        ...session,
        rosters: [
          ...session.rosters,
          {
            id: createId(),
            playerIds: selectedPlayers,
            baseOrder: selectedPlayers, 
            rotationIndex: 0,
            createdAt: new Date().toISOString(),
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
    updateActiveSession((session) => {
      if (session.endedAt) return session

      return {
        ...session,
        rosters: [
          ...session.rosters,
          {
            id: createId(),
            playerIds: manualPickIds,
            baseOrder: manualPickIds,
            rotationIndex: 0,
            createdAt: new Date().toISOString(),
            
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
      if (!roster) return session
      const court = courtId
        ? session.courts.find((c) => c.id === courtId && c.teamA.length === 0 && c.teamB.length === 0)
        : session.courts.find((c) => c.teamA.length === 0 && c.teamB.length === 0)
      if (!court) return session
        const hasInGamePlayer = roster.playerIds.some(
          (playerId) =>
            session.courts.some(
              (court) =>
                court.teamA.includes(playerId) ||
                court.teamB.includes(playerId),
            ),
        )

        if (hasInGamePlayer) {
          toast.warning(
            'Cannot start queue. One or more players are still in-game.',
          )

          return session
        }

      const [a1, a2, b1, b2] = roster.playerIds
      return {
        ...session,
        rosters: session.rosters.filter((r) => r.id !== rosterId),
        courts: session.courts.map((c) =>
          c.id === court.id
            ? {
                ...c,
                teamA: [a1, a2],
                teamB: [b1, b2],
                scoreA: 0,
                scoreB: 0,
                startedAt: Date.now(),
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
      if (!match || match.playerIds.length !== 4) return session
      const stack = manualMatch
        ? { ...session.winLoseStack, manualMatches: session.winLoseStack.manualMatches.filter((item) => item.id !== manualMatch.id) }
        : { ...removePlayersFromStacks(session.winLoseStack, match.playerIds), playingNext: automatic!.playingNextAfter }
      const dispatchedIndex = manualMatch ? -1 : buildStackRotation(session.winLoseStack)
        .findIndex((item) => item.playerIds[0] === match.playerIds[0])
      const [first, second, third, fourth] = match.playerIds
      const teams = [
        [[first, third], [second, fourth]],
        [[first, second], [third, fourth]],
        [[first, fourth], [second, third]],
      ][session.winLoseStack.teamRotation ?? 0]
      return {
        ...session,
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
          startedAt: Date.now(),
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
      
      const updatedStats = { ...session.stats }
      for (const memberId of [...target.teamA, ...target.teamB]) {
        updatedStats[memberId] = {
          ...updatedStats[memberId],
          waitingSince: updatedStats[memberId].waitingSince ?? Date.now(),
        }
      }
      return {
        ...session,
        stats: updatedStats,
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
      const updatedStats = { ...session.stats }
      const endedAt = Date.now()
      const startedAt = target.startedAt ?? endedAt
      const matchPlayerIds = [...target.teamA, ...target.teamB]
      const waitingRecords = matchPlayerIds.map((memberId) => {
        const waitingStartedAt =
          updatedStats[memberId]?.waitingSince ?? startedAt

        return {
          memberId,
          waitingStartedAt,
          matchStartedAt: startedAt,
          waitingMs: Math.max(0, startedAt - waitingStartedAt),
          gameNumber: (updatedStats[memberId]?.gamesPlayed ?? 0) + 1,
        }
      })
      // for (const memberId of matchPlayerIds) {
      //   updatedStats[memberId] = {
      //     ...updatedStats[memberId],
      //     gamesPlayed: updatedStats[memberId].gamesPlayed + 1,
      //     wins: updatedStats[memberId].wins + (winnerIds.includes(memberId) ? 1 : 0),
      //     waitingSince: endedAt,
      //   }
      // }
      for (const memberId of matchPlayerIds) {
        const waitingRecord =
          waitingRecords.find(
            (record) => record.memberId === memberId,
          )

        const waitingMs =
          waitingRecord?.waitingMs ?? 0

        const totalWaitMs =
          (updatedStats[memberId].totalWaitMs ?? 0) +
          waitingMs

        const waitPeriods =
          (updatedStats[memberId].waitPeriods ?? 0) +
          1

        updatedStats[memberId] = {
          ...updatedStats[memberId],

          gamesPlayed:
            updatedStats[memberId].gamesPlayed + 1,

          wins:
            updatedStats[memberId].wins +
            (winnerIds.includes(memberId) ? 1 : 0),

          waitingSince: endedAt,

          totalWaitMs,
          waitPeriods,

          averageWaitMs:
            totalWaitMs / waitPeriods,
        }
      }

      // Recalculate missedGames and update priorityList after match ends
      const inGamePlayers = new Set(
        session.courts
          .filter((c) => c.id !== courtId)
          .flatMap((court) => [...court.teamA, ...court.teamB]),
      )

      const activeNonPriorityPlayers = session.playingIds.filter(
        (id) =>
          !session.priorityList.includes(id) &&
          !matchPlayerIds.includes(id),
      )

      let lowestTotalGames = 0
      if (activeNonPriorityPlayers.length > 0) {
        lowestTotalGames = Math.min(
          ...activeNonPriorityPlayers.map((id) =>
            getTotalGames(updatedStats[id]) + (inGamePlayers.has(id) ? 1 : 0),
          ),
        )
      }

      // Update priorityList: remove players whose missedGames is now 0
      const updatedPriorityList = session.priorityList.filter((id) => {
        
        if (!matchPlayerIds.includes(id)) {
          return true // Keep non-match players as they are
        }
        const newMissedGames = 
          lowestTotalGames - getTotalGames(updatedStats[id],
        )
        return newMissedGames > 0
      })
      const removedFromPriority =
        session.priorityList.filter(
          (id) => !updatedPriorityList.includes(id),
        ) 

      const updatedPlayerList = [
        ...session.playerList,
        ...removedFromPriority.filter(
          (id) => !session.playerList.includes(id),
        ),
        
        
      ]

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
        priorityList:
          session.matchmakingMode === 'win-lose-stack'
            ? session.priorityList
            : updatedPriorityList,
        playerList:
          session.matchmakingMode === 'win-lose-stack'
            ? session.playerList
            : updatedPlayerList,
        winLoseStack:
          session.matchmakingMode === 'win-lose-stack'
            ? { ...nextWinLoseStack, calibrationComplete }
            : nextWinLoseStack,
        history: [
          {
            id: createId(),
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
          return skillOrder.indexOf(bMember.skill) - skillOrder.indexOf(aMember.skill)
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
