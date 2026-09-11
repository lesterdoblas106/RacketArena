import type { Member, Session, Skill } from '../types/app'

type RankingSort = 'score'|'winRate' | 'games' | 'name' | 'skill'

type RankingPageProps = {
  session: Session
  memberById: Record<string, Member>
  sortBy: RankingSort
  onSortBy: (value: RankingSort) => void
  skillFilter: Skill | 'all'
  onSkillFilter: (value: Skill | 'all') => void
}
const skillBorderClass = (skill: Member['skill']) =>
  ({
    Newbie: 'skill-newbie',
    Beginner: 'skill-beginner',
    'Low Intermediate': 'skill-low-intermediate',
    Intermediate: 'skill-intermediate',
    'High Intermediate': 'skill-high-intermediate',
    Advanced: 'skill-advanced',
    Elite: 'skill-elite',
  })[skill]

export function RankingPage({
  session,
  memberById,
  sortBy,
  onSortBy,
  skillFilter,
  onSkillFilter,
}: RankingPageProps) {
  const rankedMembers = (session.participantIds ?? session.playingIds)
    .map((id) => {
      const member = memberById[id]
      const stats = session.stats[id]
      const winRate = stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0
      const score = stats.wins*100-(stats.gamesPlayed-stats.wins)
      return { id, member, stats, winRate, score }
    })
    .filter((entry) => entry.stats.gamesPlayed > 0) 
    .filter((entry) => (skillFilter === 'all' ? true : entry.member.skill === skillFilter))
    .sort((a, b) => {
      if (sortBy === 'name') return a.member.name.localeCompare(b.member.name)
      if (sortBy === 'games') return b.stats.gamesPlayed - a.stats.gamesPlayed
      if (sortBy === 'skill') {
        return (
          a.member.skill.localeCompare(b.member.skill) ||
          b.score - a.score ||
          b.winRate - a.winRate ||
          b.stats.wins - a.stats.wins
        )
      }
      if(sortBy === 'winRate')return b.stats.wins - a.stats.wins
      return b.score-a.score || b.winRate - a.winRate || b.stats.wins - a.stats.wins
    })

  return (
    <section className="card stack ranking-page">
      <div className="section-title">
        <h3>Ranking</h3>
        <div className="actions ranking-actions">
          <label className="filter-label">
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => onSortBy(e.target.value as RankingSort)}>
              <option value="score">Stat Score</option>
              <option value="winRate">Win Rate</option>
              <option value="games">No. of Games</option>
              <option value="name">Name</option>
              <option value="skill">Skills</option>
            </select>
          </label>
          <label className="filter-label">
            <span>Skill</span>
            <select
              value={skillFilter}
              onChange={(e) => onSkillFilter(e.target.value as Skill | 'all')}
            >
              <option value="all">All</option>
              <option value="Newbie">Newbie</option>
              <option value="Beginner">Beginner</option>
              <option value="Low Intermediate">Low Intermediate</option>
              <option value="Intermediate">Intermediate</option>
              <option value="High Intermediate">High Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Elite">Elite</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rank-table-wrapper">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="rank-col">#</th>
              <th className="player-col">Player</th>
              <th>G</th>
              <th>W</th>
              <th>WR</th>
              <th>Score</th>
            </tr>
          </thead>

          <tbody>
            {rankedMembers.map((entry, index) => {
              return (
                <tr
                  key={entry.id}
                  className={`leaderboard-row ${skillBorderClass(entry.member.skill)}`}
                >
                  <td className="leaderboard-rank">
                    {index === 0
                      ? '🥇'
                      : index === 1
                        ? '🥈'
                        : index === 2
                          ? '🥉'
                          : `#${index + 1}`}
                  </td>

                  <td className="leaderboard-player">
                    <strong>{entry.member.name}</strong>
                  </td>
                  <td>{entry.stats.gamesPlayed}</td>
                  <td>{entry.stats.wins}</td>
                  <td>{entry.winRate.toFixed(1)}%</td>
                  <td><strong>{entry.score}</strong></td>


                </tr>
              )
            })}
          </tbody>
</table>
      </div>
    </section>
  )
}
