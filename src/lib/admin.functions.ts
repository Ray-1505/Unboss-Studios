import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { USERNAME_PATTERN, normalizeUsername, usernameToEmail } from "@/lib/username";

const setUsernameSchema = z.object({
  userId: z.string().uuid(),
  username: z.string().trim().regex(USERNAME_PATTERN, "Invalid username format"),
});

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6).max(72),
});

export const adminSetUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setUsernameSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");

    const username = normalizeUsername(data.username);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .neq("id", data.userId)
      .maybeSingle();
    if (taken) throw new Error("That username is already taken.");

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: usernameToEmail(username),
      email_confirm: true,
      user_metadata: { username },
    });
    if (authError) throw new Error(authError.message);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ username })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { username };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

const deleteUserSchema = z.object({ userId: z.string().uuid() });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { data: isMaster, error: masterError } = await context.supabase.rpc("is_master_admin", {
      _user_id: data.userId,
    });
    if (masterError) throw new Error(masterError.message);
    if (isMaster) throw new Error("The master admin cannot be deleted.");
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("jobs").delete().eq("shooter_id", data.userId);
    await supabaseAdmin.from("jobs").delete().eq("created_by", data.userId);
    await supabaseAdmin.from("availability").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
