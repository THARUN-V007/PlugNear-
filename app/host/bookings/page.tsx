import { requireRole } from "@/lib/auth/guard";
import { AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { loadHostBookings } from "@/lib/bookings/host-bookings-loader";
import HostBookingsView from "@/components/host/HostBookingsView";

export const metadata = {
  title: "Booking Requests | PlugNear Host Portal",
  description: "Review and manage charging point booking requests and reservations.",
};

export default async function HostBookingsPage() {
  const { user, profile } = await requireRole("host");
  const bookingsResult = await loadHostBookings();
  const pendingCount = bookingsResult.success
    ? bookingsResult.data.bookings.filter((b) => b.status === "requested").length
    : 0;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        {!bookingsResult.success ? (
          <div className="rounded-3xl border border-rose-800 bg-[#181B22] p-8 shadow-lg text-center max-w-md mx-auto">
            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-lg font-black text-white font-display">
              Failed to Load Reservations
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {bookingsResult.error.message}
            </p>
          </div>
        ) : (
          <HostBookingsView
            initialBookings={bookingsResult.data.bookings}
            serverNow={new Date().toISOString()}
          />
        )}
      </main>
    </div>
  );
}
