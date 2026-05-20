type LandingPageProps = {
  onOpen: () => void
}

export function LandingPage({ onOpen }: LandingPageProps) {
  return (
    <main className="app-shell center landing-shell">
      <section className="card hero-card">
        <div className="hero-logo">
          <img src="/logo.png" alt="Racket Arena logo" />
        </div>
        <p className="eyebrow">Welcome to</p>
        <h1>Racket Arena</h1>
        <p className="tagline">Smart queue. Smooth play. Real impact.</p>
        <ul>
          <li>Track court availability instantly</li>
          <li>Join matches with one tap</li>
          <li>Keep your club moving</li>
        </ul>
        <button className="primary big" onClick={onOpen}>
          Open Racket Arena
        </button>
      </section>
    </main>
  )
}
