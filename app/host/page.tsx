import Link from "next/link";
import { AlertTriangle, ClipboardList, MapPin, PlugZap, ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";
import { loadHostBookings } from "@/lib/bookings/host-bookings-loader";

interface HostPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HostHomePage(props: HostPageProps) {
  const { user, profile } = await requireRole("host");
  const searchParams = await props.searchParams;
  const isForbiddenRedirect = searchParams.forbidden === "true";

  const bookingsResult = await loadHostBookings();
  const pendingCount = bookingsResult.success
    ? bookingsResult.data.bookings.filter((b) => b.status === "requested").length
    : 0;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        {/* Forbidden redirect banner */}
        {isForbiddenRedirect && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-800/60 bg-amber-950/40 p-4 text-sm text-amber-200 shadow-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" strokeWidth={1.75} aria-hidden />
            <div>
              <p className="font-semibold text-amber-300">Access Restricted</p>
              <p className="text-amber-200/80 mt-0.5">
                You attempted to access a Driver-only page. As a Charger Host, you have been redirected to your Host Portal.
              </p>
            </div>
          </div>
        )}

        {/* Pending requests alert */}
        {pendingCount > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-800/50 bg-amber-950/30 p-5 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <ClipboardList className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-amber-200">
                  {pendingCount === 1
                    ? "1 Pending Booking Request"
                    : `${pendingCount} Pending Booking Requests`}
                </h2>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  EV drivers are waiting for your approval. Conflicting slots will be automatically declined.
                </p>
              </div>
            </div>
            <Link
              href="/host/bookings"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-400 hover:-translate-y-px whitespace-nowrap"
            >
              Review Requests →
            </Link>
          </div>
        )}

        {/* Main card */}
        <div className="rounded-2xl border border-[#2C303B] bg-panel p-8 shadow-card">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#2C303B] pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-800/60 bg-cyan-950/40 px-3 py-1 text-xs font-semibold text-cyan-300">
                <PlugZap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Host Dashboard
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-white font-display">
                Welcome, {profile.name}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Host ID:{" "}
                <code className="text-xs font-mono bg-[#0F1115] border border-[#2C303B] px-1.5 py-0.5 rounded text-slate-400">
                  {user.id}
                </code>
              </p>
            </div>

            <div className="rounded-xl bg-[#0F1115] border border-[#2C303B] p-4 text-right min-w-[120px]">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">
                Active Role
              </span>
              <span className="text-sm font-bold text-cyan-300 capitalize mt-1 block">
                {profile.role}
              </span>
            </div>
          </div>

          {/* Action cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Chargers */}
            <Link
              href="/host/chargers"
              className="group flex flex-col rounded-xl border border-[#2C303B] bg-[#0F1115] p-5 transition-all duration-200 hover:border-cyan-800/70 hover:bg-[#181B22] hover:shadow-glow-cyan hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-800/50 bg-cyan-950/30 text-cyan-400 mb-3 transition-colors group-hover:border-cyan-700 group-hover:bg-cyan-950/50">
                <MapPin className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                My Charging Points →
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Interactive map pin placement, power rating, connector type, and hourly tariff.
              </p>
            </Link>

            {/* Availability Windows (static info) */}
            <div className="flex flex-col rounded-xl border border-[#2C303B] bg-[#0F1115] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2C303B] bg-panel text-[#39FF14] mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-100">Availability Windows</h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Weekly recurrent schedules with overlap prevention per day — managed inside each charger.
              </p>
            </div>

            {/* Booking Requests */}
            <Link
              href="/host/bookings"
              className="group flex flex-col rounded-xl border border-[#2C303B] bg-[#0F1115] p-5 transition-all duration-200 hover:border-amber-800/60 hover:bg-[#181B22] hover:shadow-glow-amber hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2C303B] bg-panel text-[#39FF14] transition-colors group-hover:border-amber-800/50 group-hover:bg-amber-950/30 group-hover:text-amber-400">
                  <ShieldCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                {pendingCount > 0 ? (
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-slate-950">
                    {pendingCount} Pending
                  </span>
                ) : (
                  <span className="rounded-full border border-[#2C303B] bg-panel px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    View All
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                Request Manager →
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Review and decide booking requests with atomic double-booking protection.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
