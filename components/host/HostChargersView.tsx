"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HostChargerListItem } from "@/lib/chargers/host-chargers-helpers";
import ChargerCard from "./ChargerCard";

interface HostChargersViewProps {
  initialChargers: HostChargerListItem[];
  savedNotification?: boolean;
}

type FilterTab = "all" | "active" | "inactive";

export default function HostChargersView({
  initialChargers,
  savedNotification = false,
}: HostChargersViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showSavedBanner, setShowSavedBanner] = useState(savedNotification);

  const activeCount = initialChargers.filter((c) => c.isActive).length;
  const inactiveCount = initialChargers.length - activeCount;

  const filteredChargers = initialChargers.filter((c) => {
    if (filter === "active") return c.isActive;
    if (filter === "inactive") return !c.isActive;
    return true;
  });

  const handleStatusToggled = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with "Add New Charger" Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            ⚡ Charging Points Management
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            My Charging Points
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            List, edit, and configure availability for your peer-to-peer EV chargers.
          </p>
        </div>

        <Link
          href="/host/chargers/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 self-start sm:self-auto"
        >
          <span>＋</span> Add New Charger
        </Link>
      </div>

      {/* Success Notification Banner */}
      {showSavedBanner && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <span>Charging point saved successfully!</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSavedBanner(false)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            filter === "all"
              ? "bg-purple-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>All Chargers</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              filter === "all" ? "bg-purple-700 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {initialChargers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("active")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            filter === "active"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>⚡ Active</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              filter === "active" ? "bg-emerald-700 text-white" : "bg-emerald-200 text-emerald-900"
            }`}
          >
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("inactive")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            filter === "inactive"
              ? "bg-slate-800 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>Deactivated</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              filter === "inactive" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {inactiveCount}
          </span>
        </button>
      </div>

      {/* 3. Chargers Grid or Empty State */}
      {filteredChargers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-2xl text-purple-700">
            🔌
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            {filter === "all"
              ? "No Charging Points Listed"
              : filter === "active"
              ? "No Active Chargers"
              : "No Deactivated Chargers"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {filter === "all"
              ? "You haven't listed any charging points yet. Add your first home socket or commercial charger to begin receiving driver requests."
              : filter === "active"
              ? "All your chargers are currently deactivated."
              : "None of your chargers are currently deactivated."}
          </p>
          {filter === "all" && (
            <Link
              href="/host/chargers/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-purple-700"
            >
              <span>＋</span> List Your First Charger
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredChargers.map((c) => (
            <ChargerCard key={c.id} charger={c} onStatusToggled={handleStatusToggled} />
          ))}
        </div>
      )}
    </div>
  );
}
