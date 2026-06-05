import type { Member, Session } from '../types/app'
import { useMemo, useState } from 'react' 

type HistoryPageProps = {
  session: Session
  memberById: Record<string, Member>
  exportSessionCSV: (history: any, memberById: Record<string, Member>) => void
  endSession: () => void
}

export function HistoryPage({ 
  session, 
  memberById, 
  exportSessionCSV, 
  endSession }: 
  HistoryPageProps) {
  const [playerFilter, setPlayerFilter] = useState('')

  const history = useMemo(() => {
    const sortedHistory = [...session.history].sort(
      (a, b) => b.endedAt - a.endedAt,
    )

    if (!playerFilter.trim()) {
      return sortedHistory
    }

    return sortedHistory.filter((game) => {
      const allPlayers = [
        ...game.teamA,
        ...game.teamB,
      ]

      return allPlayers.some((playerId) =>
        memberById[playerId]?.name
          ?.toLowerCase()
          .includes(playerFilter.toLowerCase()),
      )
    })
  }, [session.history, playerFilter, memberById])

  const resultLabel = (
    result: 'teamA' | 'teamB' | 'draw',
  ) => {
    if (result === 'draw') return 'Match Draw'
    if (result === 'teamA') return 'Team A wins!'
    return 'Team B wins!'
  }

  return (
    <section className="card stack">
      <div className="section-title">
        <div>
          <h3>History</h3>
          <p>{history.length} completed matches</p>
        </div>

        <div className="history-toolbar">
          <button className="danger small" onClick={endSession} > End Session </button>
          <button
            className="primary small"
            onClick={() =>
              exportSessionCSV(history, memberById)
            }
          >
            Export CSV
          </button>
          <input
            type="text"
            placeholder="Filter by player name..."
            value={playerFilter}
            onChange={(e) =>
              setPlayerFilter(e.target.value)
            }
          />
        </div>
      </div>

      <div className="list">
        {history.length === 0 && (
          <p className="available">
            No matching games found.
          </p>
        )}

        {history.map((game) => (
          <article
            key={game.id}
            className="queue-card"
          >
            <div className="section-title">
              <strong>
                {game.courtLabel}
              </strong>

              <span>
                {new Date(
                  game.endedAt,
                ).toLocaleString()}
              </span>
            </div>

            <p>
              Team A:{' '}
              {game.teamA
                .map(
                  (id) =>
                    memberById[id]
                      ?.name ?? 'Unknown',
                )
                .join(', ')}
            </p>

            <p>
              Team B:{' '}
              {game.teamB
                .map(
                  (id) =>
                    memberById[id]
                      ?.name ?? 'Unknown',
                )
                .join(', ')}
            </p>

            <p>
              Score: {game.scoreA} -{' '}
              {game.scoreB}
            </p>

            <p className="winner-line">
              {resultLabel(game.result)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
