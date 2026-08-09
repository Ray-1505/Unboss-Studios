import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crest } from "@/components/Crest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/schedule")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Master Calendar | Unboss Studio Schedule" },
      {
        name: "description",
        content:
          "Master calendar for the Unboss Studio sales team: available shooters per date, booked jobs and per-shooter availability.",
      },
      { property: "og:title", content: "Master Calendar | Unboss Studio Schedule" },
      {
        property: "og:description",
        content: "Available shooters per date, booked jobs and per-shooter availability.",
      },
    ],
  }),
  component: SchedulePage,
});

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function prettyDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

function SchedulePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(
    iso(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [bookingFor, setBookingFor] = useState<{
    id: string;
    name: string;
    jobId?: string;
  } | null>(null);
  const [form, setForm] = useState({ client: "", location: "", time: "", notes: "" });


  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const monthStart = iso(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = iso(year, month, daysInMonth);
  const leadingBlanks = new Date(year, month, 1).getDay();

  const enabled = Boolean(user);

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, is_active");
      if (error) throw error;
      return data;
    },
  });

  const { data: myRoles } = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled,
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



  const { data: availability } = useQuery({
    queryKey: ["availability", monthStart],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability")
        .select("id, user_id, available_date")
        .gte("available_date", monthStart)
        .lte("available_date", monthEnd);
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs } = useQuery({
    queryKey: ["jobs", monthStart],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, job_date, shooter_id, client_name, location, start_time, notes, created_by")
        .gte("job_date", monthStart)
        .lte("job_date", monthEnd);
      if (error) throw error;
      return data;
    },
  });

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    (profiles ?? []).forEach((p) => map.set(p.id, p.full_name || "Team member"));
    return map;
  }, [profiles]);

  const myName = user ? nameOf.get(user.id) ?? "You" : "";

  const activeIds = useMemo(
    () => new Set((profiles ?? []).filter((p) => p.is_active).map((p) => p.id)),
    [profiles],
  );

  const availByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    (availability ?? [])
      .filter((a) => activeIds.has(a.user_id))
      .forEach((a) => {
        map.set(a.available_date, [...(map.get(a.available_date) ?? []), a.user_id]);
      });
    return map;
  }, [availability, activeIds]);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, typeof jobs>();
    (jobs ?? []).forEach((j) => {
      map.set(j.job_date, [...(map.get(j.job_date) ?? []), j] as typeof jobs);
    });
    return map;
  }, [jobs]);

  function dayStatus(date: string) {
    const avail = availByDate.get(date) ?? [];
    const dayJobs = jobsByDate.get(date) ?? [];
    if (dayJobs.length === 0) return "open" as const;
    const booked = new Set((dayJobs ?? []).map((j) => j.shooter_id));
    const free = avail.filter((id) => !booked.has(id));
    return free.length > 0 ? ("partial" as const) : ("full" as const);
  }


  const toggleAvailability = useMutation({
    mutationFn: async ({ date, on }: { date: string; on: boolean }) => {
      if (!user) throw new Error("Not signed in");
      if (on) {
        const { error } = await supabase
          .from("availability")
          .insert({ user_id: user.id, available_date: date });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("availability")
          .delete()
          .eq("user_id", user.id)
          .eq("available_date", date);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      toast.success(vars.on ? "Marked available" : "Availability removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveJob = useMutation({
    mutationFn: async () => {
      if (!user || !bookingFor) throw new Error("Not ready");
      const payload = {
        client_name: form.client,
        location: form.location,
        start_time: form.time,
        notes: form.notes,
      };
      if (bookingFor.jobId) {
        const { error } = await supabase
          .from("jobs")
          .update(payload)
          .eq("id", bookingFor.jobId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("jobs").insert({
        ...payload,
        job_date: selected,
        shooter_id: bookingFor.id,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, _v) => {
      const wasEdit = Boolean(bookingFor?.jobId);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setBookingFor(null);
      setForm({ client: "", location: "", time: "", notes: "" });
      toast.success(wasEdit ? "Booking updated" : "Slot booked");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const removeJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Booking removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const selectedAvailable = availByDate.get(selected) ?? [];
  const selectedJobs = jobsByDate.get(selected) ?? [];
  const bookedOnSelected = new Set((selectedJobs ?? []).map((j) => j.shooter_id));
  const selectedFree = selectedAvailable.filter((id) => !bookedOnSelected.has(id));
  const iAmAvailable = selectedAvailable.includes(user.id);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-4">
          <Crest className="h-14 w-14" />
          <span>
            <span className="block text-xs uppercase tracking-[0.35em] text-primary/80">
              Unboss Studio
            </span>
            <span className="block font-display text-lg">Master Calendar</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{myName}</span>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">Admin</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="rule-gold my-8" />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="surface-royal rounded-lg p-5">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)}>
              ‹ Prev
            </Button>
            <h2 className="text-lg text-gilded">
              {MONTHS[month]} {year}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)}>
              Next ›
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {DAY_LABELS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const date = iso(year, month, i + 1);
              const avail = availByDate.get(date) ?? [];
              const dayJobs = jobsByDate.get(date) ?? [];
              const isSelected = date === selected;
              const status = dayStatus(date);
              const tone = !isAdmin
                ? dayJobs.length > 0
                  ? "day-partial"
                  : "day-open"
                : status === "open"
                  ? "day-open"
                  : status === "partial"
                    ? "day-partial"
                    : "day-full";

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(date)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-md border text-sm transition-transform hover:-translate-y-0.5 ${tone} ${
                    isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                  }`}
                >
                  <span className="font-display">{i + 1}</span>
                  <span className="mt-1 flex items-center gap-1 text-[10px] opacity-80">
                    {avail.length > 0 && <span>{avail.length}●</span>}
                    {dayJobs.length > 0 && <span>{dayJobs.length}▲</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="day-open inline-block h-3 w-3 rounded-sm border" /> No active jobs
            </span>
            <span className="flex items-center gap-2">
              <span className="day-partial inline-block h-3 w-3 rounded-sm border" /> Jobs, shooters
              still free
            </span>
            <span className="flex items-center gap-2">
              <span className="day-full inline-block h-3 w-3 rounded-sm border" /> Fully booked
            </span>
            <span>● available &nbsp;·&nbsp; ▲ jobs</span>
          </p>
        </section>


        <section className="surface-royal rounded-lg p-5">
          <h2 className="text-base text-gilded">{prettyDate(selected)}</h2>
          <div className="rule-gold my-4" />

          <div className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/40 p-3">
            <div>
              <p className="text-sm">My availability</p>
              <p className="text-[11px] text-muted-foreground">Mark this date on or off</p>
            </div>
            <Switch
              checked={iAmAvailable}
              onCheckedChange={(on) => toggleAvailability.mutate({ date: selected, on })}
            />
          </div>

          <h3 className="mt-6 text-xs uppercase tracking-[0.25em] text-primary">
            {isAdmin ? "Shooters on duty" : "My jobs"}
          </h3>
          <ul className="mt-3 space-y-2">
            {selectedJobs.length === 0 && (
              <li className="text-sm text-muted-foreground">
                {isAdmin ? "No jobs booked yet." : "You have no jobs on this date."}
              </li>
            )}
            {selectedJobs.map((j) => (
              <li key={j.id} className="rounded-md border border-primary/30 bg-primary/10 p-3">
                <p className="font-display text-sm text-primary">
                  {nameOf.get(j.shooter_id) ?? "Team member"}
                  {j.location ? ` — ${j.location}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {[j.client_name, j.start_time].filter(Boolean).join(" · ") || "No details"}
                </p>
                {j.notes && <p className="mt-1 text-[11px] text-muted-foreground">{j.notes}</p>}
                {isAdmin && (
                  <div className="mt-2 flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          client: j.client_name,
                          location: j.location,
                          time: j.start_time,
                          notes: j.notes,
                        });
                        setBookingFor({
                          id: j.shooter_id,
                          name: nameOf.get(j.shooter_id) ?? "Team member",
                          jobId: j.id,
                        });
                      }}
                      className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Remove this booking?")) removeJob.mutate(j.id);
                      }}
                      className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {isAdmin && (
            <>
              <h3 className="mt-6 text-xs uppercase tracking-[0.25em] text-primary">
                Available slots
              </h3>
              <ul className="mt-3 space-y-2">
                {selectedFree.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No free shooters left for this date.
                  </li>
                )}
                {selectedFree.map((id) => (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/40 p-3"
                  >
                    <span className="text-sm">{nameOf.get(id) ?? "Team member"}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setForm({ client: "", location: "", time: "", notes: "" });
                        setBookingFor({ id, name: nameOf.get(id) ?? "Team member" });
                      }}
                    >
                      Slot job
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}

        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-lg text-gilded">Shooter Calendar</h2>
        <div className="rule-gold my-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(profiles ?? []).map((p) => {
            const dates = (availability ?? [])
              .filter((a) => a.user_id === p.id)
              .map((a) => a.available_date)
              .sort();
            const myJobs = (jobs ?? []).filter((j) => j.shooter_id === p.id);
            return (
              <article key={p.id} className="surface-royal rounded-lg p-5">
                <h3 className="font-display text-base text-primary">
                  {p.full_name || "Team member"}
                </h3>
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Available dates
                </p>
                <p className="mt-1 text-sm">
                  {dates.length
                    ? dates.map((d) => d.slice(8) + "/" + d.slice(5, 7)).join(", ")
                    : "—"}
                </p>
                {(isAdmin || p.id === user.id) && (
                  <>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Total jobs ({myJobs.length})
                    </p>
                    <p className="mt-1 text-sm">
                      {myJobs.length
                        ? myJobs
                            .map((j) => j.job_date.slice(8) + "/" + j.job_date.slice(5, 7))
                            .join(", ")
                        : "—"}
                    </p>
                  </>
                )}

              </article>
            );
          })}
        </div>
      </section>

      <Dialog open={Boolean(bookingFor)} onOpenChange={(open) => !open && setBookingFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {bookingFor?.jobId ? "Edit job" : "Slot"} {bookingFor?.name} —{" "}
              {prettyDate(selected)}
            </DialogTitle>

          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client / job</Label>
              <Input
                id="client"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                placeholder="Baju U.B Production"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Sik / Baling"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                placeholder="2:30 pm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Gear, contact person, extras"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveJob.mutate()} disabled={saveJob.isPending}>
              {saveJob.isPending
                ? "Saving…"
                : bookingFor?.jobId
                  ? "Save changes"
                  : "Confirm booking"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </main>
  );
}
