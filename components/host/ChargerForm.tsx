"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Lock, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { APP_CURRENCY } from "@/lib/rules";
import {
  CreateChargerSchema,
  HOST_CONNECTION_LABELS,
  type AvailabilityWindowInput,
  type HostConnectionType,
} from "@/lib/validation/charger";
import AvailabilityWindowsEditor from "./AvailabilityWindowsEditor";
import type { HostChargerListItem } from "@/lib/chargers/host-chargers-helpers";
import { DEFAULT_MAP_CENTER } from "@/lib/search/search-helpers";

// Dynamic import of LocationPickerMap with ssr: false to prevent Leaflet SSR window errors
const LocationPickerMap = dynamic(
  () => import("@/components/map/LocationPickerMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 sm:h-72 w-full rounded-2xl bg-[#0F1115] animate-pulse flex items-center justify-center text-xs text-slate-500 font-semibold border border-[#2C303B]">
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

  // Weekly availability. A charger with no window matches no search slot, so a
  // new listing starts with a sensible everyday range the host can edit.
  const [windows, setWindows] = useState<AvailabilityWindowInput[]>(
    initialData?.windows
      ? initialData.windows.map((w) => ({
          day_of_week: w.day_of_week,
          start_time: w.start_time,
          end_time: w.end_time,
        }))
      : [
          { day_of_week: 0, start_time: "06:00", end_time: "22:30" },
          { day_of_week: 1, start_time: "06:00", end_time: "22:30" },
          { day_of_week: 2, start_time: "06:00", end_time: "22:30" },
          { day_of_week: 3, start_time: "06:00", end_time: "22:30" },
          { day_of_week: 4, start_time: "06:00", end_time: "22:30" },
          { day_of_week: 5, start_time: "06:00", end_time: "22:30" },
          { day_of_week: 6, start_time: "06:00", end_time: "22:30" },
        ]
  );

  // Submission & Validation States
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
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
      windows,
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
        <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-xs font-semibold text-rose-300 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" strokeWidth={1.75} aria-hidden />
          <div className="flex-1">
            <p className="font-bold">Unable to Save Charging Point</p>
            <p className="mt-0.5">{serverError}</p>
          </div>
          <button
            type="button"
            onClick={() => setServerError(null)}
            className="text-rose-400 hover:text-rose-200 font-bold"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="rounded-3xl border border-[#2C303B] bg-[#181B22] p-6 sm:p-8 shadow-md space-y-6">
        <div>
          <h2 className="text-base font-black text-white font-display">1. Charger Details</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Provide a descriptive title and your street address for verified drivers.
          </p>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-xs font-bold text-slate-300">
            Listing Title <span className="text-rose-400">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 100ft Road Fast Hub or Residential Driveway Plug"
            maxLength={100}
            className={`mt-1.5 block w-full rounded-xl border bg-[#0F1115] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 ${
              fieldErrors.title
                ? "border-rose-500 focus:ring-rose-500"
                : "border-[#2C303B] focus:border-cyan-400 focus:ring-cyan-400"
            }`}
          />
          {fieldErrors.title && (
            <p className="mt-1 text-xs font-medium text-rose-400">{fieldErrors.title}</p>
          )}
        </div>

        {/* Street Address */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="address_text" className="block text-xs font-bold text-slate-300">
              Private Street Address <span className="text-rose-400">*</span>
            </label>
            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/30 inline-flex items-center gap-1">
              <Lock className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Private: Hidden until confirmed
            </span>
          </div>
          <textarea
            id="address_text"
            rows={2}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="e.g., Plot 42, 100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038"
            maxLength={500}
            className={`mt-1.5 block w-full rounded-xl border bg-[#0F1115] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 ${
              fieldErrors.address_text
                ? "border-rose-500 focus:ring-rose-500"
                : "border-[#2C303B] focus:border-cyan-400 focus:ring-cyan-400"
            }`}
          />
          {fieldErrors.address_text && (
            <p className="mt-1 text-xs font-medium text-rose-400">
              {fieldErrors.address_text}
            </p>
          )}
        </div>
      </div>

      {/* Section 2: Interactive Location Pin */}
      <div className="rounded-3xl border border-[#2C303B] bg-[#181B22] p-6 sm:p-8 shadow-md space-y-4">
        <div>
          <h2 className="text-base font-black text-white font-display">2. Precise Location Pin</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click on the map or drag the pin to set the exact geographic location of your charger.
          </p>
        </div>

        <LocationPickerMap
          latitude={latitude}
          longitude={longitude}
          onChange={handleLocationChange}
        />

        {(fieldErrors.latitude || fieldErrors.longitude) && (
          <p className="text-xs font-medium text-rose-400">
            Please choose a valid location on the map.
          </p>
        )}
      </div>

      {/* Section 3: Technical Specs & Pricing */}
      <div className="rounded-3xl border border-[#2C303B] bg-[#181B22] p-6 sm:p-8 shadow-md space-y-6">
        <div>
          <h2 className="text-base font-black text-white font-display">3. Charging Specifications & Tariff</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select the plug standard, maximum delivery power, and your hourly charging fee.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Connector Type */}
          <div>
            <label htmlFor="connector_type" className="block text-xs font-bold text-slate-300">
              Connector Standard <span className="text-rose-400">*</span>
            </label>
            <select
              id="connector_type"
              value={connectorType}
              onChange={(e) => setConnectorType(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-[#2C303B] bg-[#0F1115] px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            >
              {CONNECTOR_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-[#181B22] text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Power Rating */}
          <div>
            <label htmlFor="power_kw" className="block text-xs font-bold text-slate-300">
              Power Rating (kW) <span className="text-rose-400">*</span>
            </label>
            <div className="relative mt-1.5 rounded-xl">
              <input
                id="power_kw"
                type="number"
                step="0.1"
                min="0.1"
                max="350"
                value={powerKw}
                onChange={(e) => setPowerKw(e.target.value)}
                placeholder="22"
                className={`block w-full rounded-xl border bg-[#0F1115] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 ${
                  fieldErrors.power_kw
                    ? "border-rose-500 focus:ring-rose-500"
                    : "border-[#2C303B] focus:border-cyan-400 focus:ring-cyan-400"
                }`}
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs font-bold text-slate-500">kW</span>
              </div>
            </div>
            {fieldErrors.power_kw && (
              <p className="mt-1 text-xs font-medium text-rose-400">{fieldErrors.power_kw}</p>
            )}
          </div>

          {/* Hourly Price */}
          <div>
            <label htmlFor="price_per_hour" className="block text-xs font-bold text-slate-300">
              Price per Hour ({APP_CURRENCY}) <span className="text-rose-400">*</span>
            </label>
            <div className="relative mt-1.5 rounded-xl">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-xs font-bold text-slate-500">₹</span>
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
                className={`block w-full rounded-xl border bg-[#0F1115] pl-7 pr-12 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 ${
                  fieldErrors.price_per_hour
                    ? "border-rose-500 focus:ring-rose-500"
                    : "border-[#2C303B] focus:border-cyan-400 focus:ring-cyan-400"
                }`}
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs font-bold text-slate-500">/hr</span>
              </div>
            </div>
            {fieldErrors.price_per_hour && (
              <p className="mt-1 text-xs font-medium text-rose-400">
                {fieldErrors.price_per_hour}
              </p>
            )}
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label htmlFor="notes" className="block text-xs font-bold text-slate-300">
            Host Instructions & Parking Notes <span className="text-slate-500">(Optional)</span>
          </label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Covered parking spot in basement. Ring bell on arrival or inform security."
            maxLength={1000}
            className="mt-1.5 block w-full rounded-xl border border-[#2C303B] bg-[#0F1115] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
          />
        </div>
      </div>

      {/* Section 4: Weekly Availability Windows */}
      <div className="rounded-3xl border border-[#2C303B] bg-[#181B22] p-6 sm:p-8 shadow-md space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-white font-display">4. Weekly Availability</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              When can drivers charge here? A booking must fit entirely inside one window on
              that day, and a charger with no window never appears in search.
            </p>
          </div>
          <span className="rounded-full border border-[#2C303B] bg-[#0F1115] px-3 py-1 text-[11px] font-bold text-slate-400">
            Local time · Asia/Kolkata
          </span>
        </div>

        <AvailabilityWindowsEditor
          value={windows}
          onChange={setWindows}
          serverError={fieldErrors.windows}
        />
      </div>

      {/* Section 5: Electrical Connection & Regulatory Declaration */}
      <div className="rounded-3xl border border-[#2C303B] bg-[#181B22] p-6 sm:p-8 shadow-md space-y-6">
        <div>
          <h2 className="text-base font-black text-white font-display">
            5. Connection Type & Regulatory Declaration
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Specify your electricity meter classification and confirm regulatory compliance.
          </p>
        </div>

        {/* Connection Type Radio Cards */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2">
            Electricity Connection Type <span className="text-rose-400">*</span>
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
                    ? "border-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-400"
                    : "border-[#2C303B] bg-[#0F1115] hover:border-slate-600"
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
                <span className="text-sm font-bold text-white">{item.title}</span>
                <span className="text-xs text-slate-400 mt-1">{item.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Required Electricity Permission Checkbox */}
        <div
          className={`rounded-2xl border p-4.5 transition ${
            fieldErrors.electricity_permission_acknowledged
              ? "border-rose-800 bg-rose-950/40"
              : "border-cyan-500/30 bg-cyan-500/10"
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
              className="mt-1 h-5 w-5 rounded-md border-[#2C303B] text-cyan-400 focus:ring-cyan-400 bg-[#0F1115] cursor-pointer"
            />
            <div className="text-xs leading-relaxed text-slate-300">
              <span className="font-bold block text-white">
                Electricity Provider Confirmation (Mandatory)
              </span>
              <span className="text-slate-400">
                I have confirmed with my electricity provider that my connection allows
                charging other people&apos;s vehicles.
              </span>
            </div>
          </label>
          {fieldErrors.electricity_permission_acknowledged && (
            <p className="mt-2 text-xs font-semibold text-rose-400 pl-8">
              {fieldErrors.electricity_permission_acknowledged}
            </p>
          )}
        </div>
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <Link
          href="/host/chargers"
          className="rounded-xl border border-[#2C303B] bg-[#242933] px-5 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-[#2e3442] hover:text-white"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-cyan-500 px-6 py-2.5 text-xs font-black text-black shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-black" aria-hidden />
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
