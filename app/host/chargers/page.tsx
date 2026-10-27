import { requireRole } from "@/lib/auth/guard";
import { AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { loadHostChargers } from "@/lib/chargers/host-chargers-loader";
import { loadHostBookings } from "@/lib/bookings/host-bookings-loader";
import HostChargersView from "@/components/host/HostChargersView";

export const metadata = {
  title: "My Chargers | PlugNear Host Portal",
  description: "Manage your listed EV chargers and availability schedules.",
};

interface HostChargersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HostChargersPage(props: HostChargersPageProps) {
  const { user, profile } = await requireRole("host");
  const searchParams = await props.searchParams;
  const isSavedNotification = searchParams.saved === "true";

  const chargersResult = await loadHostChargers();
  const bookingsResult = await loadHostBookings();

  const pendingCount = bookingsResult.success
    ? bookingsResult.data.bookings.filter((b) => b.status === "requested").length
    : 0;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        {!chargersResult.success ? (
          <div className="rounded-3xl border border-rose-800 bg-[#181B22] p-8 shadow-lg text-center max-w-md mx-auto">
            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-lg font-black text-white font-display">
              Failed to Load Chargers
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {chargersResult.error.message}
            </p>
          </div>
        ) : (
          <HostChargersView
            initialChargers={chargersResult.data.chargers}
            savedNotification={isSavedNotification}
          />
        )}
      </main>
    </div>
  );
}
