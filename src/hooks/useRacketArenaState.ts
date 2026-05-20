import { useEffect, useMemo, useState } from 'react'
import { loadState, saveState } from '../lib/storage'
import {
  createSession,
  seedMembers,
  skillOrder,
  type MatchHistory,
  type Member,
  type MemberStats,
  type Session,
  type Skill,
} from '../types/app'
import { toast } from 'sonner'

export function useRacketArenaState() {
  const initial = useMemo(() => {
    const persisted = loadState()
    if (persisted) {
      return {
        ...persisted,
        sessions: persisted.sessions.map((session) => ({
          ...session,
          history: session.history ?? [],
          courts: session.courts.map((court) => ({
            ...court,
            startedAt: court.startedAt ?? null,
          })),
        })),
      }
    }
    return {
      members: seedMembers,
      sessions: [createSession('Mpact Sundays', seedMembers)],
      activeSessionId: null as string | null,
    }
  }, [])

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
    'queue' | 'totalGames' | 'wins' | 'skill' | 'name'
  >('queue')
  const [manualPickIds, setManualPickIds] = useState<string[]>([])

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

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === resolvedActiveSessionId) ?? null,
    [sessions, resolvedActiveSessionId],
  )

  const memberById = useMemo(
    () => members.reduce<Record<string, Member>>((acc, m) => ((acc[m.id] = m), acc), {}),
    [members],
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
          },
        },
      })),
    )
  }

  const createQueue = (queue: { name: string, createdAt: string }) => {
    if (!queue.name.trim()) return
    setSessions((prev) => [
      { 
        ...createSession(queue.name.trim(), members), 
        createdAt: queue.createdAt 
      },
      ...prev
    ])
  }

  const editQueue = (queueId: string, name: string) => {
    const target = sessions.find((s) => s.id === queueId)
    if (!target) return
    if (!name.trim()) return
    setSessions((prev) =>
      prev.map((session) =>
        session.id === queueId ? { ...session, name: name.trim() } : session,
      ),
    )
  }

  const deleteQueue = (queueId: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== queueId))
    if (activeSessionId === queueId) {
      setActiveSessionId(null)
    }
  }

  const addMember = (name: string, skill: Skill) => {
    if (!name.trim() || !skillOrder.includes(skill)) return
    const newMember = { id: crypto.randomUUID(), name: name.trim(), skill }
    setMembers((prev) => [...prev, newMember])
    upsertStatsForNewMember(newMember.id)
  }

  const addMembersBulk = (names: string[], defaultSkill: Skill = 'Low Intermediate') => {
    const existingNameSet = new Set(members.map((member) => member.name.toLowerCase()))
    const cleanedNames = names
      .map((name) => name.trim())
      .filter(Boolean)
      .filter((name) => !existingNameSet.has(name.toLowerCase()))
      .filter((name, index, array) => array.indexOf(name) === index)
    if (!cleanedNames.length || !skillOrder.includes(defaultSkill)) return

    const newMembers = cleanedNames.map((name) => ({
      id: crypto.randomUUID(),
      name,
      skill: defaultSkill,
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
        playingIds: session.playingIds.filter((id) => id !== memberId),
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
  const getTotalGames = (stats: MemberStats) => {
    return stats.gamesPlayed + stats.missedGames
  }
  
  const moveToPlaying = (memberId: string) => {
    setSessions((prev) =>
      prev.map((session) => {
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
          0,
          lowestTotalGames - playerTotalGames,
        )

        const updatedStats = {
          ...memberStats,
          missedGames,
          waitingSince: Date.now(),
        }

        const shouldPrioritize = missedGames > 0

        return {
          ...session,

          playingIds: [...session.playingIds, memberId],

          nonPlayingIds: session.nonPlayingIds.filter(
            (id) => id !== memberId,
          ),

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
        }
      }),
    )
  }

  const resignFromPlaying = (memberId: string) => {
    setSessions((prev) =>
      prev.map((session) => {
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

          nonPlayingIds: [
            ...session.nonPlayingIds,
            memberId,
          ].sort(),

          rosters: updatedRosters,
          
          stats: {
            ...session.stats,
            [memberId]: {
              ...session.stats[memberId],
              waitingSince: Date.now(),
            },
          },
        }
      }),
    )
  }

  const getSkillLevel = (memberId: string) => {
    return skillOrder.indexOf(memberById[memberId].skill) + 1
  }
      
const isCompatiblePlayer = (
  session: Session,
  basePlayerId: string,
  comparedPlayerId: string,
  widenLevel: number,
) => {
  const baseStats =
    session.stats[basePlayerId]

  const comparedStats =
    session.stats[comparedPlayerId]

  const baseTotalGames =
    getTotalGames(baseStats)

  const comparedTotalGames =
    getTotalGames(comparedStats)

  const totalGamesDiff = Math.abs(
    baseTotalGames -
      comparedTotalGames,
  )

  const maxGamesDiff =
    widenLevel >= 2 ? 2 : 1

  if (totalGamesDiff > maxGamesDiff) {
    return false
  }

  const baseSkill =
    getSkillLevel(basePlayerId)

  const comparedSkill =
    getSkillLevel(comparedPlayerId)

  let minSkill = baseSkill
  let maxSkill = baseSkill

  switch (baseSkill) {
    case 1:
      maxSkill = 3
      break

    case 6:
      minSkill = 4
      break

    default:
      minSkill = baseSkill - 1
      maxSkill = baseSkill + 1
  }

  if (widenLevel >= 1) {
    minSkill -= 1
    maxSkill += 1
  }

  minSkill = Math.max(1, minSkill)
  maxSkill = Math.min(6, maxSkill)

  const withinSkillRange =
    comparedSkill >= minSkill &&
    comparedSkill <= maxSkill

  if (!withinSkillRange) {
    return false
  }

  const isEven =
    baseTotalGames % 2 === 0

  if (widenLevel < 3) {
    if (isEven && comparedSkill < baseSkill) {
      return false
    }

    if (!isEven && comparedSkill > baseSkill) {
      return false
    }
  }

  return true
}

const buildMatchSet = (
  session: Session,
  queueList: string[],
) => {
  if (queueList.length < 4) {
    return []
  }

  const queuedPlayers = new Set(
    session.rosters.flatMap(
      (roster) => roster.playerIds,
    ),
  )

  for (
    let baseIndex = 0;
    baseIndex < queueList.length;
    baseIndex++
  ) {
    const basePlayer =
      queueList[baseIndex]

    if (
      queuedPlayers.has(basePlayer)
    ) {
      continue
    }

    const baseTotalGames =
      getTotalGames(
        session.stats[basePlayer],
      )

    const startIndex =
      baseTotalGames % 2 === 0
        ? baseIndex + 1
        : baseIndex + 2

    for (
      let widenLevel = 0;
      widenLevel <= 4;
      widenLevel++
    ) {
      const waitSetArr = [basePlayer]

      for (
        let i = startIndex;
        i < queueList.length;
        i++
      ) {
        const comparedPlayer =
          queueList[i]

        if (
          comparedPlayer ===
            basePlayer ||
          waitSetArr.includes(
            comparedPlayer,
          ) ||
          queuedPlayers.has(
            comparedPlayer,
          )
        ) {
          continue
        }

        const compatible =
          waitSetArr.every(
            (existingPlayer) =>
              isCompatiblePlayer(
                session,
                existingPlayer,
                comparedPlayer,
                widenLevel
              )
          )

        if (compatible) {
          waitSetArr.push(
            comparedPlayer,
          )
        }

        if (
          waitSetArr.length === 4
        ) {
          return waitSetArr
        }
      }
    }
  }

  return []
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
      [a, b, d, c],
      [a, c, d, b],
      [a, d, c, b],
  ] 
    return rotations
  }

  const generateRoster = () =>
    updateActiveSession((session) => {
      const queueList = buildQueueList(session)

      const incompleteRosterIndex =
        session.rosters.findIndex(
          (roster) => roster.playerIds.length < 4,
        )

      let selectedPlayers: string[] = []

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
        }

        return {
          ...session,
          rosters: updatedRosters,
        }
      }

      const waitSetArr = buildMatchSet(
        session,
        queueList,
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
            id: crypto.randomUUID(),
            playerIds: selectedPlayers,
            previousOrder: [],
            createdAt: new Date().toISOString(),
          },
        ],
      }
    })

  const shuffleRoster = (
    rosterId: string,
  ) =>
    updateActiveSession((session) => {
      const updatedRosters =
        session.rosters.map((roster) => {
          if (roster.id !== rosterId) {
            return roster
          }

          const rotations =
            rotateRosterOrder(
              roster.playerIds,
            )

          const currentIndex =
            rotations.findIndex(
              (rotation) =>
                JSON.stringify(rotation) ===
                JSON.stringify(
                  roster.playerIds,
                ),
            )

          const nextIndex =
            (currentIndex + 1) %
            rotations.length

          return {
            ...roster,
            previousOrder:
              roster.playerIds,
            playerIds:
              rotations[nextIndex],
          }
        })

      return {
        ...session,
        rosters: updatedRosters,
      }
    })

  const queueManualRoster = () => {
    if (manualPickIds.length !== 4) return
    updateActiveSession((session) => ({
      ...session,
      rosters: [
        ...session.rosters,
        {
          id: crypto.randomUUID(),
          playerIds: manualPickIds,
          previousOrder: [...session.playingIds],
          createdAt: new Date().toISOString(),
        },
      ],
    }))
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

      const onCourtSet = new Set(
        session.courts.flatMap((court) => [...court.teamA, ...court.teamB]),
      )
      if (onCourtSet.has(memberId)) return session

      const alreadyUsedInQueue = session.rosters.some(
        (item) => item.id !== rosterId && item.playerIds.includes(memberId),
      )
      if (alreadyUsedInQueue) return session

      const updatedPlayerIds = [...roster.playerIds]
      updatedPlayerIds[slotIndex] = memberId
      if (new Set(updatedPlayerIds).size !== 4) return session

      return {
        ...session,
        rosters: session.rosters.map((item) =>
          item.id === rosterId ? { ...item, playerIds: updatedPlayerIds } : item,
        ),
      }
    })

  const addCourt = () =>
    updateActiveSession((session) => ({
      ...session,
      courts: [
        ...session.courts,
        {
          id: crypto.randomUUID(),
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

  const assignToCourt = (rosterId: string) =>
    updateActiveSession((session) => {
      const roster = session.rosters.find((r) => r.id === rosterId)
      if (!roster) return session
      const court = session.courts.find((c) => c.teamA.length === 0 && c.teamB.length === 0)
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
      for (const memberId of [...target.teamA, ...target.teamB]) {
        updatedStats[memberId] = {
          ...updatedStats[memberId],
          gamesPlayed: updatedStats[memberId].gamesPlayed + 1,
          wins: updatedStats[memberId].wins + (winnerIds.includes(memberId) ? 1 : 0),
          waitingSince: Date.now(),
        }
      }
      return {
        ...session,
        stats: updatedStats,
        history: [
          {
            id: crypto.randomUUID(),
            courtLabel: `Court ${session.courts.findIndex((c) => c.id === courtId) + 1}`,
            teamA: [...target.teamA],
            teamB: [...target.teamB],
            scoreA: safeScoreA,
            scoreB: safeScoreB,
            result: matchResult,
            endedAt: Date.now(),
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
  const queuedPlayers = new Set(
    session.rosters.flatMap(
      (roster) => roster.playerIds,
    ),
  )

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
      session.stats[a].waitingSince -
      session.stats[b].waitingSince
    )
  }

  const priorityPlayers =
    session.priorityList
      .filter(
        (id) =>
          !queuedPlayers.has(id),
      )
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
          session.stats[a]
            .waitingSince -
          session.stats[b]
            .waitingSince
        )
      })

  return [
    ...priorityPlayers,
    ...regularPlayers,
  ]
}

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
    deleteQueue,
    addMember,
    addMembersBulk,
    editMember,
    deleteMember,
    moveToPlaying,
    resignFromPlaying,
    addCourt,
    removeCourt,
    updateCourtScore,
    endMatch,
    generateRoster,
    queueManualRoster,
    assignToCourt,
    dissolveRoster,
    replaceRosterPlayer,
    getSessionPlayerStatus,
    skillScore,
    shuffleRoster,
    buildQueueList,
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
