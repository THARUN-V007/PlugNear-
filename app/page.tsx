import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, MapPin, ShieldCheck, Timer, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "host") {
      redirect("/host");
    } else {
      redirect("/driver");
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas text-white">
      {/* Ambient background: grid texture plus neon green and cyan glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-10%,rgba(57,255,20,0.18),transparent_55%),radial-gradient(circle_at_88%_8%,rgba(0,229,255,0.15),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
      />

      {/* Top Navbar */}
      <nav className="relative flex items-center justify-between border-b border-[#2C303B] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-black shadow-lg shadow-primary/30">
            <Zap className="h-5 w-5 fill-black" strokeWidth={2.5} aria-hidden />
          </div>
          <span className="text-xl font-black tracking-tight font-display">PlugNear</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl border border-[#2C303B] bg-[#181B22] px-4 py-2 text-xs font-bold text-slate-200 transition-all hover:bg-[#242933] hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-black shadow-lg shadow-primary/20 transition-all hover:bg-[#32e012]"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-3xl space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
            Conflict-free scheduling · PostGIS proximity search
          </div>

          <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl font-display">
            Rent idle EV chargers.
            <span className="block bg-gradient-to-r from-primary via-[#00E5FF] to-white bg-clip-text text-transparent mt-1">
              Never two bookings for one slot.
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base text-slate-300 sm:text-lg">
            PlugNear connects a driver running low on battery with the house or shop on their
            route that already owns a charger — then proves the slot is genuinely free before
            anyone commits.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-black text-black shadow-xl shadow-primary/25 transition-all hover:bg-[#32e012] sm:w-auto"
            >
              Sign Up (Driver or Host)
              <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden>
                &rarr;
              </span>
            </Link>
            <Link
              href="/login"
              className="w-full rounded-xl border border-[#2C303B] bg-[#181B22] px-8 py-3.5 text-base font-bold text-slate-200 backdrop-blur transition-all hover:bg-[#242933] hover:text-white sm:w-auto"
            >
              Sign In to Existing Account
            </Link>
          </div>

          <dl className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                Icon: ShieldCheck,
                title: "Double-booking proof",
                body: "A Postgres exclusion constraint makes two overlapping confirmed bookings impossible, even under concurrent approvals.",
              },
              {
                Icon: MapPin,
                title: "Real proximity search",
                body: "ST_DWithin over a GiST spatial index, then availability windows and confirmed slots filter the candidates.",
              },
              {
                Icon: Timer,
                title: "One clock, IST",
                body: "Slots are stored in UTC and matched against local weekly windows, so a 30-minute booking is always 30 minutes.",
              },
              {
                Icon: LockKeyhole,
                title: "Host privacy by default",
                body: "Street address and exact pin unlock only after the host confirms; everyone else sees a masked neighbourhood pin.",
              },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-[#2C303B] bg-[#181B22] p-4 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <Icon
                  className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <dt className="mt-2 text-sm font-black text-white font-display">{title}</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-slate-400">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-[#2C303B] px-6 py-6 text-center text-xs text-slate-500">
        PlugNear &bull; Next.js App Router, Supabase PostGIS, Tailwind CSS.
      </footer>
    </div>
  );
}
