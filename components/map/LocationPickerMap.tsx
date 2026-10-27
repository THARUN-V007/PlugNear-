"use client";

import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/search/search-helpers";

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
}

// Custom Leaflet Pin Icon
function createPickerPinIcon() {
  return L.divIcon({
    className: "custom-location-pin",
    html: `
      <div style="position: relative; width: 36px; height: 36px; transform: translate(-50%, -100%);">
        <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; background: #00E5FF; transform: rotate(-45deg); border: 2.5px solid #0F1115; box-shadow: 0 0 15px rgba(0,229,255,0.5);">
          <span style="transform: rotate(45deg); color: #000; font-size: 16px; font-weight: bold;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
}

// Inner helper component to handle map clicks and recentering
function MapEventsHandler({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      onChange(lat, lng);
    },
  });

  useEffect(() => {
    if (latitude && longitude) {
      map.panTo([latitude, longitude], { animate: true });
    }
  }, [latitude, longitude, map]);

  return null;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onChange,
}: LocationPickerMapProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Fallback to default center if coordinates are invalid or zero
  const effectiveLat = latitude || DEFAULT_MAP_CENTER.latitude;
  const effectiveLng = longitude || DEFAULT_MAP_CENTER.longitude;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onChange(lat, lng);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setGeoError("Could not retrieve your location. Please pick a point on the map.");
        console.warn("Geolocation error:", err);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#2C303B] shadow-inner">
      {/* 1. Leaflet Map Container */}
      <div className="h-64 sm:h-72 w-full z-0">
        <MapContainer
          center={[effectiveLat, effectiveLng]}
          zoom={DEFAULT_MAP_ZOOM}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapEventsHandler
            latitude={effectiveLat}
            longitude={effectiveLng}
            onChange={onChange}
          />

          <Marker
            position={[effectiveLat, effectiveLng]}
            icon={createPickerPinIcon()}
            draggable={true}
            eventHandlers={{
              dragend(e) {
                const marker = e.target;
                const position = marker.getLatLng();
                onChange(
                  Number(position.lat.toFixed(6)),
                  Number(position.lng.toFixed(6))
                );
              },
            }}
          />
        </MapContainer>
      </div>

      {/* 2. Top-Right "Use My Location" Button */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          className="rounded-xl border border-[#2C303B] bg-[#181B22]/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-slate-200 shadow-md transition hover:bg-[#242933] focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50 flex items-center gap-1.5"
        >
          <span className="text-cyan-400" aria-hidden>&bull;</span>
          {isLocating ? "Finding..." : "Use my location"}
        </button>
        {geoError && (
          <span className="rounded-lg bg-rose-950/60 px-2 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-800 shadow-xs">
            {geoError}
          </span>
        )}
      </div>

      {/* 3. Bottom Coordinates Bar */}
      <div className="bg-[#181B22] border-t border-[#2C303B] px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <span className="font-semibold text-slate-300 flex items-center gap-1">
          Click the map or drag the pin to position the charger
        </span>
        <div className="font-mono text-[11px] bg-[#0F1115] border border-[#2C303B] rounded-lg px-2.5 py-1 text-slate-400">
          Lat: <span className="font-bold text-cyan-400">{effectiveLat.toFixed(5)}</span> | Lng:{" "}
          <span className="font-bold text-cyan-400">{effectiveLng.toFixed(5)}</span>
        </div>
      </div>
    </div>
  );
}
