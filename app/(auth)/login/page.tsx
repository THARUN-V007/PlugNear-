"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Zap,
  Loader2,
} from "lucide-react";
import { logInAction, type AuthActionState } from "@/app/actions/auth";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState<AuthActionState | null, FormData>(
    logInAction,
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
              href="/signup"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:text-white transition-colors"
            >
              Create Account
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
                Secure Portal Authentication
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl font-display leading-[1.12]">
                Welcome back to your EV Network.
              </h1>
              <p className="text-base leading-relaxed text-slate-400">
                Sign in to manage your charging reservations, track active sessions, or configure charger availability windows.
              </p>
            </div>

            {/* Quick Metrics Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5 backdrop-blur-md shadow-xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-xs">
                <span className="flex items-center gap-2 font-mono font-medium text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  AUTHENTICATION PROTOCOL
                </span>
                <span className="font-mono text-emerald-400 font-semibold">JWT + RLS PROTECTED</span>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-3 text-xs text-emerald-200">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  Role-based redirect sends EV Drivers straight to the proximity map and Charger Hosts to their availability dashboard.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Precision Sign-In Terminal */}
          <div className="lg:col-span-7">
            <div className="relative mx-auto max-w-lg rounded-3xl border border-white/[0.1] bg-[#0C1220]/90 p-6 sm:p-9 shadow-2xl backdrop-blur-xl">
              {/* Top Accent Line */}
              <div
                aria-hidden
                className="absolute -top-px left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent"
              />

              <div className="mb-6">
                <span className="inline-block text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                  Secure Access
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
                  Sign in to PlugNear
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Enter your credentials to access your vehicle or host dashboard.
                </p>
              </div>

              {state?.error && (
                <div
                  role="alert"
                  className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-200"
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                  <div>
                    <p className="font-bold text-rose-300">Sign in error</p>
                    <p className="mt-0.5 text-xs text-rose-200/90">{state.error}</p>
                  </div>
                </div>
              )}

              <form action={formAction} className="space-y-5">
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
                      placeholder="driver@example.com"
                      className="block w-full rounded-xl border border-white/[0.1] bg-slate-950/70 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-400 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                {/* Password with Show/Hide toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Password <span className="text-emerald-400">*</span>
                    </label>
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
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      className="block w-full rounded-xl border border-white/[0.1] bg-slate-950/70 pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-400 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
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
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Switcher */}
              <div className="mt-8 pt-6 text-center border-t border-white/[0.08]">
                <p className="text-sm text-slate-400">
                  Don&apos;t have an account yet?{" "}
                  <Link
                    href="/signup"
                    className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                  >
                    Register as Driver or Host &rarr;
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
