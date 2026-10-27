"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Ban, Check, MapPin, Sparkles, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SafeChargerDetails, SlotPreValidation } from "@/lib/bookings/charger-loader";
import { getGoogleMapsDirectionsUrl } from "@/lib/bookings/driver-bookings-helpers";
import { toKolkataLocalDetails, type AvailabilityWindow } from "@/lib/rules";

const ApproximateLocationMap = dynamic(
  () => import("./ApproximateLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 sm:h-72 w-full rounded-2xl bg-[#0F1115] animate-pulse flex items-center justify-center text-xs text-slate-500 border border-[#2C303B]">
        Loading neighborhood map...
      </div>
    ),
  }
);

interface ChargerDetailsViewProps {
  charger: SafeChargerDetails;
  windows: AvailabilityWindow[];
  validation?: SlotPreValidation;
  isEmergency?: boolean;
}

export default function ChargerDetailsView({
  charger,
  windows,
  validation,
  isEmergency,
}: ChargerDetailsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    totalCost: number;
  } | null>(null);

  // Format times in Asia/Kolkata
  const effectiveSlot = validation?.slot;
  const startKolkata = effectiveSlot ? toKolkataLocalDetails(effectiveSlot.startAt) : null;
  const endKolkata = effectiveSlot ? toKolkataLocalDetails(effectiveSlot.endAt) : null;

  const formatISTTime = (val?: Date | string) => {
    if (!val) return "";
    const date = typeof val === "string" ? new Date(val) : val;
    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatISTDate = (val?: Date | string) => {
    if (!val) return "";
    const date = typeof val === "string" ? new Date(val) : val;
    return date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleBookingSubmit = async () => {
    if (!effectiveSlot || !validation?.isBookable || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    const startAtStr =
      typeof effectiveSlot.startAt === "string"
        ? effectiveSlot.startAt
        : effectiveSlot.startAt.toISOString();
    const endAtStr =
      typeof effectiveSlot.endAt === "string"
        ? effectiveSlot.endAt
        : effectiveSlot.endAt.toISOString();

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chargerId: charger.id,
          startAt: startAtStr,
          endAt: endAtStr,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setSubmissionError(
          data?.error?.message || "Failed to submit booking request. Please try again."
        );
        setIsSubmitting(false);
        return;
      }

      setConfirmedBooking(data.data.booking);
    } catch {
      setSubmissionError("Network error: Could not reach the server. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link
          href="/driver"
          className="hover:text-primary transition flex items-center gap-1"
        >
          &larr; Back to Search
        </Link>
        <span>/</span>
        <span className="text-white font-bold">Charger Details</span>
        {isEmergency && (
          <span className="ml-2 rounded-full bg-amber-950/40 text-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border border-amber-800">
            Emergency Mode
          </span>
        )}
      </div>

      {/* 2. Success Confirmation Panel */}
      {confirmedBooking ? (
        <div className="rounded-3xl border border-primary/50 bg-[#181B22] p-6 sm:p-8 shadow-[0_0_30px_rgba(57,255,20,0.12)] space-y-6 animate-in fade-in duration-300">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-black font-black shadow-lg shadow-primary/30">
              <Check className="h-6 w-6" strokeWidth={3} aria-hidden />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-950/40 border border-amber-800 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                Status: Requested
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display">
                Booking Request Submitted!
              </h2>
              <p className="text-sm text-slate-400">
                The host has been notified. They must confirm your request before the booking is finalized.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0F1115] p-5 border border-[#2C303B] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Booking Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 font-medium">Charging Point</p>
                <p className="font-bold text-white">{charger.title}</p>
                <p className="text-xs text-slate-400">
                  {charger.powerKw} kW &bull; {charger.connectorType}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium">Reserved Slot (IST)</p>
                <p className="font-bold text-white">
                  {formatISTDate(confirmedBooking.startAt)}
                </p>
                <p className="text-xs text-slate-400">
                  {formatISTTime(confirmedBooking.startAt)} &ndash;{" "}
                  {formatISTTime(confirmedBooking.endAt)} (
                  {validation?.durationMinutes} mins)
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium">Total Estimated Cost</p>
                <p className="text-xl font-black text-primary">
                  ₹{Number(confirmedBooking.totalCost).toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-500">
                  ₹{charger.pricePerHour}/hr &bull; Payable at charging point
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium">Location Security</p>
                <p className="text-xs text-slate-400">
                  Exact street address and driving directions unlock as soon as the host confirms.
                </p>
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <Link
              href="/driver"
              className="rounded-xl bg-[#242933] px-4 py-2.5 text-xs font-bold text-slate-300 border border-[#2C303B] hover:bg-[#2e3442] hover:text-white text-center transition"
            >
              &larr; Return to Search
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/driver/bookings"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-black text-black shadow-lg shadow-primary/20 hover:bg-[#32e012] transition"
              >
                <span>View My Bookings &rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Main Details & Request View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Charger Info & Map */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl bg-[#181B22] p-6 border border-[#2C303B] shadow-md space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-xs font-black text-primary flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> {charger.powerKw} kW
                  </span>
                  <span className="rounded-lg bg-[#242933] px-2.5 py-1 text-xs font-bold text-slate-300 border border-[#2C303B]">
                    {charger.connectorType}
                  </span>
                  <span className="rounded-lg bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/30">
                    {charger.hostConnectionType === "dedicated_ev"
                      ? "Dedicated EV"
                      : charger.hostConnectionType === "commercial"
                      ? "Commercial"
                      : "Domestic"}
                  </span>
                </div>

                <div className="text-right">
                  <p className="text-xl font-black text-white">
                    ₹{charger.pricePerHour}
                    <span className="text-xs font-normal text-slate-400">/hr</span>
                  </p>
                </div>
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white font-display">
                  {charger.title}
                </h1>
                {charger.notes && (
                  <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#0F1115] p-3 rounded-xl border border-[#2C303B]">
                    {charger.notes}
                  </p>
                )}
              </div>

              {/* Location card: masked until a confirmed booking unlocks the exact address */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {charger.confirmedLocation ? "Exact Location (Unlocked)" : "Approximate Location"}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {charger.confirmedLocation ? "Confirmed booking on this charger" : "Privacy masked pin (~300m)"}
                  </span>
                </div>

                {charger.confirmedLocation && (
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Street address
                      </span>
                      <p className="text-xs font-bold text-white">
                        {charger.confirmedLocation.addressText}
                      </p>
                    </div>
                    <a
                      href={getGoogleMapsDirectionsUrl(
                        charger.confirmedLocation.location.latitude,
                        charger.confirmedLocation.location.longitude
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-black text-black shadow-md shadow-primary/20 transition-all hover:bg-[#32e012]"
                    >
                      Get Directions
                      <span aria-hidden>&rarr;</span>
                    </a>
                  </div>
                )}

                <ApproximateLocationMap
                  approximateLocation={charger.approximateLocation}
                  chargerTitle={charger.title}
                  unlockedLocation={charger.confirmedLocation?.location ?? null}
                  unlockedAddress={charger.confirmedLocation?.addressText ?? null}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Time Slot & Booking Card */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
            <div className="rounded-3xl bg-[#181B22] p-6 border border-[#2C303B] shadow-md space-y-5">
              <h2 className="text-base font-black text-white font-display">
                Booking Details
              </h2>

              {/* Slot Staleness & Pre-Validation Banners */}
              {validation?.isEmergencyRefreshed && (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-xs text-primary space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Zap className="h-4 w-4" strokeWidth={2} aria-hidden /> Emergency Slot Refreshed
                  </p>
                  <p className="text-slate-300">
                    Your slot was refreshed to start in 10 minutes so you have sufficient time to review and confirm.
                  </p>
                </div>
              )}

              {validation?.isStale && (
                <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-xs text-amber-300 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden /> Time Slot Expired
                  </p>
                  <p className="text-slate-300">
                    The scheduled start time has already passed. Please return to search to select an upcoming slot.
                  </p>
                  <Link
                    href="/driver"
                    className="inline-block rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 transition"
                  >
                    Change Time Slot in Search &rarr;
                  </Link>
                </div>
              )}

              {!validation?.isBookable && !validation?.isStale && validation?.errorMessage && (
                <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-xs text-rose-300 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <Ban className="h-4 w-4" strokeWidth={2} aria-hidden /> Slot Unavailable
                  </p>
                  <p className="text-slate-300">{validation.errorMessage}</p>
                  <Link
                    href="/driver"
                    className="inline-block text-xs font-bold text-rose-400 underline underline-offset-2 hover:text-rose-300"
                  >
                    Search other charging points &rarr;
                  </Link>
                </div>
              )}

              {/* Submission Error Banner */}
              {submissionError && (
                <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-xs text-rose-300 space-y-1">
                  <p className="font-bold">Submission Failed</p>
                  <p className="text-slate-300">{submissionError}</p>
                </div>
              )}

              {/* Slot Details Overview */}
              {effectiveSlot ? (
                <div className="rounded-2xl bg-[#0F1115] p-4 border border-[#2C303B] space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Schedule Date</span>
                    <span className="font-bold text-white">
                      {formatISTDate(effectiveSlot.startAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Charging Time (IST)</span>
                    <span className="font-bold text-white">
                      {formatISTTime(effectiveSlot.startAt)} &ndash;{" "}
                      {formatISTTime(effectiveSlot.endAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Duration</span>
                    <span className="font-bold text-white">
                      {validation?.durationMinutes} minutes
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#2C303B] flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Estimated Cost</p>
                      <p className="text-[11px] text-slate-500">
                        {validation?.durationMinutes}m &times; ₹{charger.pricePerHour}/hr
                      </p>
                    </div>
                    <p className="text-xl font-black text-primary">
                      ₹{validation?.estimatedCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#0F1115] p-4 border border-[#2C303B] text-xs text-slate-400">
                  No time slot specified. Please return to search to pick a slot.
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                id="request-booking-btn"
                disabled={
                  !effectiveSlot ||
                  !validation?.isBookable ||
                  isSubmitting ||
                  validation?.isStale
                }
                onClick={handleBookingSubmit}
                className={`w-full rounded-2xl py-4 px-6 text-sm font-black transition flex items-center justify-center gap-2 ${
                  !effectiveSlot ||
                  !validation?.isBookable ||
                  isSubmitting ||
                  validation?.isStale
                    ? "bg-[#242933] text-slate-500 border border-[#2C303B] cursor-not-allowed"
                    : "bg-primary text-black hover:bg-[#32e012] shadow-lg shadow-primary/20 active:scale-[0.99]"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <span>Request Booking</span>
                    {validation?.estimatedCost ? (
                      <span>&bull; ₹{validation.estimatedCost.toFixed(2)}</span>
                    ) : null}
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500">
                You will not be charged now. Payment is handled at the charger upon host confirmation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
