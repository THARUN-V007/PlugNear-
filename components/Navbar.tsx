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

  return (
    <header className="sticky top-0 z-[500] border-b border-[#2C303B] bg-[#0F1115]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Left: Logo + Nav links */}
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href={isHost ? "/host" : "/driver"}
            className="group flex shrink-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1115]"
          >
            {/* Logo mark with toxic green glow */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#39FF14] to-[#2BCC10] text-slate-950 shadow-[0_0_16px_rgba(57,255,20,0.35)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(57,255,20,0.5)] group-active:scale-95">
              <Zap className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </div>
            <div className="min-w-0">
              <span className="text-xl font-black tracking-tight text-white font-display">PlugNear</span>
              <span className="ml-2 hidden uppercase tracking-wider text-[10px] font-semibold text-slate-500 sm:inline">
                {isHost ? "Host Portal" : "Driver Portal"}
              </span>
            </div>
          </Link>

          {/* Navigation */}
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
                  className={`group relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 transition-all duration-200 hover:bg-[#181B22] hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0F1115] ${
                    isHost
                      ? "focus-visible:ring-cyan-500"
                      : "focus-visible:ring-[#39FF14]/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden />
                  {label}
                  {showBadge && (
                    <span className="relative inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" aria-hidden />
                      {pendingBookingsCount}
                    </span>
                  )}
                  {/* Active underline */}
                  <span
                    className={`pointer-events-none absolute inset-x-2 -bottom-px h-[2px] origin-left scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100 ${
                      isHost ? "bg-cyan-400" : "bg-[#39FF14]"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User info + Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-200">{profile.name}</p>
            <p className="text-xs leading-tight text-slate-500">{email || profile.phone || "Logged in"}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Avatar */}
            <div
              className={`hidden h-9 w-9 place-items-center rounded-full text-[11px] font-black shadow-sm sm:grid ${
                isHost
                  ? "bg-gradient-to-br from-cyan-500 to-teal-600 text-slate-950"
                  : "bg-gradient-to-br from-[#39FF14] to-[#2BCC10] text-slate-950"
              }`}
              aria-hidden
            >
              {initialsOf(profile.name)}
            </div>

            {/* Role badge */}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                isHost
                  ? "border-cyan-800 bg-cyan-950/60 text-cyan-300"
                  : "border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14]"
              }`}
            >
              {profile.role}
            </span>
          </div>

          {/* Logout */}
          <form action={logOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C303B] bg-[#181B22] px-3 py-1.5 text-xs font-semibold text-slate-400 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-rose-800 hover:bg-rose-950/50 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0F1115] active:translate-y-0"
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
