import Link from "next/link";
import { logOutAction } from "@/app/actions/auth";
import type { UserProfile } from "@/lib/auth/guard";

interface NavbarProps {
  profile: UserProfile;
  email?: string;
  pendingBookingsCount?: number;
}

export function Navbar({ profile, email, pendingBookingsCount }: NavbarProps) {
  const isHost = profile.role === "host";

  return (
    <header className="border-b border-slate-200 bg-white shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href={isHost ? "/host" : "/driver"} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-lg shadow-sm">
              ⚡
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                PlugNear
              </span>
              <span className="ml-2 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:inline">
                {isHost ? "Host Portal" : "Driver Portal"}
              </span>
            </div>
          </Link>

          {/* Navigation Links for Driver */}
          {!isHost && (
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/driver"
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 transition"
              >
                Search
              </Link>
              <Link
                href="/driver/bookings"
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 transition"
              >
                My Bookings
              </Link>
            </nav>
          )}

          {/* Navigation Links for Host */}
          {isHost && (
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/host"
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-purple-700 hover:bg-slate-50 transition"
              >
                Dashboard
              </Link>
              <Link
                href="/host/bookings"
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-purple-700 hover:bg-slate-50 transition flex items-center gap-1.5"
              >
                <span>Booking Requests</span>
                {typeof pendingBookingsCount === "number" && pendingBookingsCount > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                    {pendingBookingsCount}
                  </span>
                )}
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">{profile.name}</p>
            <p className="text-xs text-slate-500">{email || profile.phone || "Logged in"}</p>
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
              isHost
                ? "bg-purple-100 text-purple-800 border border-purple-200"
                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}
          >
            {profile.role}
          </span>

          <form action={logOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
