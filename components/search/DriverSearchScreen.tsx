"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { GeoPoint } from "@/lib/rules";
import { validateSlot } from "@/lib/rules";
import type { SearchResultItem } from "@/lib/search/search-assembly";
import {
  DEFAULT_MAP_CENTER,
  getDefaultSearchDateTime,
  kolkataInputsToUtcSlot,
  getEmptyStateMessage,
} from "@/lib/search/search-helpers";
import SearchForm from "@/components/search/SearchForm";
import ChargerCard from "@/components/search/ChargerCard";
import SearchStateBanner from "@/components/search/SearchStateBanner";

// Dynamically import ChargerMap with SSR disabled to prevent window is not defined
const ChargerMap = dynamic(() => import("@/components/map/ChargerMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full min-h-[380px] lg:min-h-[520px] items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
      <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></span>
        <span>Loading map...</span>
      </div>
    </div>
  ),
});

export default function DriverSearchScreen() {
  const defaults = getDefaultSearchDateTime();

  const [location, setLocation] = useState<GeoPoint>(DEFAULT_MAP_CENTER);
  const [date, setDate] = useState<string>(defaults.date);
  const [startTime, setStartTime] = useState<string>(defaults.startTime);
  const [durationMinutes, setDurationMinutes] = useState<number>(defaults.durationMinutes);
  const [connectorType, setConnectorType] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(10);

  const [chargers, setChargers] = useState<SearchResultItem[]>([]);
  const [meta, setMeta] = useState<{ totalInRadius: number; availableCount: number } | null>(null);
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<{ title: string; hint?: string } | null>(null);

  // Counter to discard stale out-of-order responses
  const activeRequestId = useRef<number>(0);

  const executeSearch = useCallback(async () => {
    setValidationError(null);
    setSearchError(null);

    // 1. Client-side slot conversion and pre-validation using lib/rules
    let utcSlot: { startAt: string; endAt: string };
    try {
      utcSlot = kolkataInputsToUtcSlot({
        date,
        startTime,
        durationMinutes,
      });
    } catch (e: any) {
      setValidationError(e.message || "Invalid date or time components.");
      return;
    }

    const preValidation = validateSlot(utcSlot, new Date());
    if (!preValidation.success) {
      setValidationError(preValidation.error.message);
      return;
    }

    // 2. Prepare request with incrementing request ID
    const currentRequestId = ++activeRequestId.current;
    setIsLoading(true);

    try {
      const queryParams = new URLSearchParams({
        lat: location.latitude.toString(),
        lng: location.longitude.toString(),
        radius: radiusKm.toString(),
        start: utcSlot.startAt,
        end: utcSlot.endAt,
      });

      if (connectorType) {
        queryParams.set("connector", connectorType);
      }

      const res = await fetch(`/api/chargers/search?${queryParams.toString()}`);
      const json = await res.json();

      // Discard response if a newer search was initiated
      if (currentRequestId !== activeRequestId.current) {
        return;
      }

      setIsLoading(false);
      setHasSearched(true);

      if (!res.ok || !json.success) {
        const errorMsg = json.error?.message || "Search failed. Please try again.";
        setSearchError({
          title: "Search Error",
          hint: errorMsg,
        });
        setChargers([]);
        setMeta(null);
        return;
      }

      setChargers(json.data.chargers || []);
      setMeta(json.data.meta || { totalInRadius: 0, availableCount: 0 });

      // Automatically select nearest charger if available
      if (json.data.chargers && json.data.chargers.length > 0) {
        setSelectedChargerId(json.data.chargers[0].id);
      } else {
        setSelectedChargerId(null);
      }
    } catch (err: any) {
      if (currentRequestId !== activeRequestId.current) {
        return;
      }
      setIsLoading(false);
      setSearchError({
        title: "Network Connection Error",
        hint: "Could not reach the search service. Please check your network and try again.",
      });
    }
  }, [location, radiusKm, date, startTime, durationMinutes, connectorType]);

  // Initial automatic search on mount so the seed chargers appear immediately
  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  const emptyMsg = meta ? getEmptyStateMessage(meta, radiusKm) : null;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Find Idle EV Chargers
          </h1>
          <p className="text-xs text-slate-500">
            Select a location and time slot. Approximate pins protect residential host privacy.
          </p>
        </div>

        {hasSearched && meta && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700 font-semibold border border-slate-200">
            <span>⚡ {meta.availableCount} available</span>
            <span>&bull;</span>
            <span className="text-slate-500">{meta.totalInRadius} nearby</span>
          </div>
        )}
      </div>

      {/* Main Layout: Responsive Two-Column on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search Controls & Results List (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <SearchForm
            location={location}
            onLocationChange={(pt) => setLocation(pt)}
            date={date}
            onDateChange={setDate}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            durationMinutes={durationMinutes}
            onDurationChange={setDurationMinutes}
            connectorType={connectorType}
            onConnectorTypeChange={setConnectorType}
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            onSearch={executeSearch}
            isLoading={isLoading}
            validationError={validationError}
          />

          {/* Results List or State Banners */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isLoading
                  ? "Searching..."
                  : hasSearched
                  ? `Results (${chargers.length})`
                  : "Available Chargers"}
              </h2>
              {chargers.length > 0 && (
                <span className="text-[11px] text-slate-400">
                  Sorted nearest first
                </span>
              )}
            </div>

            {searchError ? (
              <SearchStateBanner
                type="error"
                title={searchError.title}
                hint={searchError.hint}
                onRetry={executeSearch}
              />
            ) : !hasSearched && !isLoading ? (
              <SearchStateBanner
                type="initial"
                title="Ready to search"
                hint="Set your location on the map and choose a time slot to see available chargers."
              />
            ) : hasSearched && chargers.length === 0 && emptyMsg ? (
              <SearchStateBanner
                type="empty"
                title={emptyMsg.title}
                hint={emptyMsg.hint}
              />
            ) : (
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {chargers.map((charger) => (
                  <ChargerCard
                    key={charger.id}
                    charger={charger}
                    isSelected={charger.id === selectedChargerId}
                    onSelect={(id) => setSelectedChargerId(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Leaflet Map (7 cols) */}
        <div className="lg:col-span-7 h-[420px] sm:h-[480px] lg:h-[calc(100vh-170px)] sticky lg:top-6">
          <ChargerMap
            center={location}
            radiusKm={radiusKm}
            chargers={chargers}
            selectedChargerId={selectedChargerId}
            onSelectCharger={(id) => setSelectedChargerId(id)}
            onLocationChange={(pos) => setLocation(pos)}
          />
        </div>
      </div>
    </div>
  );
}
