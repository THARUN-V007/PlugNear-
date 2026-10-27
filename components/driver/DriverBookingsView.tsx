"use client";

import { useState } from "react";
import { PlugZap } from "lucide-react";
import Link from "next/link";
import {
  type DriverBookingItem,
  groupDriverBookings,
} from "@/lib/bookings/driver-bookings-helpers";
import BookingCard from "./BookingCard";

interface DriverBookingsViewProps {
  initialBookings: DriverBookingItem[];
  /**
   * Instant captured while rendering on the server. Cancellability is a function
   * of "now", so both cards and hydration must agree on the same clock or React
   * reports a markup mismatch and the button flickers.
   */
  serverNow: string;
}

export default function DriverBookingsView({
  initialBookings,
  serverNow,
}: DriverBookingsViewProps) {
  const [bookings, setBookings] = useState<DriverBookingItem[]>(initialBookings);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  const { upcoming, past } = groupDriverBookings(bookings);

  const handleBookingCancelled = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
    );
  };

  const displayedBookings = activeTab === "upcoming" ? upcoming : past;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            My Charging Bookings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track your charging requests, view confirmed locations, and manage upcoming slots.
          </p>
        </div>

        <Link
          href="/driver"
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition shrink-0"
        >
          <span>Search Chargers</span>
          <span>&rarr;</span>
        </Link>
      </div>

      {/* 2. Tabs: Upcoming vs Past */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === "upcoming"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Upcoming</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-black ${
              activeTab === "upcoming"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {upcoming.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("past")}
          className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === "past"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Past</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-black ${
              activeTab === "past"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {past.length}
          </span>
        </button>
      </div>

      {/* 3. Bookings List or Empty State */}
      {displayedBookings.length > 0 ? (
        <div className="space-y-4">
          {displayedBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              serverNow={serverNow}
              onBookingCancelled={handleBookingCancelled}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-8 sm:p-12 border border-slate-200 text-center space-y-4 shadow-xs">
          <PlugZap className="h-10 w-10 text-slate-300" strokeWidth={1.5} aria-hidden />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {activeTab === "upcoming"
                ? "No Upcoming Reservations"
                : "No Past Reservations"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              {activeTab === "upcoming"
                ? "You don't have any active charging sessions or pending requests right now."
                : "You don't have any completed, cancelled, or expired charging history."}
            </p>
          </div>

          {activeTab === "upcoming" && (
            <div className="pt-2">
              <Link
                href="/driver"
                className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                <span>Find Nearby Chargers</span>
                <span>&rarr;</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
