import type { MatchHistory, Member, Session } from '../types/app'
import { useMemo, useState } from 'react'
import { Trophy, Award, Pencil, Save, Shuffle } from 'lucide-react'

type HistoryPageProps = {
  session: Session
  memberById: Record<string, Member>
  exportSessionCSV: (
    session: Session,
    memberById: Record<string, Member>,
  ) => void
  updateHistoryMatch: (
    matchId: string,
    changes: Pick<MatchHistory, 'teamA' | 'teamB' | 'scoreA' | 'scoreB'>,
  ) => void
}

export function HistoryPage({
  session,
  memberById,
  exportSessionCSV,
  updateHistoryMatch,
}: HistoryPageProps) {
  const [playerFilter, setPlayerFilter] = useState('')
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Pick<MatchHistory, 'teamA' | 'teamB' | 'scoreA' | 'scoreB'> | null>(null)

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

  const getWinnerIndicator = (
    result: 'teamA' | 'teamB' | 'draw',
    team: 'A' | 'B',
  ) => {
    if (result === 'draw') return null

    if (result === `team${team}`) {
      return (
        <Trophy className="history-winner-icon" />
      )
    }

    return null
  }

  const beginEditing = (game: MatchHistory) => {
    setEditingMatchId(game.id)
    setDraft({
      teamA: [...game.teamA],
      teamB: [...game.teamB],
      scoreA: game.scoreA,
      scoreB: game.scoreB,
    })
  }

  const shuffleTeams = () => {
    if (!draft || draft.teamA.length !== 2 || draft.teamB.length !== 2) return
    const [a, b] = draft.teamA
    const [c, d] = draft.teamB
    setDraft({ ...draft, teamA: [a, c], teamB: [b, d] })
  }

  const saveMatch = (matchId: string) => {
    if (!draft) return
    updateHistoryMatch(matchId, draft)
    setEditingMatchId(null)
    setDraft(null)
  }

  return (
    <section className="card stack">
      <div className="section-title">
        <div>
          <h3>History</h3>
          <p>{history.length} completed matches</p>
        </div>

        <div className="history-toolbar">
          <button
            className="primary small"
            onClick={() =>
              exportSessionCSV(session, memberById)
            }
          >
            Export CSV
          </button>

          <input
            type="text"
            placeholder="Filter by player name..."
            value={playerFilter}
            onChange={(event) =>
              setPlayerFilter(event.target.value)
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

        {history.map((game) => {
          const isEditing = editingMatchId === game.id && draft
          const displayGame = isEditing ? { ...game, ...draft } : game

          return (
          <article
            key={game.id}
            className="queue-card history-match-card"
          >
            <div className="section-title">
              <strong>{game.courtLabel}</strong>
              <div className="history-match-meta">
                <span>{new Date(game.endedAt).toLocaleString()}</span>
                {!isEditing && (
                  <button className="secondary small history-edit-btn" onClick={() => beginEditing(game)} aria-label={`Edit ${game.courtLabel}`}>
                    <Pencil size={15} /> Edit
                  </button>
                )}
              </div>
            </div>

            <div className="history-teams">
              <div className="history-team history-team-a">
                <div className="history-team-info">
                  {getWinnerIndicator(displayGame.result, 'A')}

                  <p className="history-team-players">
                    {displayGame.teamA
                      .map(
                        (id) =>
                          memberById[id]?.name ??
                          'Unknown',
                      )
                      .join(', ')}
                  </p>
                </div>

                {isEditing ? (
                  <input className="history-score-input" type="number" min="0" value={draft.scoreA} onChange={(event) => setDraft({ ...draft, scoreA: Number(event.target.value) })} aria-label="Team A score" />
                ) : <span className="history-team-score">{game.scoreA}</span>}
              </div>

              <div className="history-team history-team-b">
                <div className="history-team-info">
                  {getWinnerIndicator(displayGame.result, 'B')}

                  <p className="history-team-players">
                    {displayGame.teamB
                      .map(
                        (id) =>
                          memberById[id]?.name ??
                          'Unknown',
                      )
                      .join(', ')}
                  </p>
                </div>

                {isEditing ? (
                  <input className="history-score-input" type="number" min="0" value={draft.scoreB} onChange={(event) => setDraft({ ...draft, scoreB: Number(event.target.value) })} aria-label="Team B score" />
                ) : <span className="history-team-score">{game.scoreB}</span>}
              </div>

              {displayGame.result === 'draw' && (
                <div className="history-draw">
                  <Award size={16} />
                  <span>Match Draw</span>
                </div>
              )}
            </div>
            {isEditing && (
              <div className="history-edit-actions">
                <button className="secondary small" onClick={shuffleTeams}><Shuffle size={15} /> Shuffle teams</button>
                <button className="primary small" onClick={() => saveMatch(game.id)}><Save size={15} /> Save changes</button>
              </div>
            )}
          </article>
          )
        })}
      </div>
    </section>
  )
}
