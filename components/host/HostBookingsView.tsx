"use client";

import { useState } from "react";
import { Archive, CalendarCheck2, ClipboardList, Inbox, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type HostBookingItem,
  groupHostBookings,
} from "@/lib/bookings/host-bookings-helpers";
import HostBookingCard from "./HostBookingCard";

interface HostBookingsViewProps {
  initialBookings: HostBookingItem[];
  /** Server-render instant, shared with every card so approve/cancel states do not flicker on hydration. */
  serverNow: string;
}

type TabType = "pending" | "upcoming" | "past" | "all";

export default function HostBookingsView({
  initialBookings,
  serverNow,
}: HostBookingsViewProps) {
  const router = useRouter();
  const grouped = groupHostBookings(initialBookings);

  // Default to pending if there are pending requests, otherwise upcoming
  const defaultTab: TabType = grouped.pendingCount > 0 ? "pending" : "upcoming";
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  const handleActionComplete = () => {
    router.refresh();
  };

  const getDisplayList = (): HostBookingItem[] => {
    switch (activeTab) {
      case "pending":
        return grouped.pending;
      case "upcoming":
        return grouped.upcomingConfirmed;
      case "past":
        return grouped.past;
      case "all":
        return initialBookings;
      default:
        return grouped.pending;
    }
  };

  const displayList = getDisplayList();

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 border border-cyan-200">
            <Zap className="h-5 w-5" strokeWidth={2.25} aria-hidden /> Host Operations
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Booking Requests & Reservations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review incoming driver requests, confirm slots, and manage reservations for your charging points.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <span>↻</span> Refresh
        </button>
      </div>

      {/* 2. Navigation Tabs with Count Badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "pending"
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>⏳ Pending Requests</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
              activeTab === "pending"
                ? "bg-amber-600 text-white"
                : "bg-amber-200 text-amber-900"
            }`}
          >
            {grouped.pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "upcoming"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><CalendarCheck2 className="h-3.5 w-3.5" aria-hidden /> Upcoming Confirmed</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
              activeTab === "upcoming"
                ? "bg-emerald-700 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {grouped.upcomingConfirmed.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("past")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "past"
              ? "bg-slate-800 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Archive className="h-3.5 w-3.5" aria-hidden /> Past History</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
              activeTab === "past"
                ? "bg-slate-700 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {grouped.past.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "all"
              ? "bg-cyan-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>All</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
              activeTab === "all"
                ? "bg-cyan-700 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {initialBookings.length}
          </span>
        </button>
      </div>

      {/* 3. Bookings List or Empty State */}
      {displayList.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            {activeTab === "pending" ? (
              <Inbox className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            ) : activeTab === "upcoming" ? (
              <CalendarCheck2 className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            ) : (
              <Archive className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            )}
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            {activeTab === "pending"
              ? "No Pending Requests"
              : activeTab === "upcoming"
              ? "No Upcoming Confirmed Bookings"
              : activeTab === "past"
              ? "No Past Bookings"
              : "No Bookings Found"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === "pending"
              ? "All caught up! Incoming booking requests from EV drivers will appear here for your review."
              : activeTab === "upcoming"
              ? "You do not have any upcoming confirmed bookings right now."
              : activeTab === "past"
              ? "Past, cancelled, and concluded charging sessions will be archived here."
              : "No booking reservations have been recorded for your chargers yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayList.map((booking) => (
            <HostBookingCard
              key={booking.id}
              booking={booking}
              serverNow={serverNow}
              onActionComplete={handleActionComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
