import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crest } from "@/components/Crest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PasswordInput } from "@/components/PasswordInput";
import { adminResetPassword, adminSetUsername } from "@/lib/admin.functions";
import { validateUsername } from "@/lib/username";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Console | Unboss Studio Schedule" },
      {
        name: "description",
        content:
          "Manage Unboss Studio shooters: roster names, usernames, passwords, roles and activation status.",
      },
      { property: "og:title", content: "Admin Console | Unboss Studio Schedule" },
      {
        property: "og:description",
        content: "Manage roster names, usernames, passwords and roles for the Unboss Studio team.",
      },
    ],
  }),
  component: AdminPage,
});

type Role = "admin" | "shooter";

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const setUsernameFn = useServerFn(adminSetUsername);
  const resetPasswordFn = useServerFn(adminResetPassword);

  const [newName, setNewName] = useState("");
  const [usernameDialog, setUsernameDialog] = useState<{ id: string; current: string } | null>(
    null,
  );
  const [usernameDraft, setUsernameDraft] = useState("");
  const [passwordDialog, setPasswordDialog] = useState<{ id: string; name: string } | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const enabled = Boolean(user);

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, is_active, created_at")
        .order("full_name");
      if (error) throw error;
      return data.filter((p) => p.username !== "admin_unboss");

    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id, user_id, role");
      if (error) throw error;
      return data;
    },
  });

  const { data: roster } = useQuery({
    queryKey: ["roster"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, full_name, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const roleOf = new Map<string, Role>();
  (roles ?? []).forEach((r) => {
    if (r.role === "admin") roleOf.set(r.user_id, "admin");
    else if (!roleOf.has(r.user_id)) roleOf.set(r.user_id, "shooter");
  });

  const adminExists = (roles ?? []).some((r) => r.role === "admin");
  const isAdmin = user ? roleOf.get(user.id) === "admin" : false;
  const registeredNames = new Set((profiles ?? []).map((p) => p.full_name));

  const claimAdmin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_admin");
      if (error) throw error;
      if (!data) throw new Error("An admin already exists. Ask them to grant you access.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast.success("You are now the studio admin");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: active })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Activation updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addRosterName = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Enter a name.");
      const nextOrder = ((roster ?? []).at(-1)?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("team_members").insert({
        full_name: name,
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      toast.success("Name added to the roster");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRosterName = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      toast.success("Name removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeUsername = useMutation({
    mutationFn: async () => {
      if (!usernameDialog) throw new Error("Not ready");
      const check = validateUsername(usernameDraft);
      if (!check.ok) throw new Error(check.error);
      await setUsernameFn({ data: { userId: usernameDialog.id, username: check.username } });
    },
    onSuccess: () => {
      setUsernameDialog(null);
      setUsernameDraft("");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success("Username updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!passwordDialog) throw new Error("Not ready");
      if (passwordDraft.length < 6) throw new Error("Password must be at least 6 characters.");
      await resetPasswordFn({ data: { userId: passwordDialog.id, password: passwordDraft } });
    },
    onSuccess: () => {
      setPasswordDialog(null);
      setPasswordDraft("");
      toast.success("Password reset — share it with the member");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/schedule" className="flex items-center gap-4">
          <Crest className="h-14 w-14" />
          <span>
            <span className="block text-xs uppercase tracking-[0.35em] text-primary/80">
              Unboss Studio
            </span>
            <span className="block font-display text-lg">Admin Console</span>
          </span>
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link to="/schedule">Master calendar</Link>
        </Button>
      </header>

      <div className="rule-gold my-8" />

      {!isAdmin ? (
        <section className="surface-royal rounded-lg p-6 text-center">
          <h1 className="font-display text-lg text-gilded">Admin access required</h1>
          {adminExists ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Only studio admins can manage shooters. Ask an existing admin to grant you the
              admin role.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                No admin has been set up yet. Claim the role to manage the team.
              </p>
              <Button
                className="mt-5"
                onClick={() => claimAdmin.mutate()}
                disabled={claimAdmin.isPending}
              >
                {claimAdmin.isPending ? "Claiming…" : "Claim admin role"}
              </Button>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="surface-royal rounded-lg p-5">
            <h1 className="font-display text-lg text-gilded">Studio roster</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Add a name here, then the person registers with their own username and password.
            </p>
            <div className="rule-gold my-5" />

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1 space-y-2">
                <Label htmlFor="new-name">Full name</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nurul Hamira"
                />
              </div>
              <Button onClick={() => addRosterName.mutate()} disabled={addRosterName.isPending}>
                {addRosterName.isPending ? "Adding…" : "Add name"}
              </Button>
            </div>

            <ul className="mt-5 space-y-2">
              {(roster ?? []).map((m) => {
                const registered = registeredNames.has(m.full_name);
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 bg-secondary/40 px-4 py-3"
                  >
                    <span className="text-sm">{m.full_name}</span>
                    {registered ? (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-primary/80">
                        Registered
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeRosterName.mutate(m.id)}
                        className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="surface-royal mt-6 rounded-lg p-5">
            <h2 className="font-display text-lg text-gilded">Shooters &amp; roles</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Deactivated members stay in the records but are no longer offered as available
              shooters.
            </p>
            <div className="rule-gold my-5" />

            <ul className="space-y-3">
              {(profiles ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">No registered members yet.</li>
              )}
              {(profiles ?? []).map((p) => {
                const role = roleOf.get(p.id) ?? "shooter";
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border/50 bg-secondary/40 p-4"
                  >
                    <div>
                      <p className="font-display text-sm text-primary">
                        {p.full_name || "Team member"}
                        {p.id === user.id ? " (you)" : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">@{p.username}</p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        {p.is_active ? "Active" : "Deactivated"}
                      </p>
                      <div className="mt-2 flex gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setUsernameDialog({ id: p.id, current: p.username });
                            setUsernameDraft(p.username);
                          }}
                          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
                        >
                          Change username
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordDialog({ id: p.id, name: p.full_name || p.username });
                            setPasswordDraft("");
                          }}
                          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
                        >
                          Reset password
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Select
                        value={role}
                        onValueChange={(next) =>
                          setRole.mutate({ userId: p.id, role: next as Role })
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="shooter">Shooter</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Active
                        </span>
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={(active) =>
                            setActive.mutate({ userId: p.id, active })
                          }
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <Dialog
        open={Boolean(usernameDialog)}
        onOpenChange={(open) => !open && setUsernameDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Change username</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="username-draft">New username</Label>
            <Input
              id="username-draft"
              autoCapitalize="none"
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              3–24 characters: letters, numbers, dots, dashes or underscores.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => changeUsername.mutate()} disabled={changeUsername.isPending}>
              {changeUsername.isPending ? "Saving…" : "Save username"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordDialog)}
        onOpenChange={(open) => !open && setPasswordDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              Reset password — {passwordDialog?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="password-draft">New password</Label>
            <PasswordInput
              id="password-draft"
              minLength={6}
              value={passwordDraft}
              onChange={(e) => setPasswordDraft(e.target.value)}
              placeholder="••••••••"
            />
            <p className="text-[11px] text-muted-foreground">
              Share this password with the member so they can sign in and change it later.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => resetPassword.mutate()} disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
