import { describe, it, expect } from "vitest";
import {
  createEmptySchedule,
  validateWeeklyEditorSchedule,
  editorScheduleToDatabaseRows,
  databaseRowsToEditorSchedule,
  summarizeSchedule,
  findConfirmedBookingsOutsideNewSchedule,
  applyMondayToWeekdays,
  applyDayToAllDays,
  getPresetSchedule,
  type WeeklyEditorSchedule,
} from "../availability-helpers";
import type { BookingRecord } from "@/lib/rules";

describe("Host Weekly Availability Editor Helpers (Pure Unit Tests)", () => {
  describe("Schedule Validation", () => {
    it("accepts a completely valid weekly schedule with clean 30-minute steps", () => {
      const schedule = createEmptySchedule();
      schedule[1] = [
        { id: "1", startTime: "09:00", endTime: "12:00" },
        { id: "2", startTime: "14:00", endTime: "18:00" },
      ];
      schedule[2] = [{ id: "3", startTime: "10:00", endTime: "17:30" }];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(true);
      expect(result.allErrors).toHaveLength(0);
      expect(result.isEmpty).toBe(false);
      expect(result.totalWindows).toBe(3);
    });

    it("accepts an empty schedule and flags it as empty with no errors", () => {
      const schedule = createEmptySchedule();
      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(true);
      expect(result.isEmpty).toBe(true);
      expect(result.totalWindows).toBe(0);
      expect(result.allErrors).toHaveLength(0);
    });

    it("rejects a window where end time is before start time", () => {
      const schedule = createEmptySchedule();
      schedule[1] = [{ id: "1", startTime: "14:00", endTime: "10:00" }];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.errorsByDay[1].length).toBeGreaterThan(0);
      expect(result.allErrors[0]).toContain("End time must be strictly after start time");
    });

    it("rejects a window where end time equals start time", () => {
      const schedule = createEmptySchedule();
      schedule[3] = [{ id: "1", startTime: "11:00", endTime: "11:00" }];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.errorsByDay[3].length).toBeGreaterThan(0);
      expect(result.allErrors[0]).toContain("End time must be strictly after start time");
    });

    it("rejects a window that crosses midnight", () => {
      const schedule = createEmptySchedule();
      schedule[5] = [{ id: "1", startTime: "22:00", endTime: "02:00" }];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.allErrors[0]).toContain("cannot cross midnight");
    });

    it("rejects overlapping windows on the same day", () => {
      const schedule = createEmptySchedule();
      schedule[2] = [
        { id: "1", startTime: "09:00", endTime: "13:00" },
        { id: "2", startTime: "11:30", endTime: "15:00" },
      ];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.errorsByDay[2].some((e) => e.includes("overlap"))).toBe(true);
    });

    it("rejects touching windows on the same day and instructs to merge them", () => {
      const schedule = createEmptySchedule();
      schedule[4] = [
        { id: "1", startTime: "09:00", endTime: "12:00" },
        { id: "2", startTime: "12:00", endTime: "16:00" },
      ];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.errorsByDay[4].some((e) => e.includes("touch back-to-back"))).toBe(true);
    });

    it("rejects non-30-minute times", () => {
      const schedule = createEmptySchedule();
      schedule[1] = [{ id: "1", startTime: "09:15", endTime: "12:45" }];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.allErrors.some((e) => e.includes("30-minute steps"))).toBe(true);
    });

    it("rejects window shorter than 30 minutes", () => {
      const schedule = createEmptySchedule();
      // Even if someone manually passed non-30 mins like 09:00 - 09:15
      schedule[1] = [{ id: "1", startTime: "09:00", endTime: "09:15" }];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.allErrors.some((e) => e.includes("at least 30 minutes"))).toBe(true);
    });

    it("rejects window ending beyond 23:30", () => {
      const schedule = createEmptySchedule();
      schedule[0] = [{ id: "1", startTime: "20:00", endTime: "23:59" }];

      const result = validateWeeklyEditorSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.allErrors.some((e) => e.includes("23:30"))).toBe(true);
    });
  });

  describe("Conversion Between Editor Format and Database Rows", () => {
    it("converts editor schedule to normalized sorted database rows", () => {
      const schedule = createEmptySchedule();
      schedule[2] = [{ id: "tue-1", startTime: "14:00", endTime: "18:00" }];
      schedule[1] = [
        { id: "mon-2", startTime: "13:00", endTime: "17:00" },
        { id: "mon-1", startTime: "08:00", endTime: "11:00" },
      ];

      const rows = editorScheduleToDatabaseRows(schedule, "charger-xyz");
      expect(rows).toHaveLength(3);

      // Should be sorted by day ascending, then start_time
      expect(rows[0]).toEqual({
        charger_id: "charger-xyz",
        day_of_week: 1,
        start_time: "08:00",
        end_time: "11:00",
      });
      expect(rows[1]).toEqual({
        charger_id: "charger-xyz",
        day_of_week: 1,
        start_time: "13:00",
        end_time: "17:00",
      });
      expect(rows[2]).toEqual({
        charger_id: "charger-xyz",
        day_of_week: 2,
        start_time: "14:00",
        end_time: "18:00",
      });
    });

    it("converts database rows to editor schedule correctly", () => {
      const dbRows = [
        { id: "r1", day_of_week: 1, start_time: "06:00:00", end_time: "10:00:00" },
        { id: "r2", day_of_week: 1, start_time: "17:00:00", end_time: "22:30:00" },
        { id: "r3", day_of_week: 5, start_time: "08:00", end_time: "20:00" },
      ];

      const schedule = databaseRowsToEditorSchedule(dbRows);
      expect(schedule[1]).toHaveLength(2);
      expect(schedule[1][0].startTime).toBe("06:00");
      expect(schedule[1][0].endTime).toBe("10:00");
      expect(schedule[1][1].startTime).toBe("17:00");
      expect(schedule[1][1].endTime).toBe("22:30");

      expect(schedule[5]).toHaveLength(1);
      expect(schedule[5][0].startTime).toBe("08:00");
      expect(schedule[5][0].endTime).toBe("20:00");

      // Other days empty
      expect(schedule[0]).toHaveLength(0);
      expect(schedule[2]).toHaveLength(0);
      expect(schedule[3]).toHaveLength(0);
      expect(schedule[4]).toHaveLength(0);
      expect(schedule[6]).toHaveLength(0);
    });
  });

  describe("Schedule Summary", () => {
    it("summarizes empty schedule clearly", () => {
      const schedule = createEmptySchedule();
      expect(summarizeSchedule(schedule)).toBe("No availability schedule set");
    });

    it("summarizes single day schedule", () => {
      const schedule = createEmptySchedule();
      schedule[1] = [{ id: "1", startTime: "09:00", endTime: "17:00" }];
      expect(summarizeSchedule(schedule)).toBe("Mon: 09:00 - 17:00");
    });

    it("summarizes consecutive days with identical hours concisely", () => {
      const schedule = createEmptySchedule();
      for (let day = 1; day <= 5; day++) {
        schedule[day] = [{ id: `${day}`, startTime: "09:00", endTime: "17:00" }];
      }
      expect(summarizeSchedule(schedule)).toBe("Mon-Fri: 09:00 - 17:00");
    });

    it("summarizes mixed schedules with multiple range segments", () => {
      const schedule = createEmptySchedule();
      for (let day = 1; day <= 5; day++) {
        schedule[day] = [{ id: `${day}`, startTime: "09:00", endTime: "17:00" }];
      }
      schedule[6] = [{ id: "sat", startTime: "10:00", endTime: "14:00" }];

      const summary = summarizeSchedule(schedule);
      expect(summary).toContain("Mon-Fri: 09:00 - 17:00");
      expect(summary).toContain("Sat: 10:00 - 14:00");
    });
  });

  describe("Counting Confirmed Bookings Outside New Schedule", () => {
    const TARGET_CHARGER_ID = "target-charger-1";
    const OTHER_CHARGER_ID = "other-charger-2";

    // 2026-10-28 is a Wednesday (day_of_week = 3).
    // In Asia/Kolkata (+05:30):
    // 04:30 UTC = 10:00 AM IST
    // 06:30 UTC = 12:00 PM IST
    const wednesdayBookingConfirmed: BookingRecord = {
      id: "b1",
      chargerId: TARGET_CHARGER_ID,
      driverId: "d1",
      startAt: new Date("2026-10-28T04:30:00Z"), // 10:00 IST
      endAt: new Date("2026-10-28T06:30:00Z"),   // 12:00 IST
      status: "confirmed",
    };

    it("flags nothing when confirmed booking falls entirely inside new window", () => {
      const schedule = createEmptySchedule();
      // Wednesday: 09:00 to 13:00 IST encloses 10:00 to 12:00
      schedule[3] = [{ id: "w1", startTime: "09:00", endTime: "13:00" }];

      const conflicts = findConfirmedBookingsOutsideNewSchedule(
        [wednesdayBookingConfirmed],
        schedule,
        TARGET_CHARGER_ID
      );
      expect(conflicts).toHaveLength(0);
    });

    it("flags booking when it falls partly outside the new window (window starts too late)", () => {
      const schedule = createEmptySchedule();
      // Wednesday: 10:30 to 13:00 (booking starts at 10:00, so 10:00-10:30 is outside)
      schedule[3] = [{ id: "w1", startTime: "10:30", endTime: "13:00" }];

      const conflicts = findConfirmedBookingsOutsideNewSchedule(
        [wednesdayBookingConfirmed],
        schedule,
        TARGET_CHARGER_ID
      );
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].bookingId).toBe("b1");
      expect(conflicts[0].dayName).toBe("Wednesday");
    });

    it("flags booking when it falls partly outside the new window (window ends too early)", () => {
      const schedule = createEmptySchedule();
      // Wednesday: 09:00 to 11:30 (booking ends at 12:00, so 11:30-12:00 is outside)
      schedule[3] = [{ id: "w1", startTime: "09:00", endTime: "11:30" }];

      const conflicts = findConfirmedBookingsOutsideNewSchedule(
        [wednesdayBookingConfirmed],
        schedule,
        TARGET_CHARGER_ID
      );
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].bookingId).toBe("b1");
    });

    it("flags booking when the day has no windows at all (fully outside)", () => {
      const schedule = createEmptySchedule(); // Wednesday has 0 windows

      const conflicts = findConfirmedBookingsOutsideNewSchedule(
        [wednesdayBookingConfirmed],
        schedule,
        TARGET_CHARGER_ID
      );
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].bookingId).toBe("b1");
    });

    it("ignores bookings on other chargers completely", () => {
      const otherChargerBooking: BookingRecord = {
        ...wednesdayBookingConfirmed,
        id: "b-other",
        chargerId: OTHER_CHARGER_ID,
      };

      const schedule = createEmptySchedule(); // Empty schedule on target charger

      const conflicts = findConfirmedBookingsOutsideNewSchedule(
        [otherChargerBooking],
        schedule,
        TARGET_CHARGER_ID
      );
      expect(conflicts).toHaveLength(0);
    });

    it("ignores non-confirmed bookings (requested/declined/cancelled) even if they fall outside", () => {
      const pendingBooking: BookingRecord = {
        ...wednesdayBookingConfirmed,
        id: "b-pending",
        status: "requested",
      };

      const schedule = createEmptySchedule();

      const conflicts = findConfirmedBookingsOutsideNewSchedule(
        [pendingBooking],
        schedule,
        TARGET_CHARGER_ID
      );
      expect(conflicts).toHaveLength(0);
    });
  });

  describe("Shortcuts and Presets", () => {
    it("applies Monday hours to all weekdays (Tue-Fri)", () => {
      const schedule = createEmptySchedule();
      schedule[1] = [{ id: "m1", startTime: "08:30", endTime: "16:30" }];

      const applied = applyMondayToWeekdays(schedule);
      for (let day = 1; day <= 5; day++) {
        expect(applied[day]).toHaveLength(1);
        expect(applied[day][0].startTime).toBe("08:30");
        expect(applied[day][0].endTime).toBe("16:30");
      }
      expect(applied[0]).toHaveLength(0); // Sunday unchanged
      expect(applied[6]).toHaveLength(0); // Saturday unchanged
    });

    it("applies source day hours to all 7 days", () => {
      const schedule = createEmptySchedule();
      schedule[6] = [{ id: "sat1", startTime: "10:00", endTime: "18:00" }];

      const applied = applyDayToAllDays(schedule, 6);
      for (let day = 0; day <= 6; day++) {
        expect(applied[day]).toHaveLength(1);
        expect(applied[day][0].startTime).toBe("10:00");
        expect(applied[day][0].endTime).toBe("18:00");
      }
    });

    it("generates preset weekday 9 to 5 correctly", () => {
      const preset = getPresetSchedule("weekdays_9_to_5");
      expect(preset[0]).toHaveLength(0);
      expect(preset[6]).toHaveLength(0);
      for (let day = 1; day <= 5; day++) {
        expect(preset[day][0].startTime).toBe("09:00");
        expect(preset[day][0].endTime).toBe("17:00");
      }
    });

    it("generates preset all week daytime correctly", () => {
      const preset = getPresetSchedule("all_week_daytime");
      for (let day = 0; day <= 6; day++) {
        expect(preset[day][0].startTime).toBe("06:00");
        expect(preset[day][0].endTime).toBe("22:00");
      }
    });

    it("generates preset all week extended up to 23:30 correctly", () => {
      const preset = getPresetSchedule("all_week_extended");
      for (let day = 0; day <= 6; day++) {
        expect(preset[day][0].startTime).toBe("06:00");
        expect(preset[day][0].endTime).toBe("23:30");
      }
    });
  });
});
