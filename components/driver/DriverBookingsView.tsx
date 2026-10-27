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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2C303B] pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight font-display">
            My Charging Bookings
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track your charging requests, view confirmed locations, and manage upcoming slots.
          </p>
        </div>

        <Link
          href="/driver"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-black shadow-lg shadow-primary/20 hover:bg-[#32e012] transition shrink-0"
        >
          <span>Search Chargers</span>
          <span>&rarr;</span>
        </Link>
      </div>

      {/* 2. Tabs: Upcoming vs Past */}
      <div className="flex items-center gap-2 border-b border-[#2C303B]">
        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === "upcoming"
              ? "border-primary text-primary"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span>Upcoming</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-black ${
              activeTab === "upcoming"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-[#181B22] text-slate-400 border border-[#2C303B]"
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
              ? "border-primary text-primary"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span>Past</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-black ${
              activeTab === "past"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-[#181B22] text-slate-400 border border-[#2C303B]"
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
        <div className="rounded-3xl bg-[#181B22] p-8 sm:p-12 border border-[#2C303B] text-center space-y-4">
          <PlugZap className="h-10 w-10 text-slate-600 mx-auto" strokeWidth={1.5} aria-hidden />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              {activeTab === "upcoming"
                ? "No Upcoming Reservations"
                : "No Past Reservations"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
              {activeTab === "upcoming"
                ? "You don't have any active charging sessions or pending requests right now."
                : "You don't have any completed, cancelled, or expired charging history."}
            </p>
          </div>

          {activeTab === "upcoming" && (
            <div className="pt-2">
              <Link
                href="/driver"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-black text-black shadow-lg shadow-primary/20 hover:bg-[#32e012] transition"
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
