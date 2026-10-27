"use client";

import { useState } from "react";
import { AlertTriangle, Check, PlugZap, User, X, Zap } from "lucide-react";
import {
  type HostBookingItem,
  getHostStatusBadgeDetails,
  canHostApprove,
  canHostDecline,
  canHostCancel,
  formatDurationMinutes,
} from "@/lib/bookings/host-bookings-helpers";

interface HostBookingCardProps {
  booking: HostBookingItem;
  serverNow: string;
  onActionComplete?: () => void;
}

export default function HostBookingCard({
  booking,
  serverNow,
  onActionComplete,
}: HostBookingCardProps) {
  const [activeConfirm, setActiveConfirm] = useState<"approve" | "decline" | "cancel" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const badge = getHostStatusBadgeDetails(booking.status);
  const now = new Date(serverNow);
  const canApprove = canHostApprove(booking, now);
  const canDecline = canHostDecline(booking);
  const canCancel = canHostCancel(booking, now);

  const formatISTDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatISTTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const durationMinutes = Math.round(
    (new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) /
      (60 * 1000)
  );

  const handleAction = async (action: "approve" | "decline" | "cancel") => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/host/bookings/${booking.id}/${action}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data?.error?.message || `Failed to ${action} booking.`);
        setIsSubmitting(false);
        setActiveConfirm(null);
        return;
      }

      setActiveConfirm(null);
      setIsSubmitting(false);
      if (onActionComplete) {
        onActionComplete();
      }
    } catch {
      setErrorMsg("Network error: Could not reach the server.");
      setIsSubmitting(false);
      setActiveConfirm(null);
    }
  };

  return (
    <div
      className={`rounded-3xl border bg-white p-5 sm:p-6 shadow-xs transition hover:shadow-md ${
        booking.status === "requested"
          ? "border-amber-300 ring-1 ring-amber-200"
          : booking.status === "confirmed"
          ? "border-emerald-300 ring-1 ring-emerald-200"
          : "border-slate-200"
      }`}
    >
      {/* 1. Header: Charger Specs & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
              <PlugZap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {booking.connectorType}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-bold text-cyan-800">
              <Zap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {booking.powerKw} kW
            </span>
            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
              ₹{booking.pricePerHour}/hr
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            {booking.chargerTitle}
          </h3>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${badge.badgeStyle}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
            {badge.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
            ID: <code>{booking.id.slice(0, 8)}</code>
          </span>
        </div>
      </div>

      {/* 2. Driver & Schedule Details Grid */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
        <div>
          <span className="text-xs font-medium text-slate-500 block">Driver</span>
          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
            <User className="h-4 w-4 text-slate-400" strokeWidth={1.75} aria-hidden />
            {booking.driverName}
          </p>
        </div>

        <div>
          <span className="text-xs font-medium text-slate-500 block">Scheduled Slot (IST)</span>
          <p className="text-sm font-bold text-slate-800 mt-0.5">
            {formatISTDate(booking.startAt)}
          </p>
          <p className="text-xs font-medium text-slate-600 mt-0.5">
            {formatISTTime(booking.startAt)} – {formatISTTime(booking.endAt)} ({formatDurationMinutes(durationMinutes)})
          </p>
        </div>

        <div>
          <span className="text-xs font-medium text-slate-500 block">Total Earnings</span>
          <p className="text-base font-extrabold text-emerald-700 mt-0.5">
            ₹{booking.totalCost.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Status Explanatory Help Text */}
      <p className="mt-3 text-xs text-slate-500">{badge.helpText}</p>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" strokeWidth={1.75} aria-hidden />
          <div className="flex-1">
            <p>{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      )}

      {/* 3. Action Section */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        {/* Timestamp */}
        <div className="text-[11px] text-slate-400">
          Requested: {formatISTDate(booking.createdAt)} at {formatISTTime(booking.createdAt)}
        </div>

        {/* Buttons / Confirmation Controls */}
        <div className="flex items-center gap-2">
          {/* Pending State Actions: Approve & Decline */}
          {booking.status === "requested" && (
            <>
              {!activeConfirm ? (
                <>
                  <button
                    type="button"
                    disabled={!canApprove}
                    onClick={() => setActiveConfirm("approve")}
                    className={`rounded-xl px-4 py-2 text-xs font-bold shadow-xs transition flex items-center gap-1.5 ${
                      canApprove
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={!canDecline}
                    onClick={() => setActiveConfirm("decline")}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                      canDecline
                        ? "border-slate-300 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 focus:ring-2 focus:ring-rose-500"
                        : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Decline
                  </button>
                </>
              ) : activeConfirm === "approve" ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5">
                  <span className="text-xs font-semibold text-emerald-900 hidden sm:inline">
                    Approve and auto-decline conflicting requests?
                  </span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction("approve")}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? "Approving..." : "Yes, Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setActiveConfirm(null)}
                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Back
                  </button>
                </div>
              ) : activeConfirm === "decline" ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-2xl p-2.5">
                  <span className="text-xs font-semibold text-rose-900 hidden sm:inline">
                    Decline this request?
                  </span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction("decline")}
                    className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? "Declining..." : "Yes, Decline"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setActiveConfirm(null)}
                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Back
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* Confirmed State Action: Cancel before slot start */}
          {booking.status === "confirmed" && canCancel && (
            <>
              {activeConfirm !== "cancel" ? (
                <button
                  type="button"
                  onClick={() => setActiveConfirm("cancel")}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 hover:border-rose-300"
                >
                  Cancel Booking
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-2xl p-2.5">
                  <span className="text-xs font-semibold text-rose-900 hidden sm:inline">
                    Cancel confirmed booking?
                  </span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction("cancel")}
                    className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? "Cancelling..." : "Yes, Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setActiveConfirm(null)}
                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Back
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
