import Link from "next/link";
import { PlugZap } from "lucide-react";
import { requireRole } from "@/lib/auth/guard";
import { Navbar } from "@/components/Navbar";
import { loadChargerDetails } from "@/lib/bookings/charger-loader";
import { ChargerDetailsQuerySchema } from "@/lib/validation/booking";
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

  const query = ChargerDetailsQuerySchema.safeParse({
    startAt: typeof sParams.startAt === "string" ? sParams.startAt : undefined,
    endAt: typeof sParams.endAt === "string" ? sParams.endAt : undefined,
    isEmergency: typeof sParams.isEmergency === "string" ? sParams.isEmergency : undefined,
  });

  const startAt = query.success ? query.data.startAt : undefined;
  const endAt = query.success ? query.data.endAt : undefined;
  const isEmergency = query.success ? query.data.isEmergency : false;

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
      <div className="min-h-screen bg-canvas flex flex-col">
        <Navbar profile={profile} email={user.email} />

        <main className="flex-1 mx-auto max-w-3xl px-4 py-16 sm:px-6 w-full text-center">
          <div className="rounded-3xl bg-[#181B22] p-8 sm:p-12 border border-[#2C303B] shadow-lg space-y-4">
            <PlugZap className="h-8 w-8 text-slate-500 mx-auto" strokeWidth={1.5} aria-hidden />
            <h1 className="text-xl sm:text-2xl font-black text-white font-display">
              Charging Point Not Found
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              We couldn't locate this charging point. It may have been removed or the link is invalid.
            </p>
            <div className="pt-4">
              <Link
                href="/driver"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-black text-black shadow-lg shadow-primary/20 hover:bg-[#32e012] transition"
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
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar profile={profile} email={user.email} />

      <main className="flex-1 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 w-full">
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
