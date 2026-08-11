import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crest } from "@/components/Crest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WEST_MALAYSIA_STATES,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "@/lib/west-malaysia-map";

export const Route = createFileRoute("/state-team")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "State Team | Unboss Studio" },
      {
        name: "description",
        content:
          "Interactive gold map of West Malaysia showing the Unboss Studio state leader and contact number for every state.",
      },
      { property: "og:title", content: "State Team | Unboss Studio" },
      {
        property: "og:description",
        content: "Tap a state on the map to see its Unboss Studio leader and phone number.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StateTeamPage,
});

function StateTeamPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeCode, setActiveCode] = useState<string>("SGR");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({ leader: "", phone: "" });

  const { data: leaders } = useQuery({
    queryKey: ["state-leaders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("state_leaders")
        .select("id, state_code, state_name, leader_name, phone");
      if (error) throw error;
      return data;
    },
  });

  const { data: myRoles } = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const isAdmin = (myRoles ?? []).some((r) => r.role === "admin");

  const byCode = useMemo(() => {
    const map = new Map<string, NonNullable<typeof leaders>[number]>();
    (leaders ?? []).forEach((l) => map.set(l.state_code, l));
    return map;
  }, [leaders]);

  const active = WEST_MALAYSIA_STATES.find((s) => s.code === activeCode);
  const activeLeader = byCode.get(activeCode);

  useEffect(() => {
    setDraft({
      leader: activeLeader?.leader_name ?? "",
      phone: activeLeader?.phone ?? "",
    });
  }, [activeLeader]);

  const save = useMutation({
    mutationFn: async () => {
      if (!activeLeader) throw new Error("State not found");
      const { error } = await supabase
        .from("state_leaders")
        .update({ leader_name: draft.leader.trim(), phone: draft.phone.trim() })
        .eq("id", activeLeader.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["state-leaders"] });
      toast.success("State leader updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-4">
          <Crest className="h-14 w-14" />
          <span>
            <span className="block text-xs uppercase tracking-[0.35em] text-primary/80">
              Unboss Studio
            </span>
            <span className="block font-display text-lg">State Team</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/schedule">Calendar</Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
        </div>
      </header>

      <div className="rule-gold my-8" />

      <h1 className="font-display text-2xl text-gilded">Peninsular Malaysia</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Tap a state to reveal its Unboss state leader and contact number.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface-royal rounded-lg p-4">
          <svg
            viewBox={`-12 -12 ${MAP_WIDTH + 24} ${MAP_HEIGHT + 24}`}
            className="mx-auto h-auto w-full max-w-xl"
            role="img"
            aria-label="Clickable map of the states of West Malaysia"
          >
            <defs>
              <linearGradient id="stateGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.66 0.1 72)" />
                <stop offset="45%" stopColor="oklch(0.88 0.12 92)" />
                <stop offset="100%" stopColor="oklch(0.66 0.1 72)" />
              </linearGradient>
            </defs>
            {WEST_MALAYSIA_STATES.map((s) => {
              const isActive = s.code === activeCode;
              return (
                <path
                  key={s.code}
                  d={s.d}
                  onClick={() => setActiveCode(s.code)}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  fill={isActive ? "url(#stateGold)" : "oklch(0.24 0.055 259)"}
                  stroke="oklch(0.79 0.115 84)"
                  strokeWidth={isActive ? 3 : 1.4}
                  strokeOpacity={isActive ? 1 : 0.55}
                >
                  <title>{s.name}</title>
                </path>
              );
            })}
            {WEST_MALAYSIA_STATES.map((s) => (
              <text
                key={`${s.code}-label`}
                x={s.label[0]}
                y={s.label[1]}
                textAnchor="middle"
                onClick={() => setActiveCode(s.code)}
                className="pointer-events-none select-none font-display"
                fill={s.code === activeCode ? "oklch(0.17 0.045 258)" : "oklch(0.79 0.115 84)"}
                fillOpacity={s.code === activeCode ? 1 : 0.75}
                fontSize={16}
                letterSpacing="1.5"
              >
                {s.code}
              </text>
            ))}
          </svg>
        </section>

        <section className="surface-royal rounded-lg p-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary/80">State leader</p>
          <h2 className="mt-2 font-display text-2xl text-gilded">
            {activeLeader?.state_name ?? active?.name ?? "—"}
          </h2>
          <div className="rule-gold my-5" />

          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Name</p>
          <p className="mt-1 font-display text-lg">
            {activeLeader?.leader_name || "Not assigned yet"}
          </p>

          <p className="mt-5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Phone
          </p>
          {activeLeader?.phone ? (
            <a
              href={`tel:${activeLeader.phone.replace(/\s+/g, "")}`}
              className="mt-1 block font-display text-lg text-primary hover:underline"
            >
              {activeLeader.phone}
            </a>
          ) : (
            <p className="mt-1 font-display text-lg text-muted-foreground">—</p>
          )}

          {isAdmin && (
            <Button className="mt-7 w-full" onClick={() => setEditOpen(true)}>
              Edit state leader
            </Button>
          )}

          <div className="rule-gold my-6" />
          <ul className="grid grid-cols-2 gap-2 text-xs">
            {WEST_MALAYSIA_STATES.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  onClick={() => setActiveCode(s.code)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                    s.code === activeCode
                      ? "border-primary/70 bg-primary/15 text-primary"
                      : "border-border/50 text-muted-foreground hover:text-primary"
                  }`}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {activeLeader?.state_name} — state leader
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leader">Leader name</Label>
              <Input
                id="leader"
                value={draft.leader}
                onChange={(e) => setDraft({ ...draft, leader: e.target.value })}
                placeholder="Muhd Amirul Hakim"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="012-345 6789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
