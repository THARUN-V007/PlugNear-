import Link from "next/link";
import { AlertTriangle, Zap } from "lucide-react";
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
      <div className="min-h-screen bg-canvas flex flex-col">
        <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />
        <main className="flex-1 mx-auto max-w-md px-4 py-16 text-center">
          <div className="rounded-3xl border border-rose-800 bg-[#181B22] p-8 shadow-lg">
            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-lg font-black text-white font-display">
              Error Loading Charger
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {chargerResult.error.message}
            </p>
            <Link
              href="/host/chargers"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-black shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition"
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
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar profile={profile} email={user.email} pendingBookingsCount={pendingCount} />

      <main className="flex-1 mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400 border border-cyan-500/30">
            <Zap className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> Edit Listing
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white font-display">
            Edit Charging Point
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Update pricing, plug type, or location for &ldquo;{charger.title}&rdquo;.
          </p>
        </div>

        <ChargerForm initialData={charger} isEdit={true} />
      </main>
    </div>
  );
}
