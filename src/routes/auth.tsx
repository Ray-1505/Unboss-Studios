import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crest } from "@/components/Crest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in | Unboss Studio Schedule" },
      {
        name: "description",
        content:
          "Sign in or register as an Unboss Studio team member to mark your available dates and manage bookings.",
      },
      { property: "og:title", content: "Sign in | Unboss Studio Schedule" },
      {
        property: "og:description",
        content: "Team access to the Unboss Studio booking and schedule system.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: roster } = useQuery({
    queryKey: ["roster"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, full_name, gender_label")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!loading && session) navigate({ to: "/schedule", replace: true });
  }, [loading, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!fullName) {
          toast.error("Choose your name from the team list.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/schedule",
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Welcome to the studio");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="surface-royal w-full max-w-md rounded-lg p-8">
        <div className="flex flex-col items-center text-center">
          <Crest className="h-20 w-20" />
          <h1 className="mt-6 text-2xl text-gilded">Unboss Studio</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {mode === "signin" ? "Team sign in" : "Register team member"}
          </p>
          <div className="rule-gold mt-6 w-full" />
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label>Your name</Label>
                <Select value={fullName} onValueChange={setFullName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select from the team list" />
                  </SelectTrigger>
                  <SelectContent>
                    {(roster ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.full_name}>
                        {m.full_name} ({m.gender_label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@unboss.studio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="mt-6 w-full text-center text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary"
        >
          {mode === "signin" ? "New here? Register" : "Already registered? Sign in"}
        </button>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
