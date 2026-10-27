import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";
import { loadHostBookings } from "@/lib/bookings/host-bookings-loader";
import ChargerForm from "@/components/host/ChargerForm";

export const metadata = {
  title: "List a Charger | PlugNear Host Portal",
  description: "Create and publish a new charging point listing.",
};

export default async function NewChargerPage() {
  const { user, profile } = await requireRole("host");
  const bookingsResult = await loadHostBookings();

  const pendingCount = bookingsResult.success
    ? bookingsResult.data.bookings.filter((b) => b.status === "requested").length
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            ⚡ New Listing
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            List a New Charging Point
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Set up your charging point specifications, map pin, hourly price, and regulatory declaration.
          </p>
        </div>

        <ChargerForm isEdit={false} />
      </main>
    </div>
  );
}
