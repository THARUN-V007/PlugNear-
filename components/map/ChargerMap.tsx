"use client";

import { Fragment, useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/rules";
import type { SearchResultItem } from "@/lib/search/search-assembly";

interface ChargerMapProps {
  center: GeoPoint;
  radiusKm: number;
  chargers: SearchResultItem[];
  selectedChargerId: string | null;
  onSelectCharger: (id: string) => void;
  onLocationChange: (pos: GeoPoint) => void;
  fitBoundsPoints?: GeoPoint[];
}

// 1. Custom SVG DivIcons to eliminate broken PNG bundling issues
function createSearchPointIcon() {
  return L.divIcon({
    className: "custom-search-pin",
    html: `
      <div style="position: relative; width: 24px; height: 24px;">
        <span style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; opacity: 0.35; animation: pn-pulse-ring 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <span style="position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #2563eb; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createChargerIcon(isSelected: boolean) {
  const bg = isSelected ? "#047857" : "#059669";
  const scale = isSelected ? "scale(1.18)" : "scale(1)";
  const glow = isSelected ? "0 0 0 6px rgba(16,185,129,0.28), " : "";

  return L.divIcon({
    className: `custom-charger-pin${isSelected ? " is-selected" : ""}`,
    html: `
      <div style="transform: ${scale}; transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: ${bg}; border: 2.5px solid #ffffff; box-shadow: ${glow}0 4px 10px rgba(0,0,0,0.25); color: white; font-weight: bold; font-size: 16px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

// DivIcons are immutable value objects, so building them once per selection
// state stops Leaflet from tearing down and recreating every marker on render.
let cachedPlainIcon: L.DivIcon | null = null;
let cachedSelectedIcon: L.DivIcon | null = null;

function getChargerIcon(isSelected: boolean): L.DivIcon {
  if (isSelected) {
    cachedSelectedIcon = cachedSelectedIcon ?? createChargerIcon(true);
    return cachedSelectedIcon;
  }
  cachedPlainIcon = cachedPlainIcon ?? createChargerIcon(false);
  return cachedPlainIcon;
}

// Helper component to handle map clicks and sync center
function MapController({
  center,
  onLocationChange,
  fitBoundsPoints,
}: {
  center: GeoPoint;
  onLocationChange: (pos: GeoPoint) => void;
  fitBoundsPoints?: GeoPoint[];
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      onLocationChange({
        latitude: Number(e.latlng.lat.toFixed(6)),
        longitude: Number(e.latlng.lng.toFixed(6)),
      });
    },
  });

  // Pan to center or fit bounds between driver and nearest charger
  useEffect(() => {
    if (fitBoundsPoints && fitBoundsPoints.length >= 2) {
      const bounds = L.latLngBounds(
        fitBoundsPoints.map((pt) => [pt.latitude, pt.longitude])
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
    } else {
      map.panTo([center.latitude, center.longitude], { animate: true });
    }
  }, [center.latitude, center.longitude, fitBoundsPoints, map]);

  return null;
}

export default function ChargerMap({
  center,
  radiusKm,
  chargers,
  selectedChargerId,
  onSelectCharger,
  onLocationChange,
  fitBoundsPoints,
}: ChargerMapProps) {
  const searchIcon = useMemo(() => createSearchPointIcon(), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-100">
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={14}
        scrollWheelZoom={true}
        className="h-full w-full min-h-[380px] lg:min-h-[520px]"
        style={{ zIndex: 10 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapController
          center={center}
          onLocationChange={onLocationChange}
          fitBoundsPoints={fitBoundsPoints}
        />

        {/* 1. Search Point Pin & Search Radius Range Circle */}
        <Marker position={[center.latitude, center.longitude]} icon={searchIcon}>
          <Popup>
            <div className="p-1 text-xs">
              <p className="font-bold text-slate-900">Search Point</p>
              <p className="text-slate-500">Tap anywhere on map to reposition search.</p>
            </div>
          </Popup>
        </Marker>

        <Circle
          center={[center.latitude, center.longitude]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.05,
            weight: 1.5,
            dashArray: "6, 6",
          }}
        />

        {/* 2. Candidate Charger Markers with Approximate Location Circles */}
        {chargers.map((c) => {
          const isSelected = c.id === selectedChargerId;
          const icon = getChargerIcon(isSelected);

          return (
            <Fragment key={c.id}>
              {/* Translucent ~300m circle explicitly visualizing approximate privacy */}
              <Circle
                center={[
                  c.approximateLocation.latitude,
                  c.approximateLocation.longitude,
                ]}
                radius={300}
                pathOptions={{
                  color: isSelected ? "#047857" : "#059669",
                  fillColor: "#10b981",
                  fillOpacity: isSelected ? 0.25 : 0.12,
                  weight: isSelected ? 2 : 1,
                }}
              />

              <Marker
                position={[
                  c.approximateLocation.latitude,
                  c.approximateLocation.longitude,
                ]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectCharger(c.id),
                }}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-xs min-w-[170px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 line-clamp-1">
                        {c.title}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                        {c.powerKw} kW
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>{c.connectorType}</span>
                      <span className="font-semibold text-slate-800">
                        ₹{c.pricePerHour.toFixed(0)}/hr
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-emerald-700 font-semibold">
                        Est: ₹{c.estimatedCost.toFixed(2)}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Approx. location
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>

      {/* Floating map hint banner */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-white/90 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm border border-slate-200">
        Tap anywhere on the map to set the search center
      </div>
    </div>
  );
}
