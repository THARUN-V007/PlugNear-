"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Car,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  PlugZap,
  ShieldCheck,
  User,
  Zap,
  Loader2,
} from "lucide-react";
import { signUpAction, type AuthActionState } from "@/app/actions/auth";

export default function SignUpPage() {
  const [selectedRole, setSelectedRole] = useState<"driver" | "host">("driver");
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState<AuthActionState | null, FormData>(
    signUpAction,
    null
  );

  return (
    <div className="relative min-h-screen bg-[#070A12] text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-emerald-500/25 selection:text-emerald-300">
      {/* Ambient Lighting & High-Voltage Grid Glow (GPU-friendly, zero lag) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.14),transparent_70%),radial-gradient(ellipse_60%_50%_at_100%_50%,rgba(14,165,233,0.08),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:48px_48px]"
      />

      {/* Top Navbar */}
      <header className="relative z-10 w-full border-b border-white/[0.08] bg-[#070A12]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3 focus:outline-none">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 transition-transform duration-200 group-hover:scale-105">
              <Zap className="h-5 w-5 fill-slate-950" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white font-display">
                PlugNear
              </span>
              <span className="hidden sm:inline-block ml-2 text-[11px] font-medium text-emerald-400/90 tracking-wider uppercase">
                EV Grid
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Bengaluru Smart Network
            </span>
            <Link
              href="/login"
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-300 hover:border-emerald-400/40 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 mx-auto my-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Automotive & Network Trust Showcase */}
          <div className="space-y-8 lg:col-span-5 lg:pr-4">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 tracking-wide uppercase">
                <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                Verified Peer-to-Peer Charging
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl font-display leading-[1.12]">
                Power your journey on private plugs.
              </h1>
              <p className="text-base leading-relaxed text-slate-400">
                PlugNear connects EV owners to idle private chargers at homes and shops.
                Protected by PostgreSQL atomic exclusion locking, so double-booking a slot is mathematically impossible.
              </p>
            </div>

            {/* Live Network Telemetry Widget (Clean Automotive Style) */}
            <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5 backdrop-blur-md shadow-xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-xs">
                <span className="flex items-center gap-2 font-mono font-medium text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  STATION TELEMETRY
                </span>
                <span className="font-mono text-emerald-400 font-semibold">100% CONFLICT-FREE</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5">
                  <div className="text-lg font-bold text-white font-display">0 ms</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Overlap Window</div>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5">
                  <div className="text-lg font-bold text-emerald-400 font-display">&lt; 250m</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Masked Privacy Pin</div>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5">
                  <div className="text-lg font-bold text-cyan-400 font-display">7.4-22kW</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Type 2 / AC Fast</div>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-3 text-xs text-emerald-200">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  Host coordinates and contact details unlock only after booking approval. Public search never exposes private driveway addresses.
                </span>
              </div>
            </div>

            {/* Feature Bullets */}
            <div className="space-y-3">
              {[
                {
                  icon: Zap,
                  title: "Instant Reserve & Settle",
                  desc: "Lock in charging slots in 30-minute intervals aligned to Indian Standard Time.",
                },
                {
                  icon: MapPin,
                  title: "PostGIS Spatial Proximity",
                  desc: "Sub-15ms spatial query finds chargers on your route within custom kilometre radii.",
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-emerald-400">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">{item.title}</span>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: High-Precision Registration Console */}
          <div className="lg:col-span-7">
            <div className="relative mx-auto max-w-xl rounded-3xl border border-white/[0.1] bg-[#0C1220]/90 p-6 sm:p-9 shadow-2xl backdrop-blur-xl">
              {/* Top Accent Line */}
              <div
                aria-hidden
                className="absolute -top-px left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent"
              />

              <div className="mb-6">
                <span className="inline-block text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                  Account Registration
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
                  Join the PlugNear Grid
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Select your role below. Role assignment enforces security permissions.
                </p>
              </div>

              {state?.error && (
                <div
                  role="alert"
                  className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-200"
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                  <div>
                    <p className="font-bold text-rose-300">Registration failed</p>
                    <p className="mt-0.5 text-xs text-rose-200/90">{state.error}</p>
                  </div>
                </div>
              )}

              {state?.success && (
                <div
                  role="status"
                  className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-200"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-bold text-emerald-300">Registration successful</p>
                    <p className="mt-0.5 text-xs text-emerald-200/90">{state.success}</p>
                    <div className="mt-3">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 font-semibold text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
                      >
                        Proceed to Sign In &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <form action={formAction} className="space-y-5">
                {/* Role Switcher - Precision EV Console Style */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Account Type <span className="text-emerald-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* EV Driver Card */}
                    <label
                      className={`relative flex cursor-pointer flex-col rounded-2xl border p-4 transition-all duration-150 ${
                        selectedRole === "driver"
                          ? "border-emerald-400 bg-emerald-500/[0.08] shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="driver"
                        checked={selectedRole === "driver"}
                        onChange={() => setSelectedRole("driver")}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            selectedRole === "driver"
                              ? "bg-emerald-400 text-slate-950 font-bold"
                              : "bg-white/[0.06] text-slate-300"
                          }`}
                        >
                          <Car className="h-5 w-5" />
                        </div>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                            selectedRole === "driver"
                              ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                              : "text-slate-500"
                          }`}
                        >
                          Driver
                        </span>
                      </div>
                      <span className="mt-3 font-bold text-white text-base font-display">
                        EV Driver
                      </span>
                      <span className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Find verified nearby points, reserve slots in advance & prevent dead battery anxiety.
                      </span>
                    </label>

                    {/* Charger Host Card */}
                    <label
                      className={`relative flex cursor-pointer flex-col rounded-2xl border p-4 transition-all duration-150 ${
                        selectedRole === "host"
                          ? "border-cyan-400 bg-cyan-500/[0.08] shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="host"
                        checked={selectedRole === "host"}
                        onChange={() => setSelectedRole("host")}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            selectedRole === "host"
                              ? "bg-cyan-400 text-slate-950 font-bold"
                              : "bg-white/[0.06] text-slate-300"
                          }`}
                        >
                          <PlugZap className="h-5 w-5" />
                        </div>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                            selectedRole === "host"
                              ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30"
                              : "text-slate-500"
                          }`}
                        >
                          Host
                        </span>
                      </div>
                      <span className="mt-3 font-bold text-white text-base font-display">
                        Charger Host
                      </span>
                      <span className="text-xs text-slate-400 mt-1 leading-relaxed">
                        List idle home or shop chargers, define weekly hours & earn recurring income.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="e.g. Ramesh Kumar"
                      className="block w-full rounded-xl border border-white/[0.1] bg-slate-950/70 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-400 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Email address <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="driver@example.com"
                      className="block w-full rounded-xl border border-white/[0.1] bg-slate-950/70 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-400 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="phone" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Phone Number
                    </label>
                    <span className="text-[11px] text-slate-500">Optional</span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Phone className="h-4 w-4" />
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+91 98765 43210"
                      className="block w-full rounded-xl border border-white/[0.1] bg-slate-950/70 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-400 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                    />
                  </div>
                </div>

                {/* Password with Show/Hide toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Password <span className="text-emerald-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">Min. 6 chars</span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      minLength={6}
                      placeholder="••••••••••••"
                      className="block w-full rounded-xl border border-white/[0.1] bg-slate-950/70 pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-400 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-white transition-colors focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isPending}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-150 hover:brightness-105 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Switcher */}
              <div className="mt-8 pt-6 text-center border-t border-white/[0.08]">
                <p className="text-sm text-slate-400">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                  >
                    Sign in to your portal &rarr;
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/[0.06] bg-[#070A12]/80 px-4 py-5 text-center text-xs text-slate-500">
        <p>PlugNear &bull; Clean EV Mobility Infrastructure &bull; Protected by PostGIS and Atomic Exclusion Locking</p>
      </footer>
    </div>
  );
}
