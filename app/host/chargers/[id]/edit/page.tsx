import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";
import { loadHostChargerById } from "@/lib/chargers/host-chargers-loader";
import { loadHostBookings } from "@/lib/bookings/host-bookings-loader";
import ChargerForm from "@/components/host/ChargerForm";

export const metadata = {
  title: "Edit Charger | PlugNear Host Portal",
  description: "Update specifications and location for your charging point.",
};

interface EditChargerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditChargerPage(props: EditChargerPageProps) {
  const { id } = await props.params;
  const { user, profile } = await requireRole("host");

  const chargerResult = await loadHostChargerById(id);
  const bookingsResult = await loadHostBookings();

  const pendingCount = bookingsResult.success
    ? bookingsResult.data.bookings.filter((b) => b.status === "requested").length
    : 0;

  if (!chargerResult.success) {
    if (chargerResult.error.code === "CHARGER_NOT_FOUND") {
      notFound();
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />
        <main className="flex-1 mx-auto max-w-md px-4 py-16 text-center">
          <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-xs">
            <span className="text-3xl">⚠️</span>
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              Error Loading Charger
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {chargerResult.error.message}
            </p>
            <Link
              href="/host/chargers"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition"
            >
              Back to My Chargers
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const charger = chargerResult.data;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            ⚡ Edit Listing
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Edit Charging Point
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Update pricing, plug type, or location for &ldquo;{charger.title}&rdquo;.
          </p>
        </div>

        <ChargerForm initialData={charger} isEdit={true} />
      </main>
    </div>
  );
}
