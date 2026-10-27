import Link from "next/link";
import { AlertTriangle, MapPin, PlugZap, ShieldCheck, Zap } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        {isForbiddenRedirect && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-500" strokeWidth={1.75} aria-hidden />
            <div>
              <p className="font-semibold">Access Restricted</p>
              <p>
                You attempted to access a Driver-only page. As a Charger Host, you have been redirected to your Host Portal.
              </p>
            </div>
          </div>
        )}

        {pendingCount > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <h2 className="text-sm font-bold text-amber-900">
                  {pendingCount === 1
                    ? "1 Pending Booking Request"
                    : `${pendingCount} Pending Booking Requests`}
                </h2>
                <p className="text-xs text-amber-700 mt-0.5">
                  EV drivers are waiting for your approval. Conflicting slots will be automatically declined.
                </p>
              </div>
            </div>
            <Link
              href="/host/bookings"
              className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 whitespace-nowrap"
            >
              Review Requests →
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 border border-cyan-200">
                <PlugZap className="h-4 w-4" strokeWidth={2} aria-hidden /> Host Dashboard
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Welcome, {profile.name}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Host ID: <code className="text-xs font-mono bg-slate-100 px-1 py-0.5 rounded">{user.id}</code>
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-right">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
                Active Role
              </span>
              <span className="text-sm font-bold text-cyan-700 capitalize">
                {profile.role}
              </span>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <Link
                href="/host/chargers"
                className="group rounded-xl border border-cyan-200 p-5 bg-cyan-50/40 hover:bg-cyan-50 transition shadow-xs flex flex-col justify-between"
              >
                <div>
                  <MapPin className="h-6 w-6 text-cyan-600" strokeWidth={1.75} aria-hidden />
                  <h3 className="mt-2 text-sm font-bold text-cyan-950 group-hover:text-cyan-700 transition">
                    1. My Charging Points →
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Interactive map pin placement, power rating, connector type, and hourly tariff.
                  </p>
                </div>
              </Link>

              <div className="rounded-xl border border-slate-200 p-5 bg-white shadow-xs">
                <span className="text-2xl">⏰</span>
                <h3 className="mt-2 text-sm font-bold text-slate-900">2. Availability Windows</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Weekly recurrent schedules with overlap prevention per day.
                </p>
              </div>

              <Link
                href="/host/bookings"
                className="group rounded-xl border border-cyan-200 p-5 bg-cyan-50/40 hover:bg-cyan-50 transition shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" strokeWidth={1.75} aria-hidden />
                    {pendingCount > 0 ? (
                      <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-white">
                        {pendingCount} Pending
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        View
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-cyan-950 group-hover:text-cyan-700 transition">
                    3. Request Manager →
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Review and decide booking requests with atomic double-booking protection.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

