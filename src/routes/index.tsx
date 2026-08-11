import { createFileRoute, Link } from "@tanstack/react-router";
import { Crest } from "@/components/Crest";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Unboss Studio | Sales Team Booking & Schedule" },
      {
        name: "description",
        content:
          "The royal booking and schedule system for the Unboss Studio sales team. Shooters mark available dates, admins slot jobs into the master calendar.",
      },
      { property: "og:title", content: "Unboss Studio | Sales Team Booking & Schedule" },
      {
        property: "og:description",
        content:
          "Shooters mark available dates, admins slot jobs into the master calendar. Dark blue and gold, built for Unboss Empire Sdn Bhd.",
      },
    ],
  }),
  component: Index,
});

const pillars = [
  {
    title: "Master Calendar",
    body: "One royal month view. Every date shows who is available and which shooter is already on duty.",
  },
  {
    title: "Shooter Calendar",
    body: "Each shooter marks their own available dates on or off, and sees their total confirmed jobs.",
  },
  {
    title: "Slot & Assign",
    body: "Admins and the sales team slot a job onto any available shooter for that date, with client and location.",
  },
];

function Index() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
      <Crest className="h-28 w-28" />
      <p className="mt-8 text-xs uppercase tracking-[0.45em] text-primary/80">
        Unboss Empire Sdn Bhd
      </p>
      <h1 className="mt-4 text-4xl leading-tight sm:text-6xl">
        <span className="text-gilded">Booking &amp; Schedule</span>
        <br />
        <span className="text-foreground/90">System</span>
      </h1>
      <div className="rule-gold mt-8 w-56" />
      <p className="mt-8 max-w-xl text-base text-muted-foreground">
        The command room for the Unboss Studio sales team. Mark your available dates, and let
        the team slot every shoot into the master calendar without a single crossed wire.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/auth">Enter the studio</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/schedule">View calendar</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/state-team">State Team</Link>
        </Button>

      </div>

      <section className="mt-20 grid w-full gap-5 text-left sm:grid-cols-3">
        {pillars.map((p) => (
          <article key={p.title} className="surface-royal rounded-lg p-6">
            <h2 className="text-sm uppercase tracking-[0.2em] text-primary">{p.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{p.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
