import { createServerFn } from "@tanstack/react-start";

/**
 * Public roster names used only to populate the registration name picker.
 * The table itself is no longer readable by unauthenticated clients.
 */
export const getPublicRoster = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("id, full_name")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});
