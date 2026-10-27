import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";
import { loadChargerDetails } from "@/lib/bookings/charger-loader";
import ChargerDetailsView from "@/components/booking/ChargerDetailsView";

interface ChargerDetailsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChargerDetailsPage({
  params,
  searchParams,
}: ChargerDetailsPageProps) {
  const { user, profile } = await requireRole("driver");
  const { id } = await params;
  const sParams = await searchParams;

  const startAt = typeof sParams.startAt === "string" ? sParams.startAt : undefined;
  const endAt = typeof sParams.endAt === "string" ? sParams.endAt : undefined;
  const isEmergency = sParams.isEmergency === "true";

  const loadResult = await loadChargerDetails(
    id,
    {
      startAt,
      endAt,
      isEmergency,
      currentDriverId: profile.id,
    },
    new Date()
  );

  if (!loadResult.success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar profile={profile} email={user.email} />

        <main className="flex-1 mx-auto max-w-3xl px-4 py-16 sm:px-6 w-full text-center">
          <div className="rounded-3xl bg-white p-8 sm:p-12 border border-slate-200 shadow-sm space-y-4">
            <div className="text-4xl">🔌</div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Charging Point Not Found
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              We couldn't locate this charging point. It may have been removed or the link is invalid.
            </p>
            <div className="pt-4">
              <Link
                href="/driver"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                &larr; Return to Driver Search
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { charger, windows, validation } = loadResult.data;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} email={user.email} />

      <main className="flex-1 mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 w-full">
        <ChargerDetailsView
          charger={charger}
          windows={windows}
          validation={validation}
          isEmergency={isEmergency}
        />
      </main>
    </div>
  );
}
