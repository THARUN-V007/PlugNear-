"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, PlugZap, ShieldCheck, Zap } from "lucide-react";
import {
  type DriverBookingItem,
  getStatusBadgeDetails,
  canCancelBooking,
} from "@/lib/bookings/driver-bookings-helpers";

interface BookingCardProps {
  booking: DriverBookingItem;
  serverNow: string;
  onBookingCancelled?: (bookingId: string) => void;
}

export default function BookingCard({
  booking,
  serverNow,
  onBookingCancelled,
}: BookingCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const badge = getStatusBadgeDetails(booking.status);
  const isCancellable = canCancelBooking(booking, new Date(serverNow));

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

  const handleCancelClick = async () => {
    setIsCancelling(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data?.error?.message || "Failed to cancel booking.");
        setIsCancelling(false);
        setShowConfirm(false);
        return;
      }

      setShowConfirm(false);
      setIsCancelling(false);
      if (onBookingCancelled) {
        onBookingCancelled(booking.id);
      }
    } catch {
      setErrorMsg("Network error: Could not reach the server.");
      setIsCancelling(false);
      setShowConfirm(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border bg-[#181B22] p-5 sm:p-6 transition shadow-md ${
        booking.status === "confirmed"
          ? "border-primary/50 shadow-[0_0_20px_rgba(57,255,20,0.12)]"
          : "border-[#2C303B]"
      }`}
    >
      {/* 1. Header: Title, Connector, and Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C303B] bg-[#242933] px-2.5 py-1 text-[11px] font-bold text-slate-300">
              <PlugZap className="h-3.5 w-3.5 text-cyan-400" strokeWidth={2} aria-hidden />
              {booking.connectorType}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
              <Zap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {booking.powerKw} kW
            </span>
          </div>

          <Link
            href={`/driver/chargers/${booking.chargerId}`}
            className="group/title inline-block focus:outline-none"
          >
            <h3 className="text-lg font-black text-white line-clamp-1 mt-1 font-display group-hover/title:text-primary transition-colors">
              {booking.chargerTitle}
            </h3>
          </Link>
        </div>

        <div className="sm:text-right shrink-0">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider border ${badge.badgeStyle}`}
          >
            {badge.label}
          </span>
          <p className="mt-1 text-sm sm:text-base font-black text-white">
            ₹{booking.totalCost.toFixed(2)}
          </p>
        </div>
      </div>

      {/* 2. Status Help Text */}
      {badge.helpText && (
        <p className="mt-3 text-xs text-slate-400 bg-[#0F1115] px-3.5 py-2 rounded-xl border border-[#2C303B]">
          {badge.helpText}
        </p>
      )}

      {/* 3. Slot Schedule Details */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#0F1115] p-3.5 rounded-2xl border border-[#2C303B]">
        <div>
          <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider block">Date (IST)</span>
          <p className="font-bold text-slate-100 mt-0.5">{formatISTDate(booking.startAt)}</p>
        </div>
        <div>
          <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider block">Time (IST)</span>
          <p className="font-bold text-slate-100 mt-0.5">
            {formatISTTime(booking.startAt)} &ndash; {formatISTTime(booking.endAt)} ({durationMinutes} mins)
          </p>
        </div>
      </div>

      {/* 4. Privacy Guarded Location Display */}
      <div className="mt-4 pt-3 border-t border-[#2C303B]">
        {booking.exactAddress ? (
          <div className="rounded-2xl bg-primary/10 p-3.5 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-primary">
                <MapPin className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Confirmed Street Address
              </span>
              <p className="text-xs font-bold text-white">{booking.exactAddress}</p>
            </div>

            {booking.directionsUrl && (
              <a
                href={booking.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-black text-black shadow-md shadow-primary/20 hover:bg-[#32e012] transition shrink-0"
              >
                <span>Get Directions</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#0F1115] p-3 border border-[#2C303B] flex items-start gap-2 text-xs text-slate-400">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-cyan-400" strokeWidth={1.75} aria-hidden />
            <div>
              <span className="font-semibold text-slate-200">Approximate Location</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Exact street address and map directions unlock after the host confirms your booking.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 5. Error Message */}
      {errorMsg && (
        <div className="mt-3 rounded-xl bg-rose-950/40 p-2.5 text-xs text-rose-300 border border-rose-800">
          {errorMsg}
        </div>
      )}

      {/* 6. Cancellation Section */}
      {isCancellable && (
        <div className="mt-4 pt-3 border-t border-[#2C303B] flex items-center justify-between">
          {!showConfirm ? (
            <button
              type="button"
              disabled={isCancelling}
              onClick={() => setShowConfirm(true)}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 transition py-1"
            >
              Cancel Booking
            </button>
          ) : (
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-rose-950/40 p-3 rounded-2xl border border-rose-800 animate-in fade-in duration-200">
              <span className="text-xs font-bold text-rose-200">
                Are you sure you want to cancel?
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setShowConfirm(false)}
                  className="rounded-lg bg-[#181B22] px-3 py-1.5 text-xs font-semibold text-slate-300 border border-[#2C303B] hover:bg-[#242933] transition"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelClick}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition flex items-center gap-1 shadow-xs"
                >
                  {isCancelling ? "Cancelling..." : "Yes, Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
