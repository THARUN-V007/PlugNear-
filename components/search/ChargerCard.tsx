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
      className={`group cursor-pointer rounded-2xl border p-4.5 shadow-md transition-all duration-200 active:translate-y-0 ${
        isEmergencyHighlight
          ? "border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
          : isSelected
          ? "border-primary bg-[#181B22] ring-1 ring-primary/40 shadow-[0_0_20px_rgba(57,255,20,0.15)]"
          : "border-[#2C303B] bg-[#181B22] hover:border-slate-500"
      }`}
    >
      {isEmergencyHighlight && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-black text-amber-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
            <Zap className="h-3.5 w-3.5 text-amber-400" strokeWidth={2.5} aria-hidden /> NEAREST FREE CHARGER RIGHT NOW
          </span>
          <span className="text-[11px] font-bold text-amber-200 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800">
            Emergency Pick
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C303B] bg-[#242933] px-2.5 py-1 text-[11px] font-bold text-slate-300">
              <PlugZap className="h-3.5 w-3.5 text-cyan-400" strokeWidth={2} aria-hidden />
              {charger.connectorType}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
              <Zap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {charger.powerKw} kW
            </span>
          </div>

          <h3 className="mt-2 text-base font-black text-white transition-colors group-hover:text-primary line-clamp-1 font-display">
            {charger.title}
          </h3>

          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
            <span className="plugnear-tabular inline-flex items-center gap-1 font-semibold text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" strokeWidth={2} aria-hidden />
              {formatDistance(charger.distanceKm)}
            </span>
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <ShieldHalf className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} aria-hidden />
              Approx. location
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="plugnear-tabular text-sm font-bold text-slate-200">
            {formatPrice(charger.pricePerHour)}
          </p>
          <div className="mt-1 rounded-lg bg-primary/10 px-2.5 py-1 border border-primary/30 inline-block">
            <span className="plugnear-tabular text-xs font-black text-primary">
              Est: ₹{charger.estimatedCost.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Booking trigger: Enabled and passing slot */}
      <div className="mt-4 pt-3 border-t border-[#2C303B] flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-primary/20">
            <Check className="h-3 w-3 text-primary" strokeWidth={3} aria-hidden />
          </span>
          Free for your slot
        </span>

        <Link
          href={detailsUrl}
          onClick={(e) => e.stopPropagation()}
          className="relative inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-black text-black shadow-md shadow-primary/20 transition-all hover:bg-[#32e012] focus:outline-none"
        >
          View &amp; book
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
