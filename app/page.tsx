import Link from "next/link";
import { redirect } from "next/navigation";
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
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      {/* Top Navbar */}
      <nav className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-bold text-slate-950 shadow">
            ⚡
          </div>
          <span className="text-xl font-extrabold tracking-tight">PlugNear</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow transition hover:bg-emerald-400"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-4 py-1.5 text-xs font-semibold text-emerald-400 backdrop-blur">
            <span>⚡ Phase 0 Shared Foundation Active</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Rent Idle EV Chargers.{" "}
            <span className="text-emerald-400">Zero Double Bookings.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-slate-300">
            PlugNear connects EV drivers in urgent need of a charge with local hosts who have unused private charging points. Built with rigorous conflict-checking and deterministic scheduling.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row pt-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-slate-950 shadow-lg transition hover:bg-emerald-400"
            >
              Sign Up (Driver or Host) &rarr;
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800/80 px-8 py-3.5 text-base font-bold text-slate-200 transition hover:bg-slate-700"
            >
              Sign In to Existing Account
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-6 text-center text-xs text-slate-500">
        PlugNear Foundation &bull; Built with Next.js, Supabase PostGIS, and Tailwind CSS.
      </footer>
    </div>
  );
}
