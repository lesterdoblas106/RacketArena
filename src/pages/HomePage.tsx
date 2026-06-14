
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type HomePageProps = {
  onOpenClubs: () => void
};

export default function HomePage({
  onOpenClubs,
}: HomePageProps) {
  return (
    <div className="home-page">

      <header className="home-header">
        <div>
          <h1>Welcome Back 👋</h1>
          <p>Ready for your next badminton session?</p>
        </div>

        <button className="settings-btn">
          ⚙️
        </button>
      </header>

      <div className="dashboard-grid">

        <button
          className="dashboard-card"
          onClick={onOpenClubs}
        >
          <h2>🏸</h2>
          <span>Clubs</span>
        </button>

        <button className="dashboard-card">
          <h2>📅</h2>
          <span>Sessions</span>
        </button>

        <button className="dashboard-card">
          <h2>📈</h2>
          <span>History</span>
        </button>

      </div>

      <section className="upcoming-section">
        <h3>Upcoming Sessions</h3>

        <div className="empty-state">
          No upcoming sessions yet.
        </div>
      </section>

    </div>
  )
}