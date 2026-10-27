"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  Check,
  Clock,
  Copy,
  Info,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import {
  DAY_NAMES,
  VALID_START_TIMES,
  VALID_END_TIMES,
  validateWeeklyEditorSchedule,
  editorScheduleToDatabaseRows,
  databaseRowsToEditorSchedule,
  findConfirmedBookingsOutsideNewSchedule,
  applyMondayToWeekdays,
  applyDayToAllDays,
  getPresetSchedule,
  createEmptySchedule,
  type WeeklyEditorSchedule,
  type DatabaseAvailabilityRow,
  type ConflictingBookingNotice,
} from "@/lib/availability/availability-helpers";
import type { BookingRecord } from "@/lib/rules";

interface WeeklyAvailabilityEditorProps {
  chargerId: string;
  chargerTitle: string;
  initialWindows: DatabaseAvailabilityRow[];
  upcomingConfirmedBookings: BookingRecord[];
}

export default function WeeklyAvailabilityEditor({
  chargerId,
  chargerTitle,
  initialWindows,
  upcomingConfirmedBookings,
}: WeeklyAvailabilityEditorProps) {
  const router = useRouter();
  const idPrefix = useId();

  const [schedule, setSchedule] = useState<WeeklyEditorSchedule>(() =>
    databaseRowsToEditorSchedule(initialWindows)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Real-time pure validation
  const validation = validateWeeklyEditorSchedule(schedule);

  // Check if upcoming confirmed bookings fall outside new schedule
  const conflictingBookings: ConflictingBookingNotice[] =
    findConfirmedBookingsOutsideNewSchedule(
      upcomingConfirmedBookings,
      schedule,
      chargerId
    );

  // Window modifiers
  const handleAddWindow = (day: number) => {
    setSaveSuccess(false);
    setErrorMessage(null);
    setSchedule((prev) => {
      const dayWindows = prev[day] || [];
      const defaultStart = dayWindows.length > 0 ? "14:00" : "09:00";
      const defaultEnd = dayWindows.length > 0 ? "18:00" : "17:00";
      return {
        ...prev,
        [day]: [
          ...dayWindows,
          {
            id: `${day}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            startTime: defaultStart,
            endTime: defaultEnd,
          },
        ],
      };
    });
  };

  const handleRemoveWindow = (day: number, windowId: string) => {
    setSaveSuccess(false);
    setErrorMessage(null);
    setSchedule((prev) => ({
      ...prev,
      [day]: (prev[day] || []).filter((w) => w.id !== windowId),
    }));
  };

  const handleTimeChange = (
    day: number,
    windowId: string,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setSaveSuccess(false);
    setErrorMessage(null);
    setSchedule((prev) => ({
      ...prev,
      [day]: (prev[day] || []).map((w) =>
        w.id === windowId ? { ...w, [field]: value } : w
      ),
    }));
  };

  const handleClearDay = (day: number) => {
    setSaveSuccess(false);
    setErrorMessage(null);
    setSchedule((prev) => ({
      ...prev,
      [day]: [],
    }));
  };

  const handleApplyMondayToWeekdays = () => {
    setSaveSuccess(false);
    setErrorMessage(null);
    setSchedule((prev) => applyMondayToWeekdays(prev));
  };

  const handleApplyDayToAll = (sourceDay: number) => {
    setSaveSuccess(false);
    setErrorMessage(null);
    setSchedule((prev) => applyDayToAllDays(prev, sourceDay));
  };

  const handleApplyPreset = (
    preset: "weekdays_9_to_5" | "all_week_daytime" | "all_week_extended"
  ) => {
    setSaveSuccess(false);
    setErrorMessage(null);
    setSchedule(getPresetSchedule(preset));
  };

  const handleClearAll = () => {
    setSaveSuccess(false);
    setErrorMessage(null);
    setSchedule(createEmptySchedule());
  };

  const handleInitiateSave = () => {
    if (!validation.valid) {
      setErrorMessage("Please fix the validation errors before saving.");
      return;
    }

    // If there are conflicting confirmed bookings, show modal first
    if (conflictingBookings.length > 0) {
      setShowConflictModal(true);
      return;
    }

    executeSave();
  };

  const executeSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);
    setShowConflictModal(false);

    try {
      const rows = editorScheduleToDatabaseRows(schedule, chargerId);
      const res = await fetch(`/api/host/chargers/${chargerId}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows: rows }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(
          data?.error?.message || "Failed to update availability schedule."
        );
        setIsSaving(false);
        return;
      }

      setSaveSuccess(true);
      setIsSaving(false);
      router.refresh();
    } catch {
      setErrorMessage("Network error: Could not reach the server.");
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2C303B] pb-5">
        <div>
          <Link
            href="/host/chargers"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            <span>Back to My Chargers</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
              Weekly Availability
            </h1>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/30">
              Asia/Kolkata (IST)
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Configure the open hours drivers can book at{" "}
            <span className="font-bold text-slate-200">&ldquo;{chargerTitle}&rdquo;</span>.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            disabled={isSaving || !validation.valid}
            onClick={handleInitiateSave}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-black text-black shadow-lg shadow-primary/20 hover:bg-[#32e012] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span>Saving Hours...</span>
            ) : (
              <>
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                <span>Save Schedule</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. End Time & Rule Guidelines Notice */}
      <div className="rounded-2xl border border-cyan-800/40 bg-cyan-950/20 p-3.5 text-xs text-cyan-200 flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" aria-hidden />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-bold">Timing Note: </span>
          <span>
            Slots are configured in 30-minute intervals. The latest available end time is{" "}
            <strong className="text-white">11:30 PM (23:30)</strong> so charging sessions never cross midnight.
          </span>
        </div>
      </div>

      {/* 3. Empty Schedule Warning */}
      {validation.isEmpty && (
        <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-xs text-amber-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" strokeWidth={1.75} aria-hidden />
          <div className="space-y-1">
            <span className="font-bold text-sm block text-amber-300">
              No Availability Windows Scheduled
            </span>
            <p className="text-amber-200/90 leading-relaxed">
              This charger currently has 0 hours configured. It will be hidden from driver searches and Emergency mode until you add at least one availability window.
            </p>
          </div>
        </div>
      )}

      {/* 4. Conflicting Confirmed Bookings Advisory Banner */}
      {conflictingBookings.length > 0 && (
        <div className="rounded-2xl border border-rose-800/80 bg-rose-950/30 p-4 text-xs text-rose-200 flex items-start gap-3">
          <CalendarCheck2 className="h-5 w-5 shrink-0 text-rose-400" strokeWidth={1.75} aria-hidden />
          <div className="flex-1 space-y-1">
            <span className="font-bold text-sm block text-rose-300">
              {conflictingBookings.length} Upcoming Confirmed Reservation{conflictingBookings.length > 1 ? "s" : ""} Outside New Hours
            </span>
            <p className="text-rose-200/90 leading-relaxed">
              Your proposed schedule will not cover existing bookings on this charger. Existing bookings are NOT cancelled, but drivers will arrive outside your newly set hours.
            </p>
            <ul className="mt-2 space-y-1 pl-2 border-l-2 border-rose-700/50">
              {conflictingBookings.slice(0, 3).map((c) => (
                <li key={c.bookingId} className="text-[11px] text-rose-300">
                  • {c.dayName} ({c.localDate}) at {c.localTime}
                </li>
              ))}
              {conflictingBookings.length > 3 && (
                <li className="text-[11px] text-rose-400 italic">
                  + {conflictingBookings.length - 3} more
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* 5. Success and Error Feedback */}
      {saveSuccess && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-xs font-semibold text-primary flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
            Availability schedule saved successfully! Your charging point hours are updated.
          </span>
          <button
            type="button"
            onClick={() => setSaveSuccess(false)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-xs font-semibold text-rose-300 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* 6. Shortcuts & Quick Presets Bar */}
      <div className="rounded-3xl border border-[#2C303B] bg-[#181B22] p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Sparkles className="h-4 w-4 text-cyan-400" aria-hidden />
          <span>Quick Schedule Presets &amp; Tools</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleApplyPreset("weekdays_9_to_5")}
            className="rounded-xl border border-[#2C303B] bg-[#242933] px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-[#2e3442] hover:text-white transition"
          >
            Weekdays (9 AM – 5 PM)
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("all_week_daytime")}
            className="rounded-xl border border-[#2C303B] bg-[#242933] px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-[#2e3442] hover:text-white transition"
          >
            All Week (6 AM – 10 PM)
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("all_week_extended")}
            className="rounded-xl border border-[#2C303B] bg-[#242933] px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-[#2e3442] hover:text-white transition"
          >
            All Week Extended (6 AM – 11:30 PM)
          </button>

          <button
            type="button"
            onClick={handleApplyMondayToWeekdays}
            className="rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/40 transition"
          >
            Apply Monday to Weekdays
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            className="rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-900/30 transition ml-auto"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* 7. Seven Day Rows (Sunday 0 to Saturday 6) */}
      <div className="space-y-4">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const dayName = DAY_NAMES[day];
          const windows = schedule[day] || [];
          const dayErrors = validation.errorsByDay[day] || [];
          const hasErrors = dayErrors.length > 0;

          return (
            <div
              key={day}
              className={`rounded-3xl border bg-[#181B22] p-4 sm:p-5 transition shadow-sm ${
                hasErrors
                  ? "border-rose-800 ring-1 ring-rose-800/40"
                  : "border-[#2C303B]"
              }`}
            >
              {/* Day Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#2C303B]">
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm font-black text-white font-display">
                    {dayName}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      windows.length > 0
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-[#242933] text-slate-500 border border-[#2C303B]"
                    }`}
                  >
                    {windows.length} {windows.length === 1 ? "window" : "windows"}
                  </span>
                </div>

                {/* Day level shortcuts */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {windows.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApplyDayToAll(day)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-cyan-300 transition py-1"
                        title={`Copy ${dayName}'s schedule to all other 6 days`}
                      >
                        <Copy className="h-3 w-3" aria-hidden />
                        <span>Copy to All Days</span>
                      </button>

                      <span className="text-slate-600">|</span>

                      <button
                        type="button"
                        onClick={() => handleClearDay(day)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-rose-400 transition py-1"
                      >
                        Clear Day
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAddWindow(day)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition ml-2"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    <span>Add Window</span>
                  </button>
                </div>
              </div>

              {/* Day Windows List */}
              <div className="pt-4 space-y-3">
                {windows.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">
                    Closed all day (no availability configured).
                  </p>
                ) : (
                  windows.map((w, idx) => (
                    <div
                      key={w.id}
                      className="flex flex-wrap items-center gap-3 bg-[#0F1115] p-3 rounded-2xl border border-[#2C303B]"
                    >
                      <span className="text-xs font-mono font-bold text-slate-500 w-6">
                        #{idx + 1}
                      </span>

                      {/* Start Time Select */}
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`${idPrefix}-day-${day}-win-${idx}-start`}
                          className="sr-only"
                        >
                          {dayName} Window {idx + 1} Start Time
                        </label>
                        <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden />
                        <select
                          id={`${idPrefix}-day-${day}-win-${idx}-start`}
                          value={w.startTime}
                          onChange={(e) =>
                            handleTimeChange(day, w.id, "startTime", e.target.value)
                          }
                          className="rounded-xl border border-[#2C303B] bg-[#181B22] px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary plugnear-tabular"
                        >
                          {VALID_START_TIMES.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="text-xs font-bold text-slate-500">to</span>

                      {/* End Time Select */}
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`${idPrefix}-day-${day}-win-${idx}-end`}
                          className="sr-only"
                        >
                          {dayName} Window {idx + 1} End Time
                        </label>
                        <select
                          id={`${idPrefix}-day-${day}-win-${idx}-end`}
                          value={w.endTime}
                          onChange={(e) =>
                            handleTimeChange(day, w.id, "endTime", e.target.value)
                          }
                          className="rounded-xl border border-[#2C303B] bg-[#181B22] px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary plugnear-tabular"
                        >
                          {VALID_END_TIMES.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Delete Window Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveWindow(day, w.id)}
                        className="rounded-xl p-2 text-slate-500 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800 transition ml-auto"
                        title="Delete window"
                        aria-label={`Delete ${dayName} window ${idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ))
                )}

                {/* Day Validation Messages */}
                {hasErrors && (
                  <div className="space-y-1 pt-1">
                    {dayErrors.map((err, errIdx) => (
                      <p
                        key={errIdx}
                        className="text-xs font-semibold text-rose-400 flex items-center gap-1.5"
                      >
                        <span>•</span> {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 8. Bottom Sticky Save Bar */}
      <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-[#2C303B] bg-[#181B22]/95 backdrop-blur-md p-4 sm:p-5 shadow-2xl">
        <div className="text-xs text-slate-400">
          <span>Total scheduled windows across the week: </span>
          <strong className="text-white font-black">{validation.totalWindows}</strong>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/host/chargers"
            className="rounded-xl border border-[#2C303B] bg-[#242933] px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-[#2e3442] hover:text-white transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={isSaving || !validation.valid}
            onClick={handleInitiateSave}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-black text-black shadow-lg shadow-primary/20 hover:bg-[#32e012] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving Hours..." : "Save Weekly Schedule"}
          </button>
        </div>
      </div>

      {/* 9. Conflicting Confirmed Bookings Confirmation Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#181B22] p-6 shadow-2xl border border-rose-800 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-7 w-7 text-rose-400 shrink-0" strokeWidth={1.5} aria-hidden />
              <div>
                <h3 className="text-base font-black text-white font-display">
                  Confirmed Bookings Fall Outside Updated Hours
                </h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  You have <strong className="text-rose-300">{conflictingBookings.length}</strong> upcoming confirmed driver reservation(s) that will no longer fit inside your newly selected availability hours:
                </p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-2xl bg-[#0F1115] p-3 border border-[#2C303B] space-y-2 text-xs">
              {conflictingBookings.map((b) => (
                <div
                  key={b.bookingId}
                  className="flex items-center justify-between text-slate-300 py-1 border-b border-[#2C303B] last:border-none"
                >
                  <span className="font-bold text-white">{b.dayName} ({b.localDate})</span>
                  <span className="plugnear-tabular text-slate-400">{b.localTime}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed bg-[#0F1115] p-3 rounded-xl border border-[#2C303B]">
              <strong className="text-slate-200">Note:</strong> Existing bookings will NOT be cancelled or altered automatically. However, drivers have already reserved these times. Are you sure you want to save this schedule anyway?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="rounded-xl border border-[#2C303B] bg-[#242933] px-4 py-2 text-xs font-bold text-slate-300 hover:bg-[#2e3442] transition"
              >
                Back to Editing
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={executeSave}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white shadow-md hover:bg-rose-700 transition"
              >
                {isSaving ? "Saving..." : "Confirm & Save Anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
