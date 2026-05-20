import type { Page } from '../types/app'

type BottomNavProps = {
  page: Page
  onSelect: (page: 'members' | 'queue' | 'ranking' | 'history') => void
}

export function BottomNav({ page, onSelect }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      <button
        className={page === 'members' ? 'active' : ''}
        onClick={() => onSelect('members')}
      >
        Members
      </button>
      <button
        className={page === 'queue' ? 'active' : ''}
        onClick={() => onSelect('queue')}
      >
        Queue
      </button>
      <button
        className={page === 'ranking' ? 'active' : ''}
        onClick={() => onSelect('ranking')}
      >
        Ranking
      </button>
      <button
        className={page === 'history' ? 'active' : ''}
        onClick={() => onSelect('history')}
      >
        History
      </button>
    </nav>
  )
}
