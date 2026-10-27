import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center text-white">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.2),transparent_60%)]"
      />
      <div className="relative z-10 flex flex-col items-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-xl shadow-emerald-500/25 mb-6">
          <Zap className="h-8 w-8" strokeWidth={2.5} aria-hidden />
        </div>
        <span className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
          404 Error
        </span>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Page not found
        </h1>
        <p className="mt-4 text-base text-slate-400">
          Sorry, we couldn&apos;t find the charging point or page you&apos;re looking for.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:-translate-y-px hover:bg-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
