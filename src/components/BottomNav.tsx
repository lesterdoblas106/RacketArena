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
    page: 'ranking',
    label: 'Ranking',
    icon: TrophyIcon,
  },
  {
    page: 'history',
    label: 'History',
    icon: DocumentTextIcon,
  },
  {
    page: 'payment',
    label: 'Payment',
    icon: CreditCardIcon,
  },
] as const

export function BottomNav({ page, onSelect }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = page === item.page

        return (
          <button
            key={item.page}
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
              <Icon />
            </span>

            <span className="bottom-nav-label">
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}