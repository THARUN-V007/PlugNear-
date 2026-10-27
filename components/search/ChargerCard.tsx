"use client";

import Link from "next/link";
import { ArrowRight, Check, MapPin, PlugZap, ShieldHalf, Zap } from "lucide-react";
import type { SearchResultItem } from "@/lib/search/search-assembly";
import { formatDistance, formatPrice } from "@/lib/search/search-helpers";

interface ChargerCardProps {
  charger: SearchResultItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isEmergencyHighlight?: boolean;
  slot?: { startAt: string; endAt: string } | null;
  isEmergency?: boolean;
}

export default function ChargerCard({
  charger,
  isSelected,
  onSelect,
  isEmergencyHighlight = false,
  slot,
  isEmergency = false,
}: ChargerCardProps) {
  const queryParams = new URLSearchParams();
  if (slot?.startAt) queryParams.set("startAt", slot.startAt);
  if (slot?.endAt) queryParams.set("endAt", slot.endAt);
  if (isEmergency) queryParams.set("isEmergency", "true");

  const detailsUrl = `/driver/chargers/${charger.id}?${queryParams.toString()}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelect(charger.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(charger.id);
        }
      }}
      className={`group cursor-pointer rounded-2xl border p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover active:translate-y-0 ${
        isEmergencyHighlight
          ? "border-amber-500 bg-gradient-to-br from-amber-50/60 via-white to-emerald-50/30 ring-2 ring-amber-400 shadow-glow-amber"
          : isSelected
          ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500 shadow-glow"
          : "border-slate-200 bg-white hover:border-emerald-300"
      }`}
    >
      {isEmergencyHighlight && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-extrabold text-amber-900">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            <Zap className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> NEAREST FREE CHARGER RIGHT NOW
          </span>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
            Emergency Pick
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
              <PlugZap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {charger.connectorType}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              <Zap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {charger.powerKw} kW
            </span>
          </div>

          <h3 className="mt-2 text-base font-bold text-slate-900 transition-colors group-hover:text-emerald-700 line-clamp-1">
            {charger.title}
          </h3>

          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="plugnear-tabular inline-flex items-center gap-1 font-semibold">
              <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} aria-hidden />
              {formatDistance(charger.distanceKm)}
            </span>
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldHalf className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Approx. location
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="plugnear-tabular text-sm font-bold text-slate-900">
            {formatPrice(charger.pricePerHour)}
          </p>
          <div className="mt-1 rounded-lg bg-emerald-50 px-2 py-0.5 border border-emerald-200/60 inline-block">
            <span className="plugnear-tabular text-xs font-extrabold text-emerald-700">
              Est: ₹{charger.estimatedCost.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Booking trigger: Enabled and passing slot */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-100">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          </span>
          Free for your slot
        </span>

        <Link
          href={detailsUrl}
          onClick={(e) => e.stopPropagation()}
          className="group/cta relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-emerald-700 hover:shadow-emerald-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 active:translate-y-0"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-500 group-hover/cta:translate-x-full"
          />
          View &amp; book
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
