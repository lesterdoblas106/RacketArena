import type { Member, Session, Skill } from '../types/app'

type RankingSort = 'winRate' | 'games' | 'name' | 'skill'

type RankingPageProps = {
  session: Session
  memberById: Record<string, Member>
  sortBy: RankingSort
  onSortBy: (value: RankingSort) => void
  skillFilter: Skill | 'all'
  onSkillFilter: (value: Skill | 'all') => void
}

export function RankingPage({
  session,
  memberById,
  sortBy,
  onSortBy,
  skillFilter,
  onSkillFilter,
}: RankingPageProps) {
  const playingMembers = session.playingIds
    .map((id) => {
      const member = memberById[id]
      const stats = session.stats[id]
      const winRate = stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0
      return { id, member, stats, winRate }
    })
    .filter((entry) => (skillFilter === 'all' ? true : entry.member.skill === skillFilter))
    .sort((a, b) => {
      if (sortBy === 'name') return a.member.name.localeCompare(b.member.name)
      if (sortBy === 'games') return b.stats.gamesPlayed - a.stats.gamesPlayed
      if (sortBy === 'skill') {
        return (
          a.member.skill.localeCompare(b.member.skill) ||
          b.winRate - a.winRate ||
          b.stats.wins - a.stats.wins
        )
      }
      return b.winRate - a.winRate || b.stats.wins - a.stats.wins
    })

  return (
    <section className="card stack ranking-page">
      <div className="section-title">
        <h3>Ranking</h3>
        <div className="actions ranking-actions">
          <label className="filter-label">
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => onSortBy(e.target.value as RankingSort)}>
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
              <option value="Advanced">Advanced</option>
              <option value="Elite">Elite</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rank-table-wrapper">
        <table className="rank-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Skill</th>
              <th>Games</th>
              <th>Winrate</th>
            </tr>
          </thead>

          <tbody>
            {playingMembers.map((entry, index) => (
              <tr key={entry.id} className="rank-table-row">
                <td className="rank-table-cell rank-table-rank">#{index + 1}</td>
                <td className="rank-table-cell">{entry.member.name}</td>
                <td className="rank-table-cell">{entry.member.skill}</td>
                <td className="rank-table-cell rank-table-number">{entry.stats.gamesPlayed}</td>
                <td className="rank-table-cell rank-table-number">
                  {entry.winRate.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
