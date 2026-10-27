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
            className="group inline-flex items-center gap-1.5 rounded-full border border-[#2C303B] bg-[#242933] px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Zap className="h-3.5 w-3.5 text-cyan-400 transition-transform duration-200 group-hover:rotate-12" strokeWidth={2.25} aria-hidden />
            {preset.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            onChange([]);
            setDayFeedback({});
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:border-rose-800 hover:bg-rose-950/40 hover:text-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Clear all
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2C303B] bg-[#181B22]">
        {DAYS.map((day) => {
          const dayWindows = windowsByDay[day];
          const feedback = dayFeedback[day];

          return (
            <div
              key={day}
              className={`flex flex-col gap-2 border-b border-[#2C303B] px-4 py-3 transition-colors last:border-b-0 sm:flex-row sm:items-start sm:gap-4 ${
                dayWindows.length > 0 ? "bg-[#181B22]" : "bg-[#0F1115]/50"
              }`}
            >
              <div className="flex w-24 shrink-0 items-center gap-2 pt-1">
                <span
                  className={`h-2 w-2 rounded-full transition-colors ${
                    dayWindows.length > 0 ? "bg-primary shadow-[0_0_8px_rgba(57,255,20,0.6)]" : "bg-slate-600"
                  }`}
                  aria-hidden
                />
                <span
                  className={`text-xs font-black uppercase tracking-wide ${
                    dayWindows.length > 0 ? "text-slate-100" : "text-slate-500"
                  }`}
                >
                  {DAY_LABELS[day]}
                </span>
              </div>

              <div className="flex-1 space-y-2">
                {dayWindows.length === 0 && !feedback && (
                  <p className="pt-1 text-[11px] font-medium italic text-slate-500">
                    Not available on {DAY_LABELS[day].toLowerCase()}
                  </p>
                )}

                {dayWindows.map((window, index) => (
                  <div
                    key={`${window.start_time}-${window.end_time}-${index}`}
                    className="flex w-fit items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-1 pl-2.5 pr-1 transition-all duration-200"
                  >
                    <span className="text-xs font-black tabular-nums text-primary">
                      {window.start_time}
                      <span className="mx-1 font-medium text-slate-400">→</span>
                      {window.end_time}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeWindow(day, index)}
                      aria-label={`Remove ${DAY_LABELS[day]} ${window.start_time} to ${window.end_time} window`}
                      className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-950/60 hover:text-rose-400 focus:outline-none"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    </button>
                  </div>
                ))}

                {feedback && (
                  <p className="text-[11px] font-bold text-rose-400" role="alert">
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
                  className="w-[6.5rem] rounded-lg border border-[#2C303B] bg-[#0F1115] px-2 py-1.5 text-xs font-semibold tabular-nums text-slate-100 transition-colors focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
                <span className="text-xs font-bold text-slate-500">to</span>
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[day]} window end time`}
                  value={draftEnd[day] ?? ""}
                  onChange={(e) => setDraftEnd((prev) => ({ ...prev, [day]: e.target.value }))}
                  className="w-[6.5rem] rounded-lg border border-[#2C303B] bg-[#0F1115] px-2 py-1.5 text-xs font-semibold tabular-nums text-slate-100 transition-colors focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => addWindowForDay(day)}
                  className="rounded-lg bg-cyan-500 px-3 py-1.5 text-[11px] font-black text-black transition hover:bg-cyan-400 focus:outline-none"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
        <span className="text-slate-400">
          {value.length === 0 ? (
            <span className="font-bold text-rose-400">
              No windows yet - drivers will never see this charger in a search.
            </span>
          ) : (
            <>
              {value.length} window{value.length === 1 ? "" : "s"} across {coveredDays} day
              {coveredDays === 1 ? "" : "s"}
              <span className="text-slate-500"> · times are local (Asia/Kolkata)</span>
            </>
          )}
        </span>
        {!validation.success && value.length > 0 && (
          <span className="text-rose-400" role="alert">
            {validation.error.message}
          </span>
        )}
      </div>

      {serverError && (
        <p className="rounded-xl border border-rose-800 bg-rose-950/40 px-3 py-2 text-[11px] font-bold text-rose-300" role="alert">
          {serverError}
        </p>
      )}
    </div>
  );
}
