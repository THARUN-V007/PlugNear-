"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/rules";

interface ApproximateLocationMapProps {
  approximateLocation: GeoPoint;
  chargerTitle: string;
}

function createApproxPinIcon() {
  return L.divIcon({
    className: "approx-pin",
    html: `
      <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: #059669; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.25); color: white; font-weight: bold; font-size: 16px;">
        ⚡
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
}: ApproximateLocationMapProps) {
  const pinIcon = useMemo(() => createApproxPinIcon(), []);

  return (
    <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner z-0">
      <MapContainer
        center={[approximateLocation.latitude, approximateLocation.longitude]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 300-meter approximate privacy radius circle */}
        <Circle
          center={[approximateLocation.latitude, approximateLocation.longitude]}
          radius={300}
          pathOptions={{
            color: "#059669",
            fillColor: "#10b981",
            fillOpacity: 0.15,
            weight: 2,
            dashArray: "6, 6",
          }}
        />

        <Marker
          position={[approximateLocation.latitude, approximateLocation.longitude]}
          icon={pinIcon}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-bold text-slate-900">{chargerTitle}</p>
              <p className="text-slate-500">
                Approximate area (~300m radius). Exact address shared after confirmation.
              </p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Floating privacy badge overlay */}
      <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[400] rounded-xl bg-white/95 backdrop-blur px-3 py-2 text-xs text-slate-700 shadow-md border border-slate-200 flex items-center gap-2">
        <span className="text-base">🛡️</span>
        <span className="font-medium text-[11px] sm:text-xs">
          Approximate area shown for host privacy. Exact address is unlocked once host confirms.
        </span>
      </div>
    </div>
  );
}
