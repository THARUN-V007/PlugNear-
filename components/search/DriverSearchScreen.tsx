"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, Loader2, MapPin, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import type { GeoPoint } from "@/lib/rules";
import { validateSlot, toKolkataLocalDetails } from "@/lib/rules";
import type { SearchResultItem } from "@/lib/search/search-assembly";
import type { EmergencySlotDetails } from "@/lib/search/emergency-slot";
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
    <div className="flex h-full w-full min-h-[380px] lg:min-h-[520px] items-center justify-center rounded-2xl bg-[#0F1115] border border-[#2C303B]">
      <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
        <span>Loading map...</span>
      </div>
    </div>
  ),
});

interface DriverSearchScreenProps {
  /**
   * Server render timestamp. The default slot is derived from it so the SSR
   * markup and the hydration pass compute the same 30-minute slot instead of
   * disagreeing when the page loads near a boundary.
   */
  initialNowIso: string;
}

export default function DriverSearchScreen({ initialNowIso }: DriverSearchScreenProps) {
  const defaults = useMemo(
    () => getDefaultSearchDateTime(new Date(initialNowIso)),
    [initialNowIso]
  );

  // Search filter state
  const [location, setLocation] = useState<GeoPoint>(DEFAULT_MAP_CENTER);
  const [date, setDate] = useState<string>(defaults.date);
  const [startTime, setStartTime] = useState<string>(defaults.startTime);
  const [durationMinutes, setDurationMinutes] = useState<number>(defaults.durationMinutes);
  const [connectorType, setConnectorType] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(10);

  // Search results state
  const [chargers, setChargers] = useState<SearchResultItem[]>([]);
  const [meta, setMeta] = useState<{ totalInRadius: number; availableCount: number } | null>(null);
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);
  const [fitBoundsPoints, setFitBoundsPoints] = useState<GeoPoint[] | undefined>(undefined);

  // Emergency Mode state
  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);
  const [isEmergencyLoading, setIsEmergencyLoading] = useState<boolean>(false);
  const [emergencySlot, setEmergencySlot] = useState<EmergencySlotDetails | null>(null);
  const [geoFallbackPrompt, setGeoFallbackPrompt] = useState<boolean>(false);
  const [geoErrorMessage, setGeoErrorMessage] = useState<string | null>(null);

  // Common UI states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<{ title: string; hint?: string } | null>(null);

  // Counter to discard stale out-of-order responses
  const activeRequestId = useRef<number>(0);
  // Signature of the filters the results were produced from, so edits after a
  // search can be flagged instead of firing a request per keystroke.
  const searchedSignature = useRef<string | null>(null);
  const startedInitialSearch = useRef(false);

  // The slot the list and map were last produced from. Cleared filters (an
  // emptied date input) must not reach kolkataInputsToUtcSlot during render.
  const currentSlot = useMemo(() => {
    if (isEmergencyMode && emergencySlot) {
      return { startAt: emergencySlot.startAt, endAt: emergencySlot.endAt };
    }
    try {
      return kolkataInputsToUtcSlot({ date, startTime, durationMinutes });
    } catch {
      return null;
    }
  }, [isEmergencyMode, emergencySlot, date, startTime, durationMinutes]);

  const filterSignature = useMemo(
    () =>
      [
        location.latitude.toFixed(6),
        location.longitude.toFixed(6),
        radiusKm,
        date,
        startTime,
        durationMinutes,
        connectorType,
      ].join("|"),
    [location, radiusKm, date, startTime, durationMinutes, connectorType]
  );

  const filtersAreStale = Boolean(
    hasSearched &&
      !isEmergencyMode &&
      searchedSignature.current &&
      searchedSignature.current !== filterSignature
  );

  // 1. Core Scheduled Search Execution
  const executeSearch = useCallback(async () => {
    setValidationError(null);
    setSearchError(null);
    setGeoFallbackPrompt(false);
    setIsEmergencyMode(false);
    setEmergencySlot(null);

    // Validate slot in Asia/Kolkata
    let slot: { startAt: string; endAt: string };
    try {
      slot = kolkataInputsToUtcSlot({ date, startTime, durationMinutes });
    } catch {
      setValidationError("Please enter a valid date and start time.");
      return;
    }

    const slotVal = validateSlot(
      { startAt: slot.startAt, endAt: slot.endAt },
      new Date()
    );
    if (!slotVal.success) {
      setValidationError(slotVal.error.message);
      return;
    }

    setIsLoading(true);
    const thisRequestId = ++activeRequestId.current;

    try {
      const params = new URLSearchParams({
        lat: location.latitude.toString(),
        lng: location.longitude.toString(),
        radiusKm: radiusKm.toString(),
        startAt: slot.startAt,
        endAt: slot.endAt,
      });

      if (connectorType) {
        params.set("connectorType", connectorType);
      }

      const res = await fetch(`/api/chargers/search?${params.toString()}`);
      const data = await res.json();

      // Discard stale out-of-order response
      if (thisRequestId !== activeRequestId.current) return;

      if (!res.ok || !data.success) {
        setSearchError({
          title: "Search failed",
          hint: data?.error?.message || "Could not retrieve available chargers. Please try again.",
        });
        setChargers([]);
        setMeta(null);
        return;
      }

      setChargers(data.data.chargers);
      setMeta(data.data.meta);
      setHasSearched(true);
      searchedSignature.current = filterSignature;

      // Select first charger if available
      if (data.data.chargers.length > 0) {
        setSelectedChargerId(data.data.chargers[0].id);
      } else {
        setSelectedChargerId(null);
      }
    } catch {
      if (thisRequestId !== activeRequestId.current) return;
      setSearchError({
        title: "Connection error",
        hint: "Could not connect to the search service. Please check your internet connection.",
      });
      setChargers([]);
      setMeta(null);
    } finally {
      if (thisRequestId === activeRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [date, startTime, durationMinutes, location, radiusKm, connectorType, filterSignature]);

  // 2. Emergency Mode Search Execution
  const executeEmergencySearch = useCallback(
    async (coords: GeoPoint) => {
      setIsEmergencyLoading(true);
      setSearchError(null);
      setValidationError(null);
      setGeoFallbackPrompt(false);

      const thisRequestId = ++activeRequestId.current;

      try {
        const params = new URLSearchParams({
          lat: coords.latitude.toString(),
          lng: coords.longitude.toString(),
        });

        if (connectorType) {
          params.set("connectorType", connectorType);
        }

        const res = await fetch(`/api/chargers/emergency?${params.toString()}`);
        const data = await res.json();

        if (thisRequestId !== activeRequestId.current) return;

        if (!res.ok || !data.success) {
          setSearchError({
            title: "Emergency search failed",
            hint: data?.error?.message || "Could not complete emergency search. Please try regular search.",
          });
          return;
        }

        setIsEmergencyMode(true);
        setEmergencySlot(data.data.slot);
        setChargers(data.data.chargers);
        setMeta(data.data.meta);
        setHasSearched(true);
        searchedSignature.current = null; // Stale check does not apply to emergency mode

        // If nearest charger found, select it and fit bounds
        if (data.data.nearestCharger) {
          const nearest = data.data.nearestCharger;
          setSelectedChargerId(nearest.id);
          setFitBoundsPoints([
            coords,
            {
              latitude: nearest.approximateLocation.latitude,
              longitude: nearest.approximateLocation.longitude,
            },
          ]);
        } else {
          setSelectedChargerId(null);
          setFitBoundsPoints(undefined);
        }
      } catch {
        if (thisRequestId !== activeRequestId.current) return;
        setSearchError({
          title: "Connection error",
          hint: "Could not reach the server for emergency search. Please check your internet connection.",
        });
      } finally {
        if (thisRequestId === activeRequestId.current) {
          setIsEmergencyLoading(false);
        }
      }
    },
    [connectorType]
  );

  // 3. Emergency Mode Handler
  const handleEmergencyClick = useCallback(() => {
    setGeoErrorMessage(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoFallbackPrompt(true);
      setGeoErrorMessage(
        "Geolocation is not supported by your browser. Tap anywhere on the map to set your location."
      );
      return;
    }

    setIsEmergencyLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: GeoPoint = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        };
        setLocation(coords);
        void executeEmergencySearch(coords);
      },
      (err) => {
        setIsEmergencyLoading(false);
        setGeoFallbackPrompt(true);
        let msg = "Could not detect your GPS location.";
        if (err.code === 1) {
          msg = "Location permission was denied. Tap anywhere on the map to set your location, then search.";
        } else if (err.code === 2) {
          msg = "GPS position unavailable. Tap anywhere on the map to set your location, then search.";
        } else if (err.code === 3) {
          msg = "GPS request timed out (10s). Tap anywhere on the map to set your location, then search.";
        }
        setGeoErrorMessage(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [executeEmergencySearch]);

  useEffect(() => {
    if (startedInitialSearch.current) return;
    startedInitialSearch.current = true;
    void executeSearch();
  }, []);

  const emptyMsg = meta ? getEmptyStateMessage(meta, isEmergencyMode ? 25 : radiusKm, isEmergencyMode) : null;

  return (
    <div className="space-y-6">
      {/* 1. Prominent Emergency Mode Hero Banner */}
      <div className="rounded-3xl border border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-[#181B22] to-[#181B22] p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-400/40">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
              Low Battery Assistance
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-display">
              Need a charge right now?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              1-click emergency search finds the nearest idle charging point within 25 km that is verified free right now.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              id="emergency-charge-btn"
              disabled={isEmergencyLoading || isLoading}
              onClick={handleEmergencyClick}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-black shadow-lg transition ${
                isEmergencyLoading
                  ? "bg-amber-400 cursor-not-allowed opacity-70"
                  : "bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] shadow-amber-500/25 cursor-pointer"
              }`}
            >
              {isEmergencyLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-black" aria-hidden />
                  <span>Finding nearest charger...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 fill-black" strokeWidth={2.5} aria-hidden />
                  <span>I need a charge now</span>
                </>
              )}
            </button>

            {isEmergencyMode && (
              <button
                type="button"
                onClick={executeSearch}
                className="rounded-2xl border border-[#2C303B] bg-[#242933] px-4 py-3 text-xs font-bold text-slate-200 hover:bg-[#2e3442] hover:text-white transition"
              >
                Reset to Standard Search
              </button>
            )}
          </div>
        </div>

        {/* Geolocation Fallback Prompt */}
        {geoFallbackPrompt && (
          <div className="mt-4 rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-0.5">
              <p className="font-bold inline-flex items-start gap-1.5"><MapPin className="mt-px h-4 w-4 shrink-0 text-amber-400" aria-hidden /> {geoErrorMessage}</p>
              <p className="text-amber-300/80">
                You can tap anywhere on the map to pin your location, then search from that exact point.
              </p>
            </div>
            <button
              type="button"
              id="emergency-fallback-search-btn"
              disabled={isEmergencyLoading}
              onClick={() => executeEmergencySearch(location)}
              className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black hover:bg-amber-400 transition shadow-md cursor-pointer"
            >
              Find nearest from this point &rarr;
            </button>
          </div>
        )}

        {/* Emergency Mode Status Info Bar */}
        {isEmergencyMode && emergencySlot && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/10 border border-primary/30 px-3.5 py-2 text-xs text-primary">
            <div className="flex items-center gap-2">
              <span className="font-bold inline-flex items-center gap-1.5"><Zap className="h-4 w-4" strokeWidth={2.25} aria-hidden /> Emergency slot active:</span>
              <span className="text-slate-200">
                {toKolkataLocalDetails(emergencySlot.startAt).timeString} –{" "}
                {toKolkataLocalDetails(emergencySlot.endAt).timeString} IST ({emergencySlot.durationMinutes} mins)
              </span>
            </div>
            <span className="text-[11px] font-bold text-primary bg-primary/20 px-2 py-0.5 rounded-md border border-primary/30">
              Server Time Verified
            </span>
          </div>
        )}
      </div>

      {/* 2. Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2C303B] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white font-display">
            {isEmergencyMode ? "Emergency Search Results" : "Find Idle EV Chargers"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isEmergencyMode
              ? "Showing nearest bookable chargers right now. Approximate pins protect host privacy."
              : "Select a location and time slot. Approximate pins protect residential host privacy."}
          </p>
        </div>

        {hasSearched && meta && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#181B22] px-3 py-1.5 text-xs text-slate-200 font-semibold border border-[#2C303B]">
            <span className="inline-flex items-center gap-1.5 text-primary"><Zap className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> {meta.availableCount} available</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-slate-400">{meta.totalInRadius} nearby</span>
          </div>
        )}
      </div>

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search Controls & Results List */}
        <div className="lg:col-span-5 space-y-5">
          {/* Scheduled Search Form */}
          <SearchForm
            location={location}
            onLocationChange={(pt) => {
              setLocation(pt);
              setFitBoundsPoints(undefined);
            }}
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
            geoError={geoErrorMessage}
            filtersAreStale={filtersAreStale}
          />

          {/* Results List or State Banners */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                {isLoading
                  ? isEmergencyLoading
                    ? "Locating nearest charger..."
                    : "Searching..."
                  : hasSearched
                  ? `Results (${chargers.length})`
                  : "Available Chargers"}
              </h2>
              {chargers.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  Sorted nearest first
                </span>
              )}
            </div>

            {isLoading ? (
              <ResultsSkeleton count={3} />
            ) : searchError ? (
              <SearchStateBanner
                type="error"
                title={searchError.title}
                hint={searchError.hint}
                onRetry={isEmergencyMode ? () => executeEmergencySearch(location) : executeSearch}
              />
            ) : !hasSearched && !isLoading ? (
              <SearchStateBanner
                type="initial"
                title="Ready to search"
                hint="Set your location on the map and choose a time slot to see available chargers."
              />
            ) : currentSlot === null ? (
              <SearchStateBanner
                type="error"
                title="Check the date and time"
                hint="A complete date and a start time are both needed before PlugNear can look for a free slot."
              />
            ) : hasSearched && chargers.length === 0 && emptyMsg ? (
              <SearchStateBanner
                type="empty"
                title={emptyMsg.title}
                hint={emptyMsg.hint}
              />
            ) : (
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {chargers.map((charger, index) => {
                  const isNearest = index === 0 && isEmergencyMode;

                  return (
                    <div
                      key={charger.id}
                      className="space-y-3"
                    >
                      {index === 1 && isEmergencyMode && (
                        <div className="pt-2 border-t border-[#2C303B]">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Other Available Options
                          </p>
                        </div>
                      )}
                      <ChargerCard
                        charger={charger}
                        isSelected={charger.id === selectedChargerId}
                        onSelect={(id) => setSelectedChargerId(id)}
                        isEmergencyHighlight={isNearest}
                        slot={currentSlot}
                        isEmergency={isEmergencyMode}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Leaflet Map */}
        <div className="lg:col-span-7 h-[420px] sm:h-[480px] lg:h-[calc(100vh-170px)] sticky lg:top-6">
          <ChargerMap
            center={location}
            radiusKm={isEmergencyMode ? 25 : radiusKm}
            chargers={chargers}
            selectedChargerId={selectedChargerId}
            onSelectCharger={(id) => setSelectedChargerId(id)}
            onLocationChange={(pos) => {
              setLocation(pos);
              setFitBoundsPoints(undefined);
            }}
            fitBoundsPoints={fitBoundsPoints}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder cards shown while a search is in flight
 */
function ResultsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Searching for chargers">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-[#2C303B] bg-[#181B22] p-4 animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded-full bg-[#242933]" />
              <div className="h-2.5 w-1/3 rounded-full bg-[#242933]" />
            </div>
            <div className="h-8 w-16 rounded-xl bg-[#242933]" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="h-8 rounded-lg bg-[#242933]" />
            <div className="h-8 rounded-lg bg-[#242933]" />
            <div className="h-8 rounded-lg bg-[#242933]" />
          </div>
          <div className="mt-4 h-10 rounded-xl bg-[#242933]" />
        </div>
      ))}
    </div>
  );
}
