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

  const filtersAreStale =
    !isEmergencyMode &&
    searchedSignature.current !== null &&
    searchedSignature.current !== filterSignature;

  // 1. Standard Scheduled Search
  const executeSearch = useCallback(async () => {
    setValidationError(null);
    setSearchError(null);
    setIsEmergencyMode(false);
    setGeoFallbackPrompt(false);
    setGeoErrorMessage(null);
    setFitBoundsPoints(undefined);

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

    const currentRequestId = ++activeRequestId.current;
    searchedSignature.current = filterSignature;
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

      if (json.data.chargers && json.data.chargers.length > 0) {
        setSelectedChargerId(json.data.chargers[0].id);
      } else {
        setSelectedChargerId(null);
      }
    } catch {
      if (currentRequestId !== activeRequestId.current) {
        return;
      }
      setIsLoading(false);
      setSearchError({
        title: "Network Connection Error",
        hint: "Could not reach the search service. Please check your network and try again.",
      });
    }
  }, [location, radiusKm, date, startTime, durationMinutes, connectorType, filterSignature]);

  // 2. Emergency Mode Execution (Calls GET /api/chargers/emergency)
  const executeEmergencySearch = useCallback(
    async (targetLocation: GeoPoint) => {
      setSearchError(null);
      setValidationError(null);
      setGeoFallbackPrompt(false);
      setGeoErrorMessage(null);

      const currentRequestId = ++activeRequestId.current;
      searchedSignature.current = null;
      setIsEmergencyLoading(true);
      setIsLoading(true);

      try {
        const queryParams = new URLSearchParams({
          lat: targetLocation.latitude.toString(),
          lng: targetLocation.longitude.toString(),
          radius: "25", // Default emergency radius
        });

        const res = await fetch(`/api/chargers/emergency?${queryParams.toString()}`);
        const json = await res.json();

        if (currentRequestId !== activeRequestId.current) {
          return;
        }

        setIsEmergencyLoading(false);
        setIsLoading(false);
        setHasSearched(true);
        setIsEmergencyMode(true);

        if (!res.ok || !json.success) {
          const errorMsg = json.error?.message || "Emergency search failed. Please try again.";
          setSearchError({
            title: "Emergency Search Error",
            hint: errorMsg,
          });
          setChargers([]);
          setMeta(null);
          setEmergencySlot(null);
          return;
        }

        const candidateChargers: SearchResultItem[] = json.data.chargers || [];
        setChargers(candidateChargers);
        setMeta(json.data.meta || { totalInRadius: 0, availableCount: 0 });
        setEmergencySlot(json.data.slot || null);

        if (candidateChargers.length > 0) {
          const nearest = candidateChargers[0];
          setSelectedChargerId(nearest.id);
          // Automatically fit map bounds to the driver location and the nearest charger
          setFitBoundsPoints([
            targetLocation,
            nearest.approximateLocation,
          ]);
        } else {
          setSelectedChargerId(null);
          setFitBoundsPoints(undefined);
        }
      } catch {
        if (currentRequestId !== activeRequestId.current) {
          return;
        }
        setIsEmergencyLoading(false);
        setIsLoading(false);
        setSearchError({
          title: "Network Connection Error",
          hint: "Could not reach the emergency charging service. Please check your network connection and retry.",
        });
      }
    },
    []
  );

  // 3. Geolocation Trigger for Emergency Button
  const handleEmergencyClick = useCallback(() => {
    setGeoErrorMessage(null);
    setGeoFallbackPrompt(false);

    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoFallbackPrompt(true);
      setGeoErrorMessage("Geolocation is not supported by your browser. Please tap your location on the map below.");
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
        executeEmergencySearch(coords);
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

  // Run exactly one search on mount. After that, filter edits wait for an
  // explicit Search press: re-firing on every keystroke or map tap hammered the
  // API and made the Search button meaningless.
  useEffect(() => {
    if (startedInitialSearch.current) return;
    startedInitialSearch.current = true;
    void executeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emptyMsg = meta ? getEmptyStateMessage(meta, isEmergencyMode ? 25 : radiusKm, isEmergencyMode) : null;

  return (
    <div className="space-y-6">
      {/* 1. Prominent Emergency Mode Hero Banner */}
      <div className="rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-900 border border-amber-400/40">
              <span className="h-2 w-2 rounded-full bg-amber-600 animate-ping"></span>
              Low Battery Assistance
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Need a charge right now?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
              1-click emergency search finds the nearest idle charging point within 25 km that is verified free right now.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              id="emergency-charge-btn"
              disabled={isEmergencyLoading || isLoading}
              onClick={handleEmergencyClick}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white shadow-md transition ${
                isEmergencyLoading
                  ? "bg-amber-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-600 hover:from-amber-700 hover:to-emerald-700 active:scale-[0.98] shadow-amber-500/25 cursor-pointer"
              }`}
            >
              {isEmergencyLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>Finding nearest charger...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  <span>I need a charge now</span>
                </>
              )}
            </button>

            {isEmergencyMode && (
              <button
                type="button"
                onClick={executeSearch}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Reset to Standard Search
              </button>
            )}
          </div>
        </div>

        {/* Geolocation Fallback Prompt */}
        {geoFallbackPrompt && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-0.5">
              <p className="font-bold inline-flex items-start gap-1.5"><MapPin className="mt-px h-4 w-4 shrink-0" aria-hidden /> {geoErrorMessage}</p>
              <p className="text-amber-800">
                You can tap anywhere on the map to pin your location, then search from that exact point.
              </p>
            </div>
            <button
              type="button"
              id="emergency-fallback-search-btn"
              disabled={isEmergencyLoading}
              onClick={() => executeEmergencySearch(location)}
              className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition shadow-xs cursor-pointer"
            >
              Find nearest from this point &rarr;
            </button>
          </div>
        )}

        {/* Emergency Mode Status Info Bar */}
        {isEmergencyMode && emergencySlot && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span className="font-bold inline-flex items-center gap-1.5"><Zap className="h-4 w-4" strokeWidth={2.25} aria-hidden /> Emergency slot active:</span>
              <span>
                {toKolkataLocalDetails(emergencySlot.startAt).timeString} –{" "}
                {toKolkataLocalDetails(emergencySlot.endAt).timeString} IST ({emergencySlot.durationMinutes} mins)
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
              Server Time Verified
            </span>
          </div>
        )}
      </div>

      {/* 2. Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {isEmergencyMode ? "Emergency Search Results" : "Find Idle EV Chargers"}
          </h1>
          <p className="text-xs text-slate-500">
            {isEmergencyMode
              ? "Showing nearest bookable chargers right now. Approximate pins protect host privacy."
              : "Select a location and time slot. Approximate pins protect residential host privacy."}
          </p>
        </div>

        {hasSearched && meta && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700 font-semibold border border-slate-200">
            <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> {meta.availableCount} available</span>
            <span>&bull;</span>
            <span className="text-slate-500">{meta.totalInRadius} nearby</span>
          </div>
        )}
      </div>

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search Controls & Results List */}
        <div className="lg:col-span-5 space-y-5">
          {/* Scheduled Search Form (accessible when not in emergency mode or collapsible) */}
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isLoading
                  ? isEmergencyLoading
                    ? "Locating nearest charger..."
                    : "Searching..."
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
                      className="space-y-3 plugnear-rise"
                      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                    >
                      {index === 1 && isEmergencyMode && (
                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
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
 * Placeholder cards shown while a search is in flight, so the results column
 * keeps its shape instead of collapsing and re-expanding.
 */
function ResultsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Searching for chargers">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="plugnear-shimmer rounded-2xl border border-slate-200 bg-white p-4"
          style={{ animationDelay: `${index * 120}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded-full bg-slate-200" />
              <div className="h-2.5 w-1/3 rounded-full bg-slate-100" />
            </div>
            <div className="h-8 w-16 rounded-xl bg-slate-100" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="h-8 rounded-lg bg-slate-100" />
            <div className="h-8 rounded-lg bg-slate-100" />
            <div className="h-8 rounded-lg bg-slate-100" />
          </div>
          <div className="mt-4 h-10 rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
