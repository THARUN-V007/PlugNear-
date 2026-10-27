"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Loader2, Zap } from "lucide-react";
import { logInAction, type AuthActionState } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<AuthActionState | null, FormData>(
    logInAction,
    null
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25">
            <Zap className="h-7 w-7" strokeWidth={2.25} aria-hidden />
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Sign in to PlugNear
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Peer-to-peer EV charging made reliable and double-booking free.
          </p>
        </div>

        {state?.error && (
          <div
            role="alert"
            className="plugnear-rise flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" strokeWidth={2} aria-hidden />
            <div>
              <p className="font-bold">Sign in error</p>
              <p className="text-rose-700">{state.error}</p>
            </div>
          </div>
        )}

        <form action={formAction} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="user@example.com"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:-translate-y-px hover:shadow-emerald-600/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 text-center border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-emerald-600 hover:text-emerald-500 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
