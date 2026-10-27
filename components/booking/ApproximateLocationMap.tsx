"use client";

import { useMemo } from "react";
import { MapPin, ShieldCheck } from "lucide-react";
import { MapContainer, TileLayer, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/rules";

interface ApproximateLocationMapProps {
  approximateLocation: GeoPoint;
  chargerTitle: string;
  /**
   * Exact position, provided only once the viewer is entitled to it (the host,
   * or a driver with a confirmed booking). Until then the masked pin is shown.
   */
  unlockedLocation?: GeoPoint | null;
  unlockedAddress?: string | null;
}

function createApproxPinIcon() {
  return L.divIcon({
    className: "approx-pin",
    html: `
      <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: #39FF14; border: 2.5px solid #0F1115; box-shadow: 0 0 15px rgba(57,255,20,0.4); color: #000; font-weight: bold; font-size: 16px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

export default function ApproximateLocationMap({
  approximateLocation,
  chargerTitle,
  unlockedLocation,
  unlockedAddress,
}: ApproximateLocationMapProps) {
  const pinIcon = useMemo(() => createApproxPinIcon(), []);
  const isUnlocked = Boolean(unlockedLocation);
  const point = unlockedLocation ?? approximateLocation;

  return (
    <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-[#2C303B] shadow-inner z-0">
      <MapContainer
        center={[point.latitude, point.longitude]}
        zoom={isUnlocked ? 16 : 14}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* A 300 m privacy ring while masked; a tight ring once the exact pin is earned. */}
        <Circle
          center={[point.latitude, point.longitude]}
          radius={isUnlocked ? 60 : 300}
          pathOptions={{
            color: isUnlocked ? "#39FF14" : "#00E5FF",
            fillColor: isUnlocked ? "#39FF14" : "#00E5FF",
            fillOpacity: isUnlocked ? 0.25 : 0.18,
            weight: 2,
            dashArray: isUnlocked ? undefined : "6, 6",
          }}
        />

        <Marker position={[point.latitude, point.longitude]} icon={pinIcon}>
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-bold text-slate-900">{chargerTitle}</p>
              <p className="text-slate-600">
                {isUnlocked
                  ? unlockedAddress ?? "Exact location unlocked by your confirmed booking."
                  : "Approximate area (~300m radius). Exact address shared after confirmation."}
              </p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Floating privacy badge overlay */}
      <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[400] rounded-xl bg-[#181B22]/90 backdrop-blur-md px-3 py-2 text-xs text-slate-200 shadow-lg border border-[#2C303B] flex items-center gap-2">
        <span aria-hidden>
          {isUnlocked ? (
            <MapPin className="h-4 w-4 text-primary" strokeWidth={2.5} />
          ) : (
            <ShieldCheck className="h-4 w-4 text-cyan-400" strokeWidth={2} />
          )}
        </span>
        <span className="font-medium text-[11px] sm:text-xs">
          {isUnlocked
            ? "Exact location unlocked - your booking on this charger is confirmed."
            : "Approximate area shown for host privacy. Exact address is unlocked once the host confirms."}
        </span>
      </div>
    </div>
  );
}
