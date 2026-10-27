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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2C303B] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-800/60 bg-cyan-950/40 px-3 py-1 text-xs font-semibold text-cyan-300">
            <Zap className="h-4 w-4" strokeWidth={2.25} aria-hidden /> Host Operations
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-display">
            Booking Requests &amp; Reservations
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Review incoming driver requests, confirm slots, and manage reservations for your charging points.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-[#2C303B] bg-[#181B22] px-3.5 py-2 text-xs font-bold text-slate-400 shadow-sm transition hover:border-slate-600 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <span>↻</span> Refresh
        </button>
      </div>

      {/* 2. Navigation Tabs with Count Badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#2C303B]">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "pending"
              ? "bg-amber-500/20 text-amber-300 border border-amber-700/50"
              : "bg-[#181B22] text-slate-400 border border-[#2C303B] hover:border-slate-600 hover:text-slate-200"
          }`}
        >
          <span>⏳ Pending Requests</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
              activeTab === "pending"
                ? "bg-amber-500/30 text-amber-200"
                : "bg-amber-900/40 text-amber-400"
            }`}
          >
            {grouped.pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "upcoming"
              ? "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30"
              : "bg-[#181B22] text-slate-400 border border-[#2C303B] hover:border-slate-600 hover:text-slate-200"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><CalendarCheck2 className="h-3.5 w-3.5" aria-hidden /> Upcoming Confirmed</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
              activeTab === "upcoming"
                ? "bg-[#39FF14]/20 text-[#39FF14]"
                : "bg-[#2C303B] text-slate-400"
            }`}
          >
            {grouped.upcomingConfirmed.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("past")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "past"
              ? "bg-slate-700/50 text-slate-200 border border-slate-600"
              : "bg-[#181B22] text-slate-400 border border-[#2C303B] hover:border-slate-600 hover:text-slate-200"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Archive className="h-3.5 w-3.5" aria-hidden /> Past History</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
              activeTab === "past"
                ? "bg-slate-600/50 text-slate-300"
                : "bg-[#2C303B] text-slate-400"
            }`}
          >
            {grouped.past.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "all"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-700/50"
              : "bg-[#181B22] text-slate-400 border border-[#2C303B] hover:border-slate-600 hover:text-slate-200"
          }`}
        >
          <span>All</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
              activeTab === "all"
                ? "bg-cyan-700/50 text-cyan-200"
                : "bg-[#2C303B] text-slate-400"
            }`}
          >
            {initialBookings.length}
          </span>
        </button>
      </div>

      {/* 3. Bookings List or Empty State */}
      {displayList.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#2C303B] bg-panel p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F1115] border border-[#2C303B] text-slate-500">
            {activeTab === "pending" ? (
              <Inbox className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            ) : activeTab === "upcoming" ? (
              <CalendarCheck2 className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            ) : (
              <Archive className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            )}
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-100">
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
