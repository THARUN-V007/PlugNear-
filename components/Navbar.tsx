import { logOutAction } from "@/app/actions/auth";
import type { UserProfile } from "@/lib/auth/guard";

interface NavbarProps {
  profile: UserProfile;
  email?: string;
}

export function Navbar({ profile, email }: NavbarProps) {
  const isHost = profile.role === "host";

  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-lg shadow-sm">
            ⚡
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              PlugNear
            </span>
            <span className="ml-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
              {isHost ? "Host Portal" : "Driver Portal"}
            </span>
          </div>
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
