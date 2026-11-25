import type { Page } from '../types/app'
import {
  UserGroupIcon,
  QueueListIcon,
  TrophyIcon,
  DocumentTextIcon,
  CreditCardIcon,
} from '@heroicons/react/24/solid'

type BottomNavProps = {
  page: Page
  onSelect: (page: 'members' | 'queue' | 'ranking' | 'history' | 'payment') => void
}

const NAV_ITEMS = [
  {
    page: 'members',
    label: 'Attendance',
    icon: UserGroupIcon,
  },
  {
    page: 'queue',
    label: 'Queue',
    icon: QueueListIcon,
  },
  {
    page: 'history',
    label: 'History',
    icon: DocumentTextIcon,
  },
  {
    page: 'ranking',
    label: 'Ranking',
    icon: TrophyIcon,
  },
  {
    page: 'payment',
    label: 'Payment',
    icon: CreditCardIcon,
  },
] as const

export function BottomNav({ page, onSelect }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Game session">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = page === item.page

        return (
          <button
            key={item.page}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={`bottom-nav-item ${
              active ? 'bottom-nav-item-active' : ''
            }`}
            onClick={() => onSelect(item.page)}
          >
            <span
              className={`bottom-nav-icon ${
                active ? 'bottom-nav-icon-active' : ''
              }`}
            >
              <Icon aria-hidden="true" />
            </span>

            <span className="bottom-nav-label" aria-hidden="true">
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
