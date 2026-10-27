import { requireRole } from "@/lib/auth/guard";
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        {!chargersResult.success ? (
          <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-xs text-center max-w-md mx-auto">
            <span className="text-3xl">⚠️</span>
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              Failed to Load Chargers
            </h2>
            <p className="mt-1 text-xs text-slate-500">
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
