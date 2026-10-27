"use client";

import type { SearchResultItem } from "@/lib/search/search-assembly";
import { formatDistance, formatPrice } from "@/lib/search/search-helpers";

interface ChargerCardProps {
  charger: SearchResultItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isEmergencyHighlight?: boolean;
}

export default function ChargerCard({
  charger,
  isSelected,
  onSelect,
  isEmergencyHighlight = false,
}: ChargerCardProps) {
  return (
    <div
      onClick={() => onSelect(charger.id)}
      className={`group cursor-pointer rounded-2xl border p-4.5 transition shadow-xs hover:shadow-md ${
        isEmergencyHighlight
          ? "border-amber-500 bg-gradient-to-br from-amber-50/40 via-white to-emerald-50/30 ring-2 ring-amber-400 shadow-md"
          : isSelected
          ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {isEmergencyHighlight && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-extrabold text-amber-900">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            ⚡ NEAREST FREE CHARGER RIGHT NOW
          </span>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
            Emergency Pick
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
              🔌 {charger.connectorType}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              ⚡ {charger.powerKw} kW
            </span>
          </div>

          <h3 className="mt-2 text-base font-bold text-slate-900 group-hover:text-emerald-700 transition line-clamp-1">
            {charger.title}
          </h3>

          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span>📍 {formatDistance(charger.distanceKm)}</span>
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
              Approx. location
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900">
            {formatPrice(charger.pricePerHour)}
          </p>
          <div className="mt-1 rounded-lg bg-emerald-50 px-2 py-0.5 border border-emerald-200/60 inline-block">
            <span className="text-xs font-extrabold text-emerald-700">
              Est: ₹{charger.estimatedCost.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Disabled booking trigger with Phase label */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400 font-medium">
          Step 5: Booking flow
        </span>

        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Booking flow arrives in Step 5"
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed border border-slate-200"
        >
          View details & book &rarr;
        </button>
      </div>
    </div>
  );
}
