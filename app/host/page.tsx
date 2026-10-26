import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";

interface HostPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HostHomePage(props: HostPageProps) {
  const { user, profile } = await requireRole("host");
  const searchParams = await props.searchParams;
  const isForbiddenRedirect = searchParams.forbidden === "true";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} email={user.email} />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        {isForbiddenRedirect && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold">Access Restricted</p>
              <p>
                You attempted to access a Driver-only page. As a Charger Host, you have been redirected to your Host Portal.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                🔌 Host Dashboard
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
              <span className="text-sm font-bold text-purple-700 capitalize">
                {profile.role}
              </span>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
              <h2 className="text-base font-semibold text-slate-800">
                Phase 0 Foundation Ready
              </h2>
              <p className="mt-1 text-sm text-slate-600 max-w-xl mx-auto">
                Host authentication and database-level RLS policies are active.
                The host workflow (charger listing with map picker, availability window manager, and booking approval dashboard) will be implemented by Developer H in subsequent steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="rounded-xl border border-slate-200 p-5 bg-white shadow-xs">
                <span className="text-2xl">📍</span>
                <h3 className="mt-2 text-sm font-bold text-slate-900">1. Charger Listing</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Interactive map pin placement, power rating, connector type, and hourly tariff.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-5 bg-white shadow-xs">
                <span className="text-2xl">⏰</span>
                <h3 className="mt-2 text-sm font-bold text-slate-900">2. Availability Windows</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Weekly recurrent schedules with overlap prevention per day.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-5 bg-white shadow-xs">
                <span className="text-2xl">✅</span>
                <h3 className="mt-2 text-sm font-bold text-slate-900">3. Request Manager</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Review booking requests with instant auto-rejection of conflicting pending slots.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
