"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionState } from "@/app/actions/auth";

export default function SignUpPage() {
  const [selectedRole, setSelectedRole] = useState<"driver" | "host">("driver");
  const [state, formAction, isPending] = useActionState<AuthActionState | null, FormData>(
    signUpAction,
    null
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white font-extrabold text-2xl shadow-md">
            ⚡
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Join PlugNear
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Choose your account role. Role selection is permanent for security.
          </p>
        </div>

        {state?.error && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700">
            <p className="font-semibold">Registration failed:</p>
            <p>{state.error}</p>
          </div>
        )}

        {state?.success && (
          <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800">
            <p className="font-semibold">Registration successful!</p>
            <p>{state.success}</p>
            <div className="mt-3">
              <Link
                href="/login"
                className="font-semibold underline hover:text-emerald-900"
              >
                Proceed to Sign In &rarr;
              </Link>
            </div>
          </div>
        )}

        <form action={formAction} className="mt-6 space-y-5">
          {/* Role Selection Cards */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Select Your Role <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label
                className={`relative flex cursor-pointer flex-col rounded-xl border p-4 shadow-sm transition focus:outline-none ${
                  selectedRole === "driver"
                    ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600"
                    : "border-slate-300 bg-white hover:border-slate-400"
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
                <span className="text-xl">🚗</span>
                <span className="mt-2 font-bold text-slate-900">EV Driver</span>
                <span className="text-xs text-slate-600 mt-1">
                  Search nearby chargers, request slots & avoid dead batteries.
                </span>
              </label>

              <label
                className={`relative flex cursor-pointer flex-col rounded-xl border p-4 shadow-sm transition focus:outline-none ${
                  selectedRole === "host"
                    ? "border-purple-600 bg-purple-50/50 ring-2 ring-purple-600"
                    : "border-slate-300 bg-white hover:border-slate-400"
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
                <span className="text-xl">🔌</span>
                <span className="mt-2 font-bold text-slate-900">Charger Host</span>
                <span className="text-xs text-slate-600 mt-1">
                  List idle chargers, configure availability & earn money.
                </span>
              </label>
            </div>
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700"
            >
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="user@example.com"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-slate-700"
            >
              Phone Number <span className="text-slate-400">(Optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+91 98765 43210"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="At least 6 characters"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isPending ? "Creating account..." : "Complete Sign Up"}
          </button>
        </form>

        <div className="pt-4 text-center border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-600 hover:text-emerald-500 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
