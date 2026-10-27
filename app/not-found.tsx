import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-6 text-center text-white">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(57,255,20,0.15),transparent_60%)]"
      />
      <div className="relative z-10 flex flex-col items-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-black shadow-xl shadow-primary/30 mb-6">
          <Zap className="h-8 w-8 fill-black" strokeWidth={2.5} aria-hidden />
        </div>
        <span className="text-xs font-black tracking-widest text-primary uppercase">
          404 Error
        </span>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl font-display">
          Page not found
        </h1>
        <p className="mt-4 text-sm text-slate-400">
          Sorry, we couldn&apos;t find the charging point or page you&apos;re looking for.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-black shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-[#32e012]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
