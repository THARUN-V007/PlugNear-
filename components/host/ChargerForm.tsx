"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { APP_CURRENCY } from "@/lib/rules";
import {
  CreateChargerSchema,
  HOST_CONNECTION_LABELS,
  type HostConnectionType,
} from "@/lib/validation/charger";
import type { HostChargerListItem } from "@/lib/chargers/host-chargers-helpers";
import { DEFAULT_MAP_CENTER } from "@/lib/search/search-helpers";

// Dynamic import of LocationPickerMap with ssr: false to prevent Leaflet SSR window errors
const LocationPickerMap = dynamic(
  () => import("@/components/map/LocationPickerMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 sm:h-72 w-full rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center text-xs text-slate-400 font-semibold border border-slate-200">
        Loading interactive map...
      </div>
    ),
  }
);

interface ChargerFormProps {
  initialData?: HostChargerListItem | null;
  isEdit?: boolean;
}

const CONNECTOR_OPTIONS = [
  "Type 2",
  "CCS2",
  "CHAdeMO",
  "Bharat AC-001",
  "Other",
] as const;

export default function ChargerForm({ initialData, isEdit = false }: ChargerFormProps) {
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState(initialData?.title || "");
  const [addressText, setAddressText] = useState(initialData?.addressText || "");
  const [latitude, setLatitude] = useState<number>(
    initialData?.latitude || DEFAULT_MAP_CENTER.latitude
  );
  const [longitude, setLongitude] = useState<number>(
    initialData?.longitude || DEFAULT_MAP_CENTER.longitude
  );
  const [connectorType, setConnectorType] = useState<string>(
    initialData?.connectorType || "CCS2"
  );
  const [powerKw, setPowerKw] = useState<string>(
    initialData?.powerKw ? String(initialData.powerKw) : "22"
  );
  const [pricePerHour, setPricePerHour] = useState<string>(
    initialData?.pricePerHour !== undefined ? String(initialData.pricePerHour) : "120"
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [hostConnectionType, setHostConnectionType] = useState<HostConnectionType>(
    initialData?.hostConnectionType || "domestic"
  );
  const [electricityPermissionAcknowledged, setElectricityPermissionAcknowledged] =
    useState<boolean>(Boolean(initialData?.electricityPermissionAcknowledged));

  // Submission & Validation States
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    // Clear coordinate errors if any
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.latitude;
      delete copy.longitude;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // 1. Client-side Zod validation
    const payload = {
      title,
      address_text: addressText,
      latitude,
      longitude,
      connector_type: connectorType,
      power_kw: parseFloat(powerKw) || 0,
      price_per_hour: parseFloat(pricePerHour) || 0,
      notes: notes || null,
      host_connection_type: hostConnectionType,
      electricity_permission_acknowledged: electricityPermissionAcknowledged,
    };

    const parseResult = CreateChargerSchema.safeParse(payload);
    if (!parseResult.success) {
      const errors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const key = issue.path[0] as string;
        if (!errors[key]) {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const url = isEdit
        ? `/api/host/chargers/${initialData!.id}`
        : `/api/host/chargers`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setServerError(
          data?.error?.message ||
            (isEdit
              ? "Failed to update charger listing."
              : "Failed to create charger listing.")
        );
        setIsSubmitting(false);
        return;
      }

      // Success: redirect to host chargers list
      router.push("/host/chargers?saved=true");
      router.refresh();
    } catch {
      setServerError("Network error: Could not reach the server. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Server Error Alert */}
      {serverError && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-start gap-3 shadow-xs">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-bold">Unable to Save Charging Point</p>
            <p className="mt-0.5">{serverError}</p>
          </div>
          <button
            type="button"
            onClick={() => setServerError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">1. Charger Details</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Provide a descriptive title and your street address for verified drivers.
          </p>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-xs font-bold text-slate-700">
            Listing Title <span className="text-rose-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 100ft Road Fast Hub or Residential Driveway Plug"
            maxLength={100}
            className={`mt-1.5 block w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 ${
              fieldErrors.title
                ? "border-rose-300 focus:ring-rose-500 bg-rose-50/30"
                : "border-slate-300 focus:ring-purple-500"
            }`}
          />
          {fieldErrors.title && (
            <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.title}</p>
          )}
        </div>

        {/* Street Address */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="address_text" className="block text-xs font-bold text-slate-700">
              Private Street Address <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              🔒 Private: Hidden until confirmed
            </span>
          </div>
          <textarea
            id="address_text"
            rows={2}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="e.g., Plot 42, 100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038"
            maxLength={500}
            className={`mt-1.5 block w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 ${
              fieldErrors.address_text
                ? "border-rose-300 focus:ring-rose-500 bg-rose-50/30"
                : "border-slate-300 focus:ring-purple-500"
            }`}
          />
          {fieldErrors.address_text && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {fieldErrors.address_text}
            </p>
          )}
        </div>
      </div>

      {/* Section 2: Interactive Location Pin */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">2. Precise Location Pin</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click on the map or drag the pin to set the exact geographic location of your charger.
          </p>
        </div>

        <LocationPickerMap
          latitude={latitude}
          longitude={longitude}
          onChange={handleLocationChange}
        />

        {(fieldErrors.latitude || fieldErrors.longitude) && (
          <p className="text-xs font-medium text-rose-600">
            Please choose a valid location on the map.
          </p>
        )}
      </div>

      {/* Section 3: Technical Specs & Pricing */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">3. Charging Specifications & Tariff</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the plug standard, maximum delivery power, and your hourly charging fee.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Connector Type */}
          <div>
            <label htmlFor="connector_type" className="block text-xs font-bold text-slate-700">
              Connector Standard <span className="text-rose-500">*</span>
            </label>
            <select
              id="connector_type"
              value={connectorType}
              onChange={(e) => setConnectorType(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {CONNECTOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Power Rating */}
          <div>
            <label htmlFor="power_kw" className="block text-xs font-bold text-slate-700">
              Power Rating (kW) <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1.5 rounded-xl shadow-2xs">
              <input
                id="power_kw"
                type="number"
                step="0.1"
                min="0.1"
                max="350"
                value={powerKw}
                onChange={(e) => setPowerKw(e.target.value)}
                placeholder="22"
                className={`block w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                  fieldErrors.power_kw
                    ? "border-rose-300 focus:ring-rose-500 bg-rose-50/30"
                    : "border-slate-300 focus:ring-purple-500"
                }`}
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs font-bold text-slate-400">kW</span>
              </div>
            </div>
            {fieldErrors.power_kw && (
              <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.power_kw}</p>
            )}
          </div>

          {/* Hourly Price */}
          <div>
            <label htmlFor="price_per_hour" className="block text-xs font-bold text-slate-700">
              Price per Hour ({APP_CURRENCY}) <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1.5 rounded-xl shadow-2xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-xs font-bold text-slate-400">₹</span>
              </div>
              <input
                id="price_per_hour"
                type="number"
                step="1"
                min="0"
                max="5000"
                value={pricePerHour}
                onChange={(e) => setPricePerHour(e.target.value)}
                placeholder="120"
                className={`block w-full rounded-xl border pl-7 pr-12 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                  fieldErrors.price_per_hour
                    ? "border-rose-300 focus:ring-rose-500 bg-rose-50/30"
                    : "border-slate-300 focus:ring-purple-500"
                }`}
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs font-bold text-slate-400">/hr</span>
              </div>
            </div>
            {fieldErrors.price_per_hour && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {fieldErrors.price_per_hour}
              </p>
            )}
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label htmlFor="notes" className="block text-xs font-bold text-slate-700">
            Host Instructions & Parking Notes <span className="text-slate-400">(Optional)</span>
          </label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Covered parking spot in basement. Ring bell on arrival or inform security."
            maxLength={1000}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Section 4: Electrical Connection & Regulatory Declaration */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            4. Connection Type & Regulatory Declaration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Specify your electricity meter classification and confirm regulatory compliance.
          </p>
        </div>

        {/* Connection Type Radio Cards */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Electricity Connection Type <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                { id: "domestic", title: "Domestic", desc: "Residential home meter socket" },
                { id: "commercial", title: "Commercial", desc: "Shop, mall or commercial courtyard" },
                { id: "dedicated_ev", title: "Dedicated EV", desc: "Sub-metered dedicated EV tariff line" },
              ] as const
            ).map((item) => (
              <label
                key={item.id}
                className={`relative flex flex-col p-4 rounded-2xl border cursor-pointer transition ${
                  hostConnectionType === item.id
                    ? "border-purple-600 bg-purple-50/50 ring-2 ring-purple-500"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="host_connection_type"
                  value={item.id}
                  checked={hostConnectionType === item.id}
                  onChange={() => setHostConnectionType(item.id)}
                  className="sr-only"
                />
                <span className="text-sm font-bold text-slate-900">{item.title}</span>
                <span className="text-xs text-slate-500 mt-1">{item.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Required Electricity Permission Checkbox */}
        <div
          className={`rounded-2xl border p-4.5 transition ${
            fieldErrors.electricity_permission_acknowledged
              ? "border-rose-300 bg-rose-50/60"
              : "border-purple-200 bg-purple-50/30"
          }`}
        >
          <label className="flex items-start gap-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={electricityPermissionAcknowledged}
              onChange={(e) => {
                setElectricityPermissionAcknowledged(e.target.checked);
                if (e.target.checked) {
                  setFieldErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.electricity_permission_acknowledged;
                    return copy;
                  });
                }
              }}
              className="mt-1 h-5 w-5 rounded-md border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <div className="text-xs leading-relaxed text-slate-800">
              <span className="font-bold block text-slate-900">
                Electricity Provider Confirmation (Mandatory)
              </span>
              <span>
                I have confirmed with my electricity provider that my connection allows
                charging other people&apos;s vehicles.
              </span>
            </div>
          </label>
          {fieldErrors.electricity_permission_acknowledged && (
            <p className="mt-2 text-xs font-semibold text-rose-600 pl-8">
              {fieldErrors.electricity_permission_acknowledged}
            </p>
          )}
        </div>
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <Link
          href="/host/chargers"
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              <span>Saving...</span>
            </>
          ) : isEdit ? (
            <span>Update Charging Point</span>
          ) : (
            <span>Save & Add Charging Point</span>
          )}
        </button>
      </div>
    </form>
  );
}
