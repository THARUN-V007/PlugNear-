"use client";

import { useActionState } from "react";
import Link from "next/link";
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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white font-extrabold text-2xl shadow-md">
            ⚡
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Sign in to PlugNear
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Peer-to-peer EV charging made reliable and double-booking free.
          </p>
        </div>

        {state?.error && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700">
            <p className="font-semibold">Sign in error:</p>
            <p>{state.error}</p>
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
            className="flex w-full justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign in"}
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
