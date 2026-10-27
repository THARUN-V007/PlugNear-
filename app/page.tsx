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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-white">
      {/* Ambient background: charging-grid texture plus two soft glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-10%,rgba(16,185,129,0.28),transparent_55%),radial-gradient(circle_at_88%_8%,rgba(56,189,248,0.18),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
      />

      {/* Top Navbar */}
      <nav className="relative flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/25">
            <Zap className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </div>
          <span className="text-xl font-extrabold tracking-tight">PlugNear</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-px hover:border-emerald-400/60 hover:bg-slate-800 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:-translate-y-px hover:bg-emerald-300 hover:shadow-emerald-500/35 active:translate-y-0"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-3xl space-y-7">
          <div className="plugnear-rise inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
            Conflict-free scheduling · PostGIS proximity search
          </div>

          <h1
            className="plugnear-rise text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Rent idle EV chargers.
            <span className="block bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
              Never two bookings for one slot.
            </span>
          </h1>

          <p
            className="plugnear-rise mx-auto max-w-2xl text-base text-slate-300 sm:text-lg"
            style={{ animationDelay: "160ms" }}
          >
            PlugNear connects a driver running low on battery with the house or shop on their
            route that already owns a charger - then proves the slot is genuinely free before
            anyone commits.
          </p>

          <div
            className="plugnear-rise flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/signup"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-8 py-3.5 text-base font-bold text-slate-950 shadow-xl shadow-emerald-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-emerald-500/40 active:translate-y-0 sm:w-auto"
            >
              Sign Up (Driver or Host)
              <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden>
                &rarr;
              </span>
            </Link>
            <Link
              href="/login"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-base font-bold text-slate-200 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white sm:w-auto"
            >
              Sign In to Existing Account
            </Link>
          </div>

          <dl
            className="plugnear-rise mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4"
            style={{ animationDelay: "320ms" }}
          >
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
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-emerald-500/10"
              >
                <Icon
                  className="h-5 w-5 text-emerald-300 transition-transform duration-300 group-hover:scale-110"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <dt className="mt-2 text-sm font-bold text-white">{title}</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-slate-400">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/10 px-6 py-6 text-center text-xs text-slate-500">
        PlugNear &bull; Next.js App Router, Supabase PostGIS, Tailwind CSS.
      </footer>
    </div>
  );
}
