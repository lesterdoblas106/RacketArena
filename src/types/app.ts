export type Skill =
  | 'Newbie'
  | 'Beginner'
  | 'Low Intermediate'
  | 'Intermediate'
  | 'High Intermediate'
  | 'Advanced'
  | 'Elite'

export type Member = {
  id: string
  name: string
  skill: Skill
}

export type MemberStats = {
  gamesPlayed: number
  wins: number
  missedGames: number
  joinedAt: number  
  joinedAtTime?: number
  waitingSince: number
  
  totalWaitMs: number
  waitPeriods: number
  averageWaitMs: number
}

export type Roster = {
  id: string
  playerIds: string[]
  baseOrder: string[], 
  rotationIndex: number,
  createdAt: string
}

export type Court = {
  id: string
  name: string
  teamA: string[]
  teamB: string[]
  scoreA: number
  scoreB: number
  startedAt: number | null
}

export type MatchHistory = {
  id: string
  courtLabel: string
  teamA: string[]
  teamB: string[]
  scoreA: number
  scoreB: number
  result: 'teamA' | 'teamB' | 'draw'
  startedAt?: number | null
  endedAt: number
  durationMs?: number
  waitingRecords?: {
    memberId: string
    waitingStartedAt: number
    matchStartedAt: number
    waitingMs: number
    gameNumber: number
  }[]
}

export type Session = {
  id: string
  name: string
  createdAt: string
  startedAt?: number | null
  endedAt?: number | null
  nonPlayingIds: string[]
  participantIds: string[]
  playingIds: string[]
  priorityList: string[]
  playerList: string[]
  rosters: Roster[]
  courts: Court[]
  history: MatchHistory[]
  stats: Record<string, MemberStats>
  arrivalCounter: number
  sessionHistory: SessionHistory[]
  visitors: Member[]
}

export type SessionHistory = {
  id: string

  title: string

  createdAt: string
  endedAt: string

  totalMatches: number
  totalPlayers: number

  rankings: {
    memberId: string
    skillLevel: Member['skill'] 
    totalGames: number
    wins: number
    losses: number
    missedGames: number
    gamesPlayed: number
    winRate: number
  }[]

  matches: MatchHistory[]
}

export type Page =
  | 'landing'
  | 'club'
  | 'members'
  | 'queue'
  | 'ranking'
  | 'history'
  | 'payment'

export const skillOrder: Skill[] = [
  'Newbie',
  'Beginner',
  'Low Intermediate',
  'Intermediate',
  'High Intermediate',
  'Advanced',
  'Elite',
]

export const seedMembers: Member[] = [
  { id: 'm1', name: 'Lester', skill: 'Intermediate' },
]

export const buildDefaultStats = (
  members: Member[],
): Record<string, MemberStats> =>
  members.reduce<Record<string, MemberStats>>((acc, member, index) => {
    acc[member.id] = {
      gamesPlayed: 0,
      wins: 0,
      missedGames: 0,
      joinedAt: index + 1,
      waitingSince: Date.now(),

  totalWaitMs: 0,
  waitPeriods: 0,
  averageWaitMs: 0,
    }
    return acc
  }, {})

export const createSession = (name: string, members: Member[]): Session => ({
  id: crypto.randomUUID(),
  name,
  startedAt: null,
  endedAt: null,
  nonPlayingIds: [...members.map((m) => m.id)].sort(),
  participantIds: [],
  playingIds: [],
  priorityList: [],
  playerList: [],
  rosters: [],
  createdAt: new Date().toISOString(),
  courts: [
    {
      id: crypto.randomUUID(),
      name: 'Court 1',
      teamA: [],
      teamB: [],
      scoreA: 0,
      scoreB: 0,
      startedAt: null,
    },
  ],
  history: [],
  stats: buildDefaultStats(members),
  arrivalCounter: 0,
  sessionHistory: [],
  visitors: [],
})
