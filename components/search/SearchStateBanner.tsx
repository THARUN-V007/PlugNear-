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
      <div className="plugnear-rise rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Map className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        {hint && <p className="text-xs text-slate-500 max-w-sm mx-auto">{hint}</p>}
      </div>
    );
  }

  if (type === "empty") {
    return (
      <div className="plugnear-rise rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <SearchX className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>
        <h4 className="text-sm font-bold text-amber-900">{title}</h4>
        {hint && <p className="text-xs text-amber-700 max-w-sm mx-auto">{hint}</p>}
      </div>
    );
  }

  // Error state
  return (
    <div
      role="alert"
      className="plugnear-rise rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3"
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h4 className="text-sm font-bold text-rose-900">{title}</h4>
      {hint && <p className="text-xs text-rose-700 max-w-sm mx-auto">{hint}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-rose-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 active:translate-y-0"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Try Search Again
        </button>
      )}
    </div>
  );
}
