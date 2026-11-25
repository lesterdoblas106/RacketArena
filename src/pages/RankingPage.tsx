import { getSessionSkill, getSessionSkillLabel, skillBorderClass } from '../lib/skillDisplay'
import { TrophyIcon } from '@heroicons/react/24/outline'
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

export function RankingPage({
  session,
  memberById,
  sortBy,
  // onSortBy,
  skillFilter,
  // onSkillFilter,
}: RankingPageProps) {
  const rankedMembers = (session.participantIds ?? session.playingIds)
    .map((id) => {
      const member = memberById[id]
      const stats = session.stats[id]
      const winRate = stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0
      const score = stats.wins*100-(stats.gamesPlayed-stats.wins)
      const points = session.history.reduce((total, match) => {
        if (match.teamA.includes(id)) return total + match.scoreA
        if (match.teamB.includes(id)) return total + match.scoreB
        return total
      }, 0)
      const losses = Math.max(0, stats.gamesPlayed - stats.wins)
      const arrivedAt = stats.joinedAtTime ?? stats.joinedAt ?? Number.MAX_SAFE_INTEGER
      return { id, member, stats, winRate, score, points, losses, arrivedAt }
    })
    .filter((entry) => entry.stats.gamesPlayed > 0) 
    .filter((entry) => (skillFilter === 'all' ? true : getSessionSkill(session, entry.member) === skillFilter))
    .sort((a, b) => {
      if (sortBy === 'name') return a.member.name.localeCompare(b.member.name)
      if (sortBy === 'games') return b.stats.gamesPlayed - a.stats.gamesPlayed
      if (sortBy === 'skill') {
        return (
          getSessionSkill(session, a.member).localeCompare(getSessionSkill(session, b.member)) ||
          b.score - a.score ||
          b.points - a.points ||
          a.arrivedAt - b.arrivedAt ||
          b.winRate - a.winRate ||
          b.stats.wins - a.stats.wins
        )
      }
      if(sortBy === 'winRate') return b.winRate - a.winRate || b.points - a.points
      return b.score - a.score || b.points - a.points || a.arrivedAt - b.arrivedAt || b.winRate - a.winRate || b.stats.wins - a.stats.wins
    })

  return (
    <section className="card stack ranking-page">
      <header className="ranking-header">
        <span className="ranking-header-icon" aria-hidden="true">
          <TrophyIcon width={21} height={21} />
        </span>
        <div className="ranking-header-title">
          <h3>Leaderboard</h3>
        </div>
        <span className="ranking-header-count">
          {rankedMembers.length} {rankedMembers.length === 1 ? 'player' : 'players'}
        </span>
      </header>
        {/* <div className="actions ranking-actions">
          <label className="filter-label">
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => onSortBy(e.target.value as RankingSort)}>
              <option value="score">Ranking</option>
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
        </div> */}

      <div className="rank-table-wrapper">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="rank-col">#</th>
              <th className="player-col">Player</th>
              <th>PNTS</th>
              <th>WR</th>
              <th>StNdng</th>
            </tr>
          </thead>

          <tbody>
            {rankedMembers.map((entry, index) => {
              return (
                <tr
                  key={entry.id}
                  className={`leaderboard-row ${index < 3 ? `leaderboard-podium leaderboard-place-${index + 1}` : ''} ${session.matchmakingMode === 'win-lose-stack' ? '' : skillBorderClass(getSessionSkill(session, entry.member))}`}
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
                    <strong title={getSessionSkillLabel(session, entry.member)}>{entry.member.name}</strong>
                  </td>
                  <td><strong>{entry.points} pts</strong></td>
                  <td>{entry.winRate.toFixed(1)}%</td>
                  <td><strong>{entry.stats.wins}-{entry.losses}</strong></td>


                </tr>
              )
            })}
          </tbody>
</table>
      </div>
    </section>
  )
}
