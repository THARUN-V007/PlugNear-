import { requireRole } from "@/lib/auth/guard";
import { AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import DriverSearchScreen from "@/components/search/DriverSearchScreen";

interface DriverPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DriverSearchPage(props: DriverPageProps) {
  const { user, profile } = await requireRole("driver");
  const searchParams = await props.searchParams;
  const isForbiddenRedirect = searchParams.forbidden === "true";

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar profile={profile} email={user.email} />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 w-full">
        {isForbiddenRedirect && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-800/60 bg-amber-950/40 p-4 text-sm text-amber-200 shadow-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" strokeWidth={2} aria-hidden />
            <div>
              <p className="font-semibold text-amber-300">Access Restricted</p>
              <p className="text-amber-200/80 mt-0.5">
                You attempted to access a Host-only page. As an EV Driver, you have been redirected to the Driver Search Portal.
              </p>
            </div>
          </div>
        )}

        <DriverSearchScreen initialNowIso={new Date().toISOString()} />
      </main>
    </div>
  );
}
