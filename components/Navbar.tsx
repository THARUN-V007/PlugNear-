import Link from "next/link";
import {
  CalendarCheck2,
  ClipboardList,
  LayoutDashboard,
  Search,
  LogOut,
  Zap,
} from "lucide-react";
import { logOutAction } from "@/app/actions/auth";
import type { UserProfile } from "@/lib/auth/guard";

interface NavbarProps {
  profile: UserProfile;
  email?: string;
  pendingBookingsCount?: number;
}

const DRIVER_LINKS = [
  { href: "/driver", label: "Search", Icon: Search },
  { href: "/driver/bookings", label: "My Bookings", Icon: CalendarCheck2 },
];

const HOST_LINKS = [
  { href: "/host", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/host/chargers", label: "My Chargers", Icon: Zap },
  { href: "/host/bookings", label: "Booking Requests", Icon: ClipboardList },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Navbar({ profile, email, pendingBookingsCount }: NavbarProps) {
  const isHost = profile.role === "host";
  const links = isHost ? HOST_LINKS : DRIVER_LINKS;
  // Literal class strings only - Tailwind cannot see interpolated class names.
  const linkAccent = isHost
    ? "hover:text-sky-700 focus-visible:ring-sky-500"
    : "hover:text-emerald-700 focus-visible:ring-emerald-500";
  const underlineAccent = isHost ? "bg-sky-500" : "bg-emerald-500";

  return (
    <header className="sticky top-0 z-[500] border-b border-slate-200/80 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href={isHost ? "/host" : "/driver"}
            className="group flex shrink-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <div
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-300 group-hover:scale-105 group-active:scale-95 bg-gradient-to-br ${
                isHost
                  ? "from-sky-600 to-teal-600 shadow-sky-600/25"
                  : "from-emerald-500 to-teal-600 shadow-emerald-600/25"
              }`}
            >
              <Zap className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              <span
                className={`pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ${
                  isHost ? "ring-white/25" : "ring-white/30"
                }`}
              />
            </div>
            <div className="min-w-0">
              <span className="text-xl font-black tracking-tight text-slate-900">PlugNear</span>
              <span className="ml-2 hidden uppercase tracking-wider text-xs font-semibold text-slate-500 sm:inline">
                {isHost ? "Host Portal" : "Driver Portal"}
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto sm:gap-2" aria-label="Primary">
            {links.map(({ href, label, Icon }) => {
              const showBadge =
                href === "/host/bookings" &&
                typeof pendingBookingsCount === "number" &&
                pendingBookingsCount > 0;

              return (
                <Link
                  key={href}
                  href={href}
                  className={`group relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${linkAccent}`}
                >
                  <Icon className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" aria-hidden />
                  {label}
                  {showBadge && (
                    <span className="relative inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" aria-hidden />
                      {pendingBookingsCount}
                    </span>
                  )}
                  <span
                    className={`pointer-events-none absolute inset-x-2 -bottom-px h-0.5 origin-left scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100 ${underlineAccent}`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-800">{profile.name}</p>
            <p className="text-xs leading-tight text-slate-500">{email || profile.phone || "Logged in"}</p>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`hidden h-9 w-9 place-items-center rounded-full text-[11px] font-black text-white shadow-sm sm:grid bg-gradient-to-br ${
                isHost ? "from-sky-500 to-teal-600" : "from-emerald-500 to-teal-600"
              }`}
              aria-hidden
            >
              {initialsOf(profile.name)}
            </div>

            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                isHost
                  ? "border-sky-200 bg-sky-100 text-sky-800"
                  : "border-emerald-200 bg-emerald-100 text-emerald-800"
              }`}
            >
              {profile.role}
            </span>
          </div>

          <form action={logOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 active:translate-y-0"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
