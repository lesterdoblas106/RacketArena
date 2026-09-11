
"use client"

import styles from "./LandingPage.module.css"

type LandingPageProps = {
  onOpen?: () => void
}

const features = [
  {
    title: "Smart Queue Management",
    description:
      "Keep player queues organized and slash waiting time with structured, automated rotations.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    title: "Club Management",
    description:
      "Create clubs, manage members, and coordinate every badminton session from one platform.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Court Rotation",
    description:
      "Generate balanced matchups and assign players to courts faster and more efficiently.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
  },
  {
    title: "Session Insights",
    description:
      "Track rankings, attendance, match history, and player performance over time.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: "Payment Tracking",
    description:
      "Monitor player contributions and session expenses with effortless clarity.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    title: "Club Growth",
    description:
      "Build a better member experience through organized, transparent session management.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
]

export function LandingPage({ onOpen }: LandingPageProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.headerInner}>
            <div className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true">
               <img src="/logo.png" alt="Racket Arena" className={styles.brandLogo}/> 
              </span>
              Racket Arena
            </div>
            <nav className={styles.nav} aria-label="Primary">
              <a className={styles.navLink} href="#features">
                Features
              </a>
              <a className={styles.navLink} href="#why">
                Why Us
              </a>
              <a className={styles.navLink} href="#get-started">
                Get Started
              </a>
            </nav>
            <button className={styles.primary} onClick={onOpen}>
              Launch App
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.container} aria-labelledby="hero-title">
          <div className={styles.hero}>
            <div>
              <span className={styles.heroBadge}>Badminton Session Management</span>
              <h1 id="hero-title" className={styles.heroTitle}>
                The smarter way to run{" "}
                <span className={styles.highlight}>badminton sessions.</span>
              </h1>
              <p className={styles.heroSubtitle}>
                From player queues to court rotations, Racket Arena helps clubs,
                organizers, and queue masters run smoother sessions with less
                manual work and a better playing experience.
              </p>
              <div className={styles.heroActions}>
                <button className={`${styles.primary} ${styles.big}`} onClick={onOpen}>
                  Launch Racket Arena
                </button>
                <a className={styles.ghost} href="#features">
                  Explore Features
                </a>
              </div>
              <div className={styles.heroStats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>0 min</span>
                  <span className={styles.statLabel}>Manual queueing</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>Live</span>
                  <span className={styles.statLabel}>Court rotation</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>All-in-one</span>
                  <span className={styles.statLabel}>Club platform</span>
                </div>
              </div>
            </div>

            <div className={styles.heroMedia}>
              <img
                className={styles.heroImage}
                  src="/logo.png"
                  alt="Racket Arena"
              />
              <div className={styles.heroFloat}>
                <span className={styles.heroFloatDot} aria-hidden="true" />
                <span className={styles.heroFloatText}>
                  Court 1 · In play
                  <span>Next up in queue: 3 players</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="why" className={styles.container} aria-labelledby="why-title">
          <div className={styles.problem}>
            <div className={styles.problemCard}>
              <div>
                <h2 id="why-title">Why Racket Arena?</h2>
              </div>
              <div>
                <p>
                  Managing badminton sessions manually often leads to long
                  waiting times, uneven matchups, and confusion around court
                  assignments.
                </p>
                <p>
                  Racket Arena simplifies the entire process with a centralized
                  system designed specifically for badminton communities.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className={styles.section}>
          <div className={styles.container}>
            <p className={styles.sectionEyebrow}>Everything you need</p>
            <h2 className={styles.sectionTitle}>Run a Session, Start to Finish</h2>
            <p className={styles.sectionLead}>
              A complete toolkit built for the rhythm of a badminton court —
              queue, rotate, track, and grow.
            </p>
            <div className={styles.featureGrid}>
              {features.map((feature) => (
                <div key={feature.title} className={styles.featureCard}>
                  <span className={styles.featureIcon}>{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="get-started" className={styles.cta}>
          <div className={styles.container}>
            <div className={styles.ctaCard}>
              <h2>Built for Badminton Communities</h2>
              <p>
                Whether you&apos;re managing a small weekend group or a large
                badminton club, Racket Arena creates a smoother, more enjoyable
                experience for everyone on court.
              </p>
              <div className={styles.ctaActions}>
                <button className={`${styles.primary} ${styles.big}`} onClick={onOpen}>
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerInner}>
            <div className={styles.brand}><img
              src="/logo.png"
              alt="Racket Arena"
              className={styles.brandLogo}
            />
              Racket Arena
            </div>
            <p className={styles.footerText}>
              Racket sports queueing, made effortless.
            </p>
            <p className={styles.footerText}>
                © 2026 Racket Arena · Developed by Lester John Doblas
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
