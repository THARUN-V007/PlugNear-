import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";
import { loadDriverBookings } from "@/lib/bookings/driver-bookings-loader";
import DriverBookingsView from "@/components/driver/DriverBookingsView";

export default async function DriverBookingsPage() {
  const { user, profile } = await requireRole("driver");

  const loadResult = await loadDriverBookings();

  if (!loadResult.success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar profile={profile} email={user.email} />

        <main className="flex-1 mx-auto max-w-3xl px-4 py-16 sm:px-6 w-full text-center">
          <div className="rounded-3xl bg-white p-8 sm:p-12 border border-slate-200 shadow-sm space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Could Not Load Bookings
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {loadResult.error.message || "An unexpected error occurred while loading your bookings."}
            </p>
            <div className="pt-4 flex items-center justify-center gap-3">
              <Link
                href="/driver/bookings"
                className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                Retry
              </Link>
              <Link
                href="/driver"
                className="rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
              >
                Back to Search
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { bookings } = loadResult.data;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} email={user.email} />

      <main className="flex-1 mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 w-full">
        <DriverBookingsView initialBookings={bookings} />
      </main>
    </div>
  );
}
