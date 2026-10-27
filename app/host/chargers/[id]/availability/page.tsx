import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";
import { loadAvailabilityData } from "@/lib/availability/availability-loader";
import { loadHostBookings } from "@/lib/bookings/host-bookings-loader";
import WeeklyAvailabilityEditor from "@/components/host/WeeklyAvailabilityEditor";

export const metadata = {
  title: "Weekly Availability | PlugNear Host Portal",
  description: "Set the days and open hours for your EV charging point.",
};

interface AvailabilityPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChargerAvailabilityPage(props: AvailabilityPageProps) {
  const { id } = await props.params;
  const { user, profile } = await requireRole("host");

  const [availabilityResult, bookingsResult] = await Promise.all([
    loadAvailabilityData(id),
    loadHostBookings(),
  ]);

  const pendingCount = bookingsResult.success
    ? bookingsResult.data.bookings.filter((b) => b.status === "requested").length
    : 0;

  if (!availabilityResult.success) {
    if (availabilityResult.error.code === "CHARGER_NOT_FOUND") {
      notFound();
    }

    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />
        <main className="flex-1 mx-auto max-w-md px-4 py-16 text-center">
          <div className="rounded-3xl border border-rose-800 bg-[#181B22] p-8 shadow-lg">
            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-lg font-black text-white font-display">
              Could Not Load Availability
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {availabilityResult.error.message}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                href={`/host/chargers/${id}/availability`}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-black shadow-md shadow-primary/20 hover:bg-[#32e012] transition"
              >
                Retry
              </Link>
              <Link
                href="/host/chargers"
                className="rounded-xl border border-[#2C303B] bg-[#242933] px-4 py-2 text-xs font-bold text-slate-300 hover:bg-[#2e3442] hover:text-white transition"
              >
                Back to My Chargers
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { charger, windows, upcomingConfirmedBookings } = availabilityResult.data;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        <WeeklyAvailabilityEditor
          chargerId={charger.id}
          chargerTitle={charger.title}
          initialWindows={windows}
          upcomingConfirmedBookings={upcomingConfirmedBookings}
        />
      </main>
    </div>
  );
}
