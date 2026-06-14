import { useState } from "react";
import { createClub } from "../services/clubs";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

export default function CreateClub() {
  const user = useAuth();
  const [name, setName] = useState("");

  const handleCreate = async () => {
    if (!user) return;

    try {
      const club = await createClub(
        name,
        user.id
      );

      alert(`Created ${club.name}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create club");
    }
  };

  return (
    <div>
        <h1>Create Club</h1>

        <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Club name"
        />

        <button onClick={handleCreate}>
        Create
        </button>

        <button
        onClick={() => supabase.auth.signOut()}
        >
        Logout
        </button>
    </div>
  );
}