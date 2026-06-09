type TopBarProps = {
  title: string
  pageLabel: string
  showHome: boolean
  onHome: () => void
  onInfo: () => void
}

export function TopBar({ title, pageLabel, showHome, onHome, onInfo }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/logo.png" alt="" className="topbar-logo" />
        <div className="topbar-title-group">
          <span className="topbar-page">{pageLabel}</span>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className="ghost topbar-info-btn"
          onClick={onInfo}
          aria-label={`How to use ${pageLabel}`}
          title={`How to use ${pageLabel}`}
        >
          i
        </button>

        {showHome && (
          <button className="ghost topbar-home-btn" onClick={onHome}>
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
