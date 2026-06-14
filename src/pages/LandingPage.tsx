// type LandingPageProps = {
//   onOpen: () => void
// }

// export function LandingPage({ onOpen }: LandingPageProps) {
//   return (
//     <main className="landing-shell">
//       <section className="hero-card">
//         <div className="hero-logo">
//           <img src="/logo.png" alt="Racket Arena" />
//         </div>


//         <h1>Racket Arena</h1>
//         <span className="badge">
//           🏸 Badminton Queue Management
//         </span>

//         <p className="hero-description">
//           Smart queue. Smooth play. Real impact.
//         </p>

//         <div className="feature-grid">
//           <div className="feature-card">
//             <strong>🏸 Live Court Status</strong>
//           </div>

//           <div className="feature-card">
//             <strong>👥 Smart Queue System</strong>
//           </div>

//           <div className="feature-card">
//             <strong>⚡ Faster Match Rotation</strong>
//           </div>
//         </div>

//         <div className="hero-actions">
//           <button className="primary big" onClick={onOpen}>
//             Launch Racket Arena
//           </button>
//         </div>
//       </section>
//     </main>
//   )
// }
import { useState } from "react";
import { Modal } from "../components/Modal";
import Login from "./Login";
type LandingPageProps = {
onOpen: () => void
}
export function LandingPage({ onOpen }: LandingPageProps) {
const [authOpen, setAuthOpen] = useState(false)
  return ( 
    
  <main className="landing-shell"> 
    <section className="hero-section"> 
    <div className="hero-logo"> 
      <img src="/logo.png" alt="Racket Arena" /> 
      </div>

      <span className="hero-badge">
        🏸 Badminton Session Management
      </span>

      <h1 className="hero-title">
        The smarter way to manage badminton sessions.
      </h1>

      <p className="hero-subtitle">
        From player queues to court rotations, Racket Arena helps clubs,
        organizers, and queue masters run smoother badminton sessions with
        less manual work and a better playing experience.
      </p>

      <div className="hero-actions">
        <button className="primary big" onClick={() => setAuthOpen(true)}>
          Get Started
        </button>
        <Modal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
        >
          <Login />
        </Modal>
      </div>
    </section>

    <section className="problem-section">
      <h2>Why Racket Arena?</h2>

      <p>
        Managing badminton sessions manually often leads to long waiting
        times, uneven matchups, and confusion around court assignments.
      </p>

      <p>
        Racket Arena simplifies the entire process with a centralized system
        designed specifically for badminton communities.
      </p>
    </section>

    <section className="features-section">
      <h2>Everything You Need to Run a Session</h2>

      <div className="feature-grid">
        <div className="feature-card">
          <h3>🏸 Smart Queue Management</h3>
          <p>
            Keep player queues organized and reduce waiting time through
            structured rotations.
          </p>
        </div>

        <div className="feature-card">
          <h3>👥 Club Management</h3>
          <p>
            Create clubs, manage members, and coordinate badminton sessions
            from a single platform.
          </p>
        </div>

        <div className="feature-card">
          <h3>⚡ Court Rotation</h3>
          <p>
            Generate balanced matchups and assign players to courts more
            efficiently.
          </p>
        </div>

        <div className="feature-card">
          <h3>📊 Session Insights</h3>
          <p>
            Track rankings, attendance, match history, and player
            performance.
          </p>
        </div>

        <div className="feature-card">
          <h3>💳 Payment Tracking</h3>
          <p>
            Monitor player contributions and session expenses with ease.
          </p>
        </div>

        <div className="feature-card">
          <h3>📈 Club Growth</h3>
          <p>
            Build a better experience for members through organized and
            transparent session management.
          </p>
        </div>
      </div>
    </section>

    <section className="cta-section">
      <h2>Built for Badminton Communities</h2>

      <p>
        Whether you're managing a small weekend group or a large badminton
        club, Racket Arena helps create a smoother and more enjoyable
        experience for everyone.
      </p>

      <button className="primary big" onClick={onOpen}>
        Launch Racket Arena
      </button>
      
    </section>
    
  </main>

  )
}
