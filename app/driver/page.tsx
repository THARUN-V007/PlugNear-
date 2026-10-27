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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} email={user.email} />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 w-full">
        {isForbiddenRedirect && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm flex items-start gap-3">
            <AlertTriangle className="h-8 w-8 text-slate-300" strokeWidth={1.5} aria-hidden />
            <div>
              <p className="font-semibold">Access Restricted</p>
              <p>
                You attempted to access a Host-only page. As an EV Driver, you have been redirected to the Driver Search Portal.
              </p>
            </div>
          </div>
        )}

        <DriverSearchScreen />
      </main>
    </div>
  );
}
