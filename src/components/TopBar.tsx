import { InformationCircleIcon } from '@heroicons/react/24/solid'


type TopBarProps = {
  title: string
  onEditClub?: () => void
  pageLabel: string
  sessionName?: string
  showHome: boolean
  onHome: () => void
  onInfo?: () => void
}

export function TopBar({ title, pageLabel, sessionName, showHome, onHome, onInfo, onEditClub }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/logo.png" alt="" className="topbar-logo" />
        <div className="topbar-title-group">
          <div className="topbar-club-name">
            <h2 title={title}>{title}</h2>
            {onEditClub && <button className="topbar-edit-btn" onClick={onEditClub} aria-label="Rename club" title="Rename club">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m16 3 5 5L8 21H3v-5L16 3Z M13 6l5 5" />
              </svg>
            </button>}
          </div>
          {sessionName && <span className="topbar-page" title={sessionName}>{sessionName}</span>}
        </div>
      </div>

      <div className="topbar-actions">
        {onInfo && (
          <button
            className="topbar-info-btn"
            onClick={onInfo}
            aria-label={`How to use ${pageLabel}`}
            title={`How to use ${pageLabel}`}
          >
            <InformationCircleIcon width={16} height={16} />
          </button>
        )}

        {showHome && (
          <button className="topbar-home-btn" 
          onClick={onHome}>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="topbar-home-icon"
            >
              <path d="M3 9.2 10 3l7 6.2v7.3a1.5 1.5 0 0 1-1.5 1.5H12v-5H8v5H4.5A1.5 1.5 0 0 1 3 16.5V9.2Z" />
            </svg>
            Home
          </button>
        )}
      </div>
    </header>
    
  )
}
