"use client";

import { AlertTriangle, Map, RotateCcw, SearchX } from "lucide-react";

interface SearchStateBannerProps {
  type: "initial" | "empty" | "error";
  title: string;
  hint?: string;
  onRetry?: () => void;
}

export default function SearchStateBanner({
  type,
  title,
  hint,
  onRetry,
}: SearchStateBannerProps) {
  if (type === "initial") {
    return (
      <div className="rounded-2xl border border-dashed border-[#2C303B] bg-[#181B22] p-8 text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
          <Map className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
        <h4 className="text-sm font-bold text-white">{title}</h4>
        {hint && <p className="text-xs text-slate-400 max-w-sm mx-auto">{hint}</p>}
      </div>
    );
  }

  if (type === "empty") {
    return (
      <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-6 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-900/60 text-amber-400 border border-amber-800">
          <SearchX className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>
        <h4 className="text-sm font-bold text-amber-200">{title}</h4>
        {hint && <p className="text-xs text-amber-300 max-w-sm mx-auto">{hint}</p>}
      </div>
    );
  }

  // Error state
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-800 bg-rose-950/40 p-6 text-center space-y-3"
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-900/60 text-rose-400 border border-rose-800">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h4 className="text-sm font-bold text-rose-200">{title}</h4>
      {hint && <p className="text-xs text-rose-300 max-w-sm mx-auto">{hint}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-rose-700"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Try Search Again
        </button>
      )}
    </div>
  );
}
