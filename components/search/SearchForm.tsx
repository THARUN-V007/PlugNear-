"use client";

import { useState } from "react";
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
}: SearchFormProps) {
  const [geoLoading, setGeoLoading] = useState(false);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser. Please tap on the map to set a location.");
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
        let msg = "Could not retrieve your location. Tap on the map to position search.";
        if (err.code === 1) {
          msg = "Location permission denied. Tap anywhere on the map to choose your search point.";
        } else if (err.code === 2) {
          msg = "Location unavailable. Please tap on the map to set search center.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please tap on the map.";
        }
        alert(msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      {/* 1. Location Bar & Geolocation Trigger */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Search Location (Center Point)
          </label>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={geoLoading || isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <span>{geoLoading ? "⏳" : "🎯"}</span>
            <span>{geoLoading ? "Locating..." : "Use my location"}</span>
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-200">
          <span className="font-mono text-slate-800">
            📍 {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Tap map to reposition
          </span>
        </div>

        {geoError && (
          <p className="mt-1 text-xs text-amber-700 font-medium">{geoError}</p>
        )}
      </div>

      {/* 2. Date, Start Time & Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Date (IST)
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Start Time (IST)
          </label>
          <select
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Duration
          </label>
          <select
            value={durationMinutes}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Connector Type & Search Radius */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Connector Type
          </label>
          <select
            value={connectorType}
            onChange={(e) => onConnectorTypeChange(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          >
            <option value="">Any Connector (All types)</option>
            {ConnectorTypeEnum.options.map((conn) => (
              <option key={conn} value={conn}>
                {conn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Search Radius
          </label>
          <select
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          >
            <option value={2}>2 km (Immediate vicinity)</option>
            <option value={5}>5 km (Local neighborhood)</option>
            <option value={10}>10 km (Standard - Recommended)</option>
            <option value={25}>25 km (City-wide search)</option>
          </select>
        </div>
      </div>

      {/* Validation Error Feedback */}
      {validationError && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 font-medium">
          ⚠️ {validationError}
        </div>
      )}

      {/* 4. Explicit Search Button */}
      <button
        type="button"
        onClick={onSearch}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            <span>Searching available chargers...</span>
          </>
        ) : (
          <>
            <span>🔍</span>
            <span>Search Chargers</span>
          </>
        )}
      </button>
    </div>
  );
}
