"use client";

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
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
          🗺️
        </div>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        {hint && <p className="text-xs text-slate-500 max-w-sm mx-auto">{hint}</p>}
      </div>
    );
  }

  if (type === "empty") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl">
          🔍
        </div>
        <h4 className="text-sm font-bold text-amber-900">{title}</h4>
        {hint && <p className="text-xs text-amber-700 max-w-sm mx-auto">{hint}</p>}
      </div>
    );
  }

  // Error state
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-xl">
        ⚠️
      </div>
      <h4 className="text-sm font-bold text-red-900">{title}</h4>
      {hint && <p className="text-xs text-red-700 max-w-sm mx-auto">{hint}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 transition"
        >
          Try Search Again
        </button>
      )}
    </div>
  );
}
