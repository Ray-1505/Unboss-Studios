import { useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crest } from "@/components/Crest";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
          "Manage Unboss Studio shooters: assign admin or shooter roles and activate or deactivate team members.",
      },
      { property: "og:title", content: "Admin Console | Unboss Studio Schedule" },
      {
        property: "og:description",
        content: "Assign roles and activation status for the Unboss Studio team.",
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
        .select("id, full_name, is_active, created_at")
        .order("full_name");
      if (error) throw error;
      return data;
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

  const roleOf = new Map<string, Role>();
  (roles ?? []).forEach((r) => {
    if (r.role === "admin") roleOf.set(r.user_id, "admin");
    else if (!roleOf.has(r.user_id)) roleOf.set(r.user_id, "shooter");
  });

  const adminExists = (roles ?? []).some((r) => r.role === "admin");
  const isAdmin = user ? roleOf.get(user.id) === "admin" : false;

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
        <section className="surface-royal rounded-lg p-5">
          <h1 className="font-display text-lg text-gilded">Shooters &amp; roles</h1>
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
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      {p.is_active ? "Active" : "Deactivated"}
                    </p>
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
      )}
    </main>
  );
}
