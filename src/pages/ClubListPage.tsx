import { useState } from "react";

type ClubListPageProps = {
  onOpenClub: (clubId: string) => void;
};

export default function ClubListPage({
  onOpenClub,
}: ClubListPageProps) {
  const [search, setSearch] = useState("");

  return (
    <div className="club-list-page">

      <header className="club-list-header">
        <h1>My Clubs</h1>

        <button className="primary">
          + Create Club
        </button>
      </header>

      <section className="club-section">
        <h2>Admin</h2>

        <button
          className="club-item"
          onClick={() => onOpenClub("1")}
        >
          <div>
            <h3>MPACT Sundays</h3>
            <p>1 Upcoming Session</p>
          </div>
        </button>
      </section>

      <section className="club-section">
        <h2>Member</h2>

        <button className="club-item">
          <div>
            <h3>Knight Shuttlers</h3>
            <p>2 Upcoming Sessions</p>
          </div>
        </button>

        <button className="club-item">
          <div>
            <h3>Racquet Riot</h3>
            <p>No Upcoming Sessions</p>
          </div>
        </button>
      </section>

      <section className="club-section">
        <h2>Search Clubs</h2>

        <input
          className="club-search"
          placeholder="Search clubs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

    </div>
  );
}