"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, MapPin, PlugZap, X, Zap } from "lucide-react";
import Link from "next/link";
import type { HostChargerListItem } from "@/lib/chargers/host-chargers-helpers";
import { formatChargerPrice, summarizeWeeklySchedule } from "@/lib/chargers/host-chargers-helpers";
import { HOST_CONNECTION_LABELS } from "@/lib/validation/charger";

interface ChargerCardProps {
  charger: HostChargerListItem;
  onStatusToggled?: () => void;
}

export default function ChargerCard({ charger, onStatusToggled }: ChargerCardProps) {
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateAck, setReactivateAck] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDeactivate = async () => {
    setIsToggling(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/host/chargers/${charger.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data?.error?.message || "Failed to deactivate charger.");
        setIsToggling(false);
        return;
      }

      setShowDeactivateModal(false);
      setIsToggling(false);
      if (onStatusToggled) onStatusToggled();
    } catch {
      setErrorMsg("Network error: Could not reach the server.");
      setIsToggling(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivateAck) {
      setErrorMsg("You must confirm electricity provider permission to reactivate.");
      return;
    }

    setIsToggling(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/host/chargers/${charger.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: true,
          electricity_permission_acknowledged: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data?.error?.message || "Failed to reactivate charger.");
        setIsToggling(false);
        return;
      }

      setShowReactivateModal(false);
      setIsToggling(false);
      setReactivateAck(false);
      if (onStatusToggled) onStatusToggled();
    } catch {
      setErrorMsg("Network error: Could not reach the server.");
      setIsToggling(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border bg-white p-5 sm:p-6 shadow-xs transition hover:shadow-md ${
        charger.isActive
          ? "border-slate-200"
          : "border-slate-300 bg-slate-50/70 opacity-90"
      }`}
    >
      {/* 1. Header: Specs & Active Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-md bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800 border border-cyan-200">
              <PlugZap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> {charger.connectorType}
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              <Zap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> {charger.powerKw} kW
            </span>
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
              {HOST_CONNECTION_LABELS[charger.hostConnectionType] || charger.hostConnectionType}
            </span>
          </div>

          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            {charger.title}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
              charger.isActive
                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                : "bg-slate-200 text-slate-700 border-slate-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                charger.isActive ? "bg-emerald-600" : "bg-slate-500"
              }`}
            ></span>
            {charger.isActive ? "Active" : "Deactivated"}
          </span>
        </div>
      </div>

      {/* 2. Address & Specs Bar */}
      <div className="mt-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2">
        <div className="flex items-start gap-2 text-xs text-slate-700">
          <MapPin className="mt-[-2px] h-4 w-4 text-slate-400" strokeWidth={1.75} aria-hidden />
          <span className="font-medium">{charger.addressText}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-slate-200/60 gap-2">
          <div className="text-slate-500">
            Rate:{" "}
            <span className="font-extrabold text-slate-900">
              {formatChargerPrice(charger.pricePerHour)}
            </span>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            Coords: {charger.latitude.toFixed(4)}, {charger.longitude.toFixed(4)}
          </div>
        </div>
      </div>

      {/* 3. Weekly availability summary (or a warning when none is configured) */}
      {charger.availabilityWindowsCount === 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" strokeWidth={1.75} aria-hidden />
          <div className="flex-1">
            <span className="font-bold block">No availability schedule added yet</span>
            <span className="text-[11px] text-amber-800">
              This charger will not appear in driver searches until you add weekly windows in
              Edit Charger.
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Weekly availability
          </span>
          <ul className="mt-1.5 space-y-1">
            {summarizeWeeklySchedule(charger.windows).map((line) => (
              <li key={line.days} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                <span className="font-extrabold text-slate-800 w-16 shrink-0">{line.days}</span>
                <span className="plugnear-tabular font-semibold text-slate-600">{line.ranges}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" strokeWidth={1.75} aria-hidden />
          <div className="flex-1">{errorMsg}</div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      )}

      {/* 4. Action Controls */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400">
          {charger.notes ? `Note: ${charger.notes}` : "No additional notes"}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/host/chargers/${charger.id}/edit`}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
          >
            Edit
          </Link>

          {charger.isActive ? (
            <button
              type="button"
              onClick={() => setShowDeactivateModal(true)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
            >
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowReactivateModal(true)}
              className="rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-cyan-700"
            >
              Reactivate
            </button>
          )}
        </div>
      </div>

      {/* Deactivation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-7 w-7 text-amber-500" strokeWidth={1.5} aria-hidden />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Deactivate &ldquo;{charger.title}&rdquo;?
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Deactivating this charger will immediately remove it from driver search results and Emergency mode.
                </p>
              </div>
            </div>

            {/* Upcoming confirmed bookings warning */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <span className="font-bold block text-sm mb-1">
                <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Upcoming Confirmed Reservations: {charger.upcomingConfirmedBookingsCount}
              </span>
              <p className="text-[11px] text-amber-800">
                {charger.upcomingConfirmedBookingsCount > 0
                  ? "Existing bookings will remain active and intact. Deactivating does not cancel or modify them, but no new drivers will be able to book this charger."
                  : "There are currently no upcoming confirmed bookings on this charger."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isToggling}
                onClick={() => setShowDeactivateModal(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isToggling}
                onClick={handleDeactivate}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isToggling ? "Deactivating..." : "Confirm Deactivation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivation Modal */}
      {showReactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <Zap className="h-6 w-6 text-emerald-600" strokeWidth={2} aria-hidden />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reactivate &ldquo;{charger.title}&rdquo;?
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Reactivating will make this charger visible again in driver search when it has availability windows.
                </p>
              </div>
            </div>

            {/* Required Permission Checkbox */}
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reactivateAck}
                  onChange={(e) => setReactivateAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-800 leading-snug">
                  I confirm that my electricity provider permits using this connection for
                  charging other people&apos;s vehicles.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isToggling}
                onClick={() => {
                  setShowReactivateModal(false);
                  setReactivateAck(false);
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isToggling || !reactivateAck}
                onClick={handleReactivate}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 transition disabled:opacity-50"
              >
                {isToggling ? "Reactivating..." : "Confirm Reactivation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
