"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { ConnectorTypeEnum } from "@/lib/validation/search";
import type { GeoPoint } from "@/lib/rules";

interface SearchFormProps {
  location: GeoPoint;
  onLocationChange: (point: GeoPoint) => void;
  date: string;
  onDateChange: (date: string) => void;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  durationMinutes: number;
  onDurationChange: (mins: number) => void;
  connectorType: string;
  onConnectorTypeChange: (type: string) => void;
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  onSearch: () => void;
  isLoading: boolean;
  validationError?: string | null;
  geoError?: string | null;
  onClearGeoError?: () => void;
  /** True when the controls changed after the last search produced results. */
  filtersAreStale?: boolean;
}

// Generate 30-minute intervals for 24 hours: 00:00 to 23:30
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, "0");
  TIME_OPTIONS.push(`${hh}:00`);
  TIME_OPTIONS.push(`${hh}:30`);
}

// Duration options from 30 mins to 8 hours (in 30-min steps)
const DURATION_OPTIONS = [
  { value: 30, label: "30 mins" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 150, label: "2.5 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
  { value: 300, label: "5 hours" },
  { value: 360, label: "6 hours" },
  { value: 480, label: "8 hours (Max)" },
];

export default function SearchForm({
  location,
  onLocationChange,
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  durationMinutes,
  onDurationChange,
  connectorType,
  onConnectorTypeChange,
  radiusKm,
  onRadiusChange,
  onSearch,
  isLoading,
  validationError,
  geoError,
  filtersAreStale,
}: SearchFormProps) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [localGeoError, setLocalGeoError] = useState<string | null>(null);

  const handleUseMyLocation = () => {
    setLocalGeoError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocalGeoError(
        "This browser cannot share a location. Tap the map to set the search point instead."
      );
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        onLocationChange({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      (err) => {
        setGeoLoading(false);
        let msg = "Could not retrieve your location. Tap on the map to set the search point.";
        if (err.code === 1) {
          msg = "Location permission denied. Tap anywhere on the map to choose your search point.";
        } else if (err.code === 2) {
          msg = "Location unavailable. Please tap on the map to set the search center.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please tap on the map.";
        }
        setLocalGeoError(msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="rounded-3xl border border-[#2C303B] bg-[#181B22] p-5 sm:p-6 shadow-md space-y-5">
      {/* 1. Location Bar & Geolocation Trigger */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-slate-300">
            Search Location (Center Point)
          </label>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={geoLoading || isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C303B] bg-[#242933] px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-[#2e3442] hover:text-white disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5">
              {geoLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
              ) : (
                <LocateFixed className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
              )}
              <span>{geoLoading ? "Locating..." : "Use my location"}</span>
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#0F1115] px-3.5 py-2 text-xs text-slate-300 border border-[#2C303B]">
          <span className="font-mono plugnear-tabular inline-flex items-center gap-1.5 text-slate-200">
            <MapPin className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} aria-hidden />
            {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Tap map to reposition
          </span>
        </div>

        {(geoError || localGeoError) && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-xl border border-amber-800 bg-amber-950/40 px-3 py-2 text-[11px] font-semibold text-amber-300" role="status">
            <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
            <span>{localGeoError ?? geoError}</span>
          </p>
        )}
      </div>

      {/* 2. Date, Start Time & Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="search-date" className="block text-xs font-bold text-slate-300 mb-1">
            Date (IST)
          </label>
          <input
            id="search-date"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-[#2C303B] bg-[#0F1115] px-3 py-2 text-xs font-semibold text-white transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="search-start-time" className="block text-xs font-bold text-slate-300 mb-1">
            Start Time (IST)
          </label>
          <select
            id="search-start-time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-[#2C303B] bg-[#0F1115] px-3 py-2 text-xs font-semibold text-white transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t} className="bg-[#181B22] text-white">
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search-duration" className="block text-xs font-bold text-slate-300 mb-1">
            Duration
          </label>
          <select
            id="search-duration"
            value={durationMinutes}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            disabled={isLoading}
            className="w-full rounded-xl border border-[#2C303B] bg-[#0F1115] px-3 py-2 text-xs font-semibold text-white transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value} className="bg-[#181B22] text-white">
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Connector Type & Search Radius */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="search-connector" className="block text-xs font-bold text-slate-300 mb-1">
            Connector Type
          </label>
          <select
            id="search-connector"
            value={connectorType}
            onChange={(e) => onConnectorTypeChange(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-[#2C303B] bg-[#0F1115] px-3 py-2 text-xs font-semibold text-white transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          >
            <option value="" className="bg-[#181B22] text-white">Any Connector (All types)</option>
            {ConnectorTypeEnum.options.map((conn) => (
              <option key={conn} value={conn} className="bg-[#181B22] text-white">
                {conn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search-radius" className="block text-xs font-bold text-slate-300 mb-1">
            Search Radius
          </label>
          <select
            id="search-radius"
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            disabled={isLoading}
            className="w-full rounded-xl border border-[#2C303B] bg-[#0F1115] px-3 py-2 text-xs font-semibold text-white transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          >
            <option value={2} className="bg-[#181B22] text-white">2 km (Immediate vicinity)</option>
            <option value={5} className="bg-[#181B22] text-white">5 km (Local neighborhood)</option>
            <option value={10} className="bg-[#181B22] text-white">10 km (Standard - Recommended)</option>
            <option value={25} className="bg-[#181B22] text-white">25 km (City-wide search)</option>
          </select>
        </div>
      </div>

      {/* Validation Error Feedback */}
      {validationError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-xs font-semibold text-rose-300 flex items-start gap-2"
        >
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-rose-400" strokeWidth={2} aria-hidden />
          <span>{validationError}</span>
        </div>
      )}

      {/* 4. Explicit Search Button */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onSearch}
          disabled={isLoading}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-sm font-black text-black bg-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-[#32e012] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-black" aria-hidden />
              <span>Searching available chargers...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" aria-hidden />
              <span>{filtersAreStale ? "Search again with these filters" : "Search Chargers"}</span>
            </>
          )}
        </button>

        {filtersAreStale && !isLoading && (
          <p className="text-center text-[11px] font-semibold text-amber-400" role="status">
            Filters changed since the last search - results below may be outdated.
          </p>
        )}
      </div>
    </div>
  );
}
