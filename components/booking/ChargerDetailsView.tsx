"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SafeChargerDetails, SlotPreValidation } from "@/lib/bookings/charger-loader";
import { toKolkataLocalDetails, type AvailabilityWindow } from "@/lib/rules";

const ApproximateLocationMap = dynamic(
  () => import("./ApproximateLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 sm:h-72 w-full rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center text-xs text-slate-400 border border-slate-200">
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
    } catch (err: any) {
      setSubmissionError("Network error: Could not reach the server. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link
          href="/driver"
          className="hover:text-emerald-700 transition flex items-center gap-1"
        >
          &larr; Back to Search
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-bold">Charger Details</span>
        {isEmergency && (
          <span className="ml-2 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-amber-300">
            Emergency Mode
          </span>
        )}
      </div>

      {/* 2. Success Confirmation Panel */}
      {confirmedBooking ? (
        <div className="rounded-3xl border-2 border-emerald-500 bg-emerald-50/60 p-6 sm:p-8 shadow-md space-y-6 animate-in fade-in duration-300">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-md shrink-0">
              ✓
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                Status: Requested
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Booking Request Submitted!
              </h2>
              <p className="text-sm text-slate-600">
                The host has been notified. They must confirm your request before the booking is finalized.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-emerald-200/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Booking Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">Charging Point</p>
                <p className="font-bold text-slate-900">{charger.title}</p>
                <p className="text-xs text-slate-500">
                  {charger.powerKw} kW &bull; {charger.connectorType}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Reserved Slot (IST)</p>
                <p className="font-bold text-slate-900">
                  {formatISTDate(confirmedBooking.startAt)}
                </p>
                <p className="text-xs text-slate-600">
                  {formatISTTime(confirmedBooking.startAt)} &ndash;{" "}
                  {formatISTTime(confirmedBooking.endAt)} (
                  {validation?.durationMinutes} mins)
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Total Estimated Cost</p>
                <p className="text-lg font-black text-emerald-700">
                  ₹{Number(confirmedBooking.totalCost).toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400">
                  ₹{charger.pricePerHour}/hr &bull; Payable at charging point
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Location Security</p>
                <p className="text-xs text-slate-600 font-medium">
                  Exact street address and driving directions unlock as soon as the host confirms.
                </p>
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <Link
              href="/driver"
              className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 text-center transition"
            >
              &larr; Return to Search
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/driver/bookings"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
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
            <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    ⚡ {charger.powerKw} kW
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200">
                    {charger.connectorType}
                  </span>
                  <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                    {charger.hostConnectionType === "dedicated_ev"
                      ? "Dedicated EV"
                      : charger.hostConnectionType === "commercial"
                      ? "Commercial"
                      : "Domestic"}
                  </span>
                </div>

                <div className="text-right">
                  <p className="text-xl font-black text-slate-900">
                    ₹{charger.pricePerHour}
                    <span className="text-xs font-normal text-slate-500">/hr</span>
                  </p>
                </div>
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  {charger.title}
                </h1>
                {charger.notes && (
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {charger.notes}
                  </p>
                )}
              </div>

              {/* Approximate Map */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Approximate Location
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Privacy masked pin (~300m)
                  </span>
                </div>

                <ApproximateLocationMap
                  approximateLocation={charger.approximateLocation}
                  chargerTitle={charger.title}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Time Slot & Booking Card */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
            <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-5">
              <h2 className="text-base font-black text-slate-900">
                Booking Details
              </h2>

              {/* Slot Staleness & Pre-Validation Banners */}
              {validation?.isEmergencyRefreshed && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚡</span> Emergency Slot Refreshed
                  </p>
                  <p className="text-slate-600">
                    Your slot was refreshed to start in 10 minutes so you have sufficient time to review and confirm.
                  </p>
                </div>
              )}

              {validation?.isStale && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Time Slot Expired
                  </p>
                  <p className="text-slate-600">
                    The scheduled start time has already passed. Please return to search to select an upcoming slot.
                  </p>
                  <Link
                    href="/driver"
                    className="inline-block rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
                  >
                    Change Time Slot in Search &rarr;
                  </Link>
                </div>
              )}

              {!validation?.isBookable && !validation?.isStale && validation?.errorMessage && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⛔</span> Slot Unavailable
                  </p>
                  <p>{validation.errorMessage}</p>
                  <Link
                    href="/driver"
                    className="inline-block text-xs font-bold text-rose-900 underline underline-offset-2 hover:text-rose-700"
                  >
                    Search other charging points &rarr;
                  </Link>
                </div>
              )}

              {/* Submission Error Banner */}
              {submissionError && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800 space-y-1">
                  <p className="font-bold">Submission Failed</p>
                  <p>{submissionError}</p>
                </div>
              )}

              {/* Slot Details Overview */}
              {effectiveSlot ? (
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Schedule Date</span>
                    <span className="font-bold text-slate-900">
                      {formatISTDate(effectiveSlot.startAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Charging Time (IST)</span>
                    <span className="font-bold text-slate-900">
                      {formatISTTime(effectiveSlot.startAt)} &ndash;{" "}
                      {formatISTTime(effectiveSlot.endAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Duration</span>
                    <span className="font-bold text-slate-900">
                      {validation?.durationMinutes} minutes
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Estimated Cost</p>
                      <p className="text-[11px] text-slate-400">
                        {validation?.durationMinutes}m &times; ₹{charger.pricePerHour}/hr
                      </p>
                    </div>
                    <p className="text-xl font-black text-emerald-700">
                      ₹{validation?.estimatedCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-500">
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
                className={`w-full rounded-2xl py-4 px-6 text-sm font-black transition shadow-sm flex items-center justify-center gap-2 ${
                  !effectiveSlot ||
                  !validation?.isBookable ||
                  isSubmitting ||
                  validation?.isStale
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99] shadow-emerald-600/20"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
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

              <p className="text-[11px] text-center text-slate-400">
                You will not be charged now. Payment is handled at the charger upon host confirmation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
