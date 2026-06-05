type LandingPageProps = {
  onOpen: () => void
}

// export function LandingPage({ onOpen }: LandingPageProps) {
//   return (
//     <main className="app-shell center landing-shell">
//       <section className="card hero-card">
//         <div className="hero-logo">
//           <img src="/logo.png" alt="Racket Arena logo" />
//         </div>
//         <p className="eyebrow">Welcome to</p>
//         <h1>Racket Arena</h1>
//         <p className="tagline">Smart queue. Smooth play. Real impact.</p>
//         <ul>
//           <li>🏸 Live Court Status</li>
//           <li>👥 Smart Queue System</li>
//           <li>⚡ Faster Match Rotation</li>
//         </ul>
//         <button className="primary big" onClick={onOpen}>
//           Open Racket Arena
//         </button>
//       </section>
//     </main>
//   )
// }
export function LandingPage({ onOpen }: LandingPageProps) {
  return (
    <main className="landing-shell">
      <section className="hero-card">
        <div className="hero-logo">
          <img src="/logo.png" alt="Racket Arena" />
        </div>


        <h1>Racket Arena</h1>
        <span className="badge">
          🏸 Badminton Queue Management
        </span>

        <p className="hero-description">
          Smart queue. Smooth play. Real impact.
        </p>

        <div className="feature-grid">
          <div className="feature-card">
            <strong>🏸 Live Court Status</strong>
          </div>

          <div className="feature-card">
            <strong>👥 Smart Queue System</strong>
          </div>

          <div className="feature-card">
            <strong>⚡ Faster Match Rotation</strong>
          </div>
        </div>

        <div className="hero-actions">
          <button className="primary big" onClick={onOpen}>
            Launch Racket Arena
          </button>
        </div>
      </section>
    </main>
  )
}
