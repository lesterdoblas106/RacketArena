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
  waitingSince: number
  
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
  endedAt: number
}

export type Session = {
  id: string
  name: string
  createdAt: string
  nonPlayingIds: string[]
  playingIds: string[]
  priorityList: string[]
  playerList: string[]
  rosters: Roster[]
  courts: Court[]
  history: MatchHistory[]
  stats: Record<string, MemberStats>
  arrivalCounter: number
  sessionHistory: SessionHistory[]
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

export type Page = 'landing' | 'club' | 'members' | 'queue' | 'ranking' | 'history'

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
  { id: 'm1', name: 'Lester', skill: 'Low Intermediate' },
  { id: 'm2', name: 'Kim', skill: 'Intermediate' },
  { id: 'm3', name: 'Lloyd', skill: 'Advanced' },
  { id: 'm4', name: 'David', skill: 'Intermediate' },
  { id: 'm5', name: 'Xian', skill: 'Low Intermediate' },
  { id: 'm6', name: 'Lara', skill: 'Beginner' },
  { id: 'm7', name: 'Fluke', skill: 'Intermediate' },
  { id: 'm8', name: 'Marc', skill: 'Advanced' },
  { id: 'm9', name: 'Kevin', skill: 'Intermediate' },
  { id: 'm10', name: 'Ciara', skill: 'Low Intermediate' },
  { id: 'm11', name: 'Moi', skill: 'Beginner' },
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
    }
    return acc
  }, {})

export const createSession = (name: string, members: Member[]): Session => ({
  id: crypto.randomUUID(),
  name,
  nonPlayingIds: [...members.map((m) => m.id)].sort(),
  playingIds: [],
  priorityList: [],
  playerList: [],
  rosters: [],
  createdAt: new Date().toISOString(),
  courts: [
    {
      id: crypto.randomUUID(),
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
})
