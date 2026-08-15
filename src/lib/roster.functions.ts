import { supabase } from "@/integrations/supabase/client";

export type RosterName = { id: string; full_name: string };

/**
 * Roster names used only to populate the registration name picker.
 * Served by a database function so it works without an authenticated session.
 */
export async function getPublicRoster(): Promise<RosterName[]> {
  const { data, error } = await supabase.rpc("registration_roster");
  if (error) throw new Error(error.message);
  return (data ?? []) as RosterName[];
}
