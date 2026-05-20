type TopBarProps = {
  title: string
  showHome: boolean
  onHome: () => void
}

export function TopBar({ title, showHome, onHome }: TopBarProps) {
  return (
    <header className="topbar">
      <h2>{title}</h2>
      <div className="actions">
        {showHome && (
          <button className="ghost" onClick={onHome}>
            Home
          </button>
        )}
      </div>
    </header>
  )
}
