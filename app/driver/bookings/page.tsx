import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";
import { loadDriverBookings } from "@/lib/bookings/driver-bookings-loader";
import DriverBookingsView from "@/components/driver/DriverBookingsView";

export default async function DriverBookingsPage() {
  const { user, profile } = await requireRole("driver");

  const loadResult = await loadDriverBookings();

  if (!loadResult.success) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <Navbar profile={profile} email={user.email} />

        <main className="flex-1 mx-auto max-w-3xl px-4 py-16 sm:px-6 w-full text-center">
          <div className="rounded-3xl bg-[#181B22] p-8 sm:p-12 border border-[#2C303B] shadow-lg space-y-4">
            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" strokeWidth={1.5} aria-hidden />
            <h1 className="text-xl sm:text-2xl font-black text-white font-display">
              Could Not Load Bookings
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {loadResult.error.message || "An unexpected error occurred while loading your bookings."}
            </p>
            <div className="pt-4 flex items-center justify-center gap-3">
              <Link
                href="/driver/bookings"
                className="rounded-xl bg-primary px-5 py-2.5 text-xs font-black text-black shadow-lg shadow-primary/20 hover:bg-[#32e012] transition"
              >
                Retry
              </Link>
              <Link
                href="/driver"
                className="rounded-xl bg-[#242933] px-5 py-2.5 text-xs font-bold text-slate-200 border border-[#2C303B] hover:bg-[#2e3442] hover:text-white transition"
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
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar profile={profile} email={user.email} />

      <main className="flex-1 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        <DriverBookingsView
          initialBookings={bookings}
          serverNow={new Date().toISOString()}
        />
      </main>
    </div>
  );
}
