"use client";

import { useMemo, useState } from "react";
import { X, Zap } from "lucide-react";
import { DAY_LABELS, validateWeeklyWindows } from "@/lib/rules";
import type { AvailabilityWindowInput } from "@/lib/validation/charger";

interface AvailabilityWindowsEditorProps {
  value: AvailabilityWindowInput[];
  onChange: (windows: AvailabilityWindowInput[]) => void;
  serverError?: string | null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Preset {
  label: string;
  hint: string;
  build: () => AvailabilityWindowInput[];
}

const PRESETS: Preset[] = [
  {
    label: "Every day, all day",
    hint: "06:00 - 22:30",
    build: () =>
      DAYS.map((day) => ({ day_of_week: day, start_time: "06:00", end_time: "22:30" })),
  },
  {
    label: "Weekdays, out of office hours",
    hint: "Mon-Fri 06:00-10:00 and 17:00-22:30",
    build: () =>
      [1, 2, 3, 4, 5].flatMap((day) => [
        { day_of_week: day, start_time: "06:00", end_time: "10:00" },
        { day_of_week: day, start_time: "17:00", end_time: "22:30" },
      ]),
  },
  {
    label: "Shop opening hours",
    hint: "Mon-Sat 09:00-20:00, closed Sunday",
    build: () =>
      [1, 2, 3, 4, 5, 6].map((day) => ({
        day_of_week: day,
        start_time: "09:00",
        end_time: "20:00",
      })),
  },
];

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function sortByDayThenTime(windows: AvailabilityWindowInput[]) {
  return [...windows].sort(
    (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
  );
}

/** "HH:MM" strings compare chronologically as text, which keeps this simple. */
function overlaps(existing: AvailabilityWindowInput, candidate: AvailabilityWindowInput) {
  return (
    candidate.start_time < existing.end_time && candidate.end_time > existing.start_time
  );
}

export default function AvailabilityWindowsEditor({
  value,
  onChange,
  serverError,
}: AvailabilityWindowsEditorProps) {
  const [draftStart, setDraftStart] = useState<Record<number, string>>({});
  const [draftEnd, setDraftEnd] = useState<Record<number, string>>({});
  const [dayFeedback, setDayFeedback] = useState<Record<number, string>>({});

  const windowsByDay = useMemo(() => {
    const grouped: AvailabilityWindowInput[][] = DAYS.map(() => []);
    for (const window of sortByDayThenTime(value)) {
      if (grouped[window.day_of_week]) grouped[window.day_of_week].push(window);
    }
    return grouped;
  }, [value]);

  const validation = useMemo(
    () =>
      validateWeeklyWindows(
        value.map((w) => ({
          dayOfWeek: w.day_of_week,
          startTime: w.start_time,
          endTime: w.end_time,
        }))
      ),
    [value]
  );
  const coveredDays = useMemo(
    () => new Set(value.map((w) => w.day_of_week)).size,
    [value]
  );

  const addWindowForDay = (day: number) => {
    const start = (draftStart[day] ?? "").trim();
    const end = (draftEnd[day] ?? "").trim();

    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
      setDayFeedback((prev) => ({
        ...prev,
        [day]: 'Enter both times as 24-hour "HH:MM", for example 18:30.',
      }));
      return;
    }

    if (end <= start) {
      setDayFeedback((prev) => ({
        ...prev,
        [day]: "The end time must be later than the start time. A window cannot cross midnight.",
      }));
      return;
    }

    const candidate: AvailabilityWindowInput = {
      day_of_week: day,
      start_time: start,
      end_time: end,
    };

    const clash = windowsByDay[day].find((w) => overlaps(w, candidate));
    if (clash) {
      setDayFeedback((prev) => ({
        ...prev,
        [day]: `Overlaps your existing ${clash.start_time}-${clash.end_time} window. Merge them instead.`,
      }));
      return;
    }

    setDayFeedback((prev) => {
      const copy = { ...prev };
      delete copy[day];
      return copy;
    });
    setDraftStart((prev) => ({ ...prev, [day]: "" }));
    setDraftEnd((prev) => ({ ...prev, [day]: "" }));
    onChange(sortByDayThenTime([...value, candidate]));
  };

  const removeWindow = (day: number, index: number) => {
    const target = windowsByDay[day][index];
    if (!target) return;
    onChange(
      sortByDayThenTime(
        value.filter(
          (w) =>
            !(
              w.day_of_week === target.day_of_week &&
              w.start_time === target.start_time &&
              w.end_time === target.end_time
            )
        )
      )
    );
    setDayFeedback((prev) => {
      const copy = { ...prev };
      delete copy[day];
      return copy;
    });
  };

  const applyPreset = (preset: Preset) => {
    const built = sortByDayThenTime(preset.build());
    onChange(built);
    setDayFeedback({});
    setDraftStart({});
    setDraftEnd({});
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            title={preset.hint}
            className="group inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:translate-y-0"
          >
            <Zap className="h-3.5 w-3.5 text-emerald-600 transition-transform duration-200 group-hover:rotate-12" strokeWidth={2.25} aria-hidden />
            {preset.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            onChange([]);
            setDayFeedback({});
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-bold text-slate-500 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Clear all
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {DAYS.map((day) => {
          const dayWindows = windowsByDay[day];
          const feedback = dayFeedback[day];

          return (
            <div
              key={day}
              className={`flex flex-col gap-2 border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 sm:flex-row sm:items-start sm:gap-4 ${
                dayWindows.length > 0 ? "bg-white" : "bg-slate-50/60"
              }`}
            >
              <div className="flex w-24 shrink-0 items-center gap-2 pt-1">
                <span
                  className={`h-2 w-2 rounded-full transition-colors ${
                    dayWindows.length > 0 ? "bg-emerald-500 shadow-2xs shadow-emerald-500/50" : "bg-slate-300"
                  }`}
                  aria-hidden
                />
                <span
                  className={`text-xs font-extrabold uppercase tracking-wide ${
                    dayWindows.length > 0 ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  {DAY_LABELS[day]}
                </span>
              </div>

              <div className="flex-1 space-y-2">
                {dayWindows.length === 0 && !feedback && (
                  <p className="pt-1 text-[11px] font-medium italic text-slate-400">
                    Not available on {DAY_LABELS[day].toLowerCase()}
                  </p>
                )}

                {dayWindows.map((window, index) => (
                  <div
                    key={`${window.start_time}-${window.end_time}-${index}`}
                    className="plugnear-rise flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 py-1 pl-2.5 pr-1 transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <span className="text-xs font-extrabold tabular-nums text-emerald-900">
                      {window.start_time}
                      <span className="mx-1 font-medium text-emerald-500">→</span>
                      {window.end_time}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeWindow(day, index)}
                      aria-label={`Remove ${DAY_LABELS[day]} ${window.start_time} to ${window.end_time} window`}
                      className="grid h-6 w-6 place-items-center rounded-lg text-emerald-700 transition-colors hover:bg-rose-100 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    </button>
                  </div>
                ))}

                {feedback && (
                  <p className="text-[11px] font-bold text-rose-600" role="alert">
                    {feedback}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[day]} window start time`}
                  value={draftStart[day] ?? ""}
                  onChange={(e) =>
                    setDraftStart((prev) => ({ ...prev, [day]: e.target.value }))
                  }
                  className="w-[6.5rem] rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold tabular-nums text-slate-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <span className="text-xs font-bold text-slate-400">to</span>
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[day]} window end time`}
                  value={draftEnd[day] ?? ""}
                  onChange={(e) => setDraftEnd((prev) => ({ ...prev, [day]: e.target.value }))}
                  className="w-[6.5rem] rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold tabular-nums text-slate-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <button
                  type="button"
                  onClick={() => addWindowForDay(day)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-extrabold text-white transition-all duration-200 hover:bg-emerald-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 active:scale-95"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
        <span className="text-slate-600">
          {value.length === 0 ? (
            <span className="font-bold text-rose-600">
              No windows yet - drivers will never see this charger in a search.
            </span>
          ) : (
            <>
              {value.length} window{value.length === 1 ? "" : "s"} across {coveredDays} day
              {coveredDays === 1 ? "" : "s"}
              <span className="text-slate-400"> · times are local (Asia/Kolkata)</span>
            </>
          )}
        </span>
        {!validation.success && value.length > 0 && (
          <span className="text-rose-600" role="alert">
            {validation.error.message}
          </span>
        )}
      </div>

      {serverError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700" role="alert">
          {serverError}
        </p>
      )}
    </div>
  );
}
