export const matchmakingModes = [
  {
    value: 'smart-queue',
    label: 'Smart Queue',
    description: 'Builds balanced matches using skill, games played, and waiting time.',
  },
  {
    value: 'elo-smart-queue',
    label: 'Elo Smart Queue',
    description: 'Uses Smart Queue with ratings starting at 4.0 and fixed win/loss adjustments.',
  },
  {
    value: 'testing-ground',
    label: 'Testing Ground',
    description: 'Do NOT enter, this is for TESTING ONLY. Time moves fast here',
  },
  {
    value: 'win-lose-stack',
    label: 'Win/Lose Stack',
    description: 'Rotates players through Winners and Losers queues based on match results.',
  },
] as const
