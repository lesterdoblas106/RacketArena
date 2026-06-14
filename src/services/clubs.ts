import { supabase } from "../lib/supabase";

export async function createClub(
  name: string,
  userId: string
) {
  const { data: club, error } = await supabase
    .from("clubs")
    .insert({
      name,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from("club_members")
    .insert({
      club_id: club.id,
      user_id: userId,
      role: "owner",
    });

  return club;
}