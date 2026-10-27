# PlugNear Booking Rules Engine (`lib/rules`)

## 1. Ownership & Architecture Notice
- **Sole Owner:** **Developer D (Driver side & Rules Engine)**.
- **Contract:** Developer H and all application layers (search, booking requests, host approval workflows) call these functions. **Developer H must never edit this folder directly.**
- **Pure Functions:** Zero database queries, zero network calls, zero framework dependencies, and zero internal clock calls (`now` is always explicitly injected for complete determinism).
- **Result Pattern:** Functions return `{ success: true, data: T }` or `{ success: false, error: { code: string, message: string } }` instead of throwing exceptions for business logic violations.

---

## 2. Functions Reference

### A. Slot Validation (`lib/rules/slot-validation.ts`)
- **`validateSlot(slot: TimeSlot, now: Date | string): Result<ValidatedSlotDetails>`**
  - Verifies that `slot.startAt` is in the future relative to `now`.
  - Verifies that `slot.endAt` is strictly after `slot.startAt`.
  - Enforces minimum duration of 30 minutes and maximum duration of 8 hours (480 minutes).
  - Enforces 30-minute step increments (`durationMinutes % 30 === 0`).
  - Returns calculated `durationMinutes` and `durationHours`.

### B. Availability Check (`lib/rules/availability.ts`)
- **`checkAvailability(slot: TimeSlot, charger: ChargerAvailabilityInfo): Result<AvailabilityWindow>`**
  - Rejects inactive chargers (`isActive === false`).
  - Converts slot start and end to `Asia/Kolkata` local calendar days.
  - Rejects slots crossing local midnight.
  - Finds a single window on that local day of the week (0 = Sunday to 6 = Saturday) that entirely encloses the slot (`window.start <= slot.start` and `slot.end <= window.end`). Boundary equality (e.g. ending exactly at window end) is accepted.

### C. Overlap Checking & Auto-Decline (`lib/rules/overlap.ts`)
- **`doRangesOverlap(a: TimeSlot, b: TimeSlot): boolean`**
  - Evaluates half-open intervals `[start, end)`: `a.start < b.end && a.end > b.start`.
  - Back-to-back intervals (`[10:00, 11:00)` and `[11:00, 12:00)`) return `false` (no overlap).
- **`checkSlotOverlap(slot: TimeSlot, existingBookings: BookingRecord[], chargerId?: string): Result<{}>`**
  - Filters existing bookings for `status === 'confirmed'`. Only confirmed bookings block slots; pending (`requested`) requests do not block.
  - Returns error `SLOT_BLOCKED` if an overlap with any confirmed booking is found.
- **`findConflictingPendingBookings(confirmedBooking: BookingRecord, allBookingsOnCharger: BookingRecord[]): BookingRecord[]`**
  - Given a newly confirmed booking, identifies all other pending (`requested`) bookings on the same charger that overlap it and must be auto-declined.
  - *Note:* This auto-decline rule is mirrored at the database level in the SQL function `public.host_approve_booking_atomic` (`supabase/migrations/20261027000003_host_approval_atomicity.sql`). If the auto-decline criteria or interval definition are ever modified, they must be changed in both places to preserve atomicity and consistency.

### D. Cost Calculation (`lib/rules/cost.ts`)
- **`calculateBookingCost(durationMinutes: number, pricePerHour: number): Result<BookingCostDetails>`**
  - Validates non-negative hourly rate (`>= 0`) and strictly positive duration (`> 0`).
  - Computes `(durationMinutes / 60) * pricePerHour`.
  - Rounds deterministically to two decimal places in Indian Rupees (`APP_CURRENCY = 'INR'`).

### E. Booking State Machine (`lib/rules/state-machine.ts`)
- **`transitionBooking(params: TransitionParams): Result<TransitionResult>`**
  - Enforces valid status transitions with strict actor and role validation:
    - `requested` &rarr; `confirmed` (Actor: Host of that charger, only before slot starts).
    - `requested` &rarr; `declined` (Actor: Host of that charger).
    - `requested` &rarr; `cancelled` (Actor: Driver who created the request).
    - `requested` &rarr; `expired` (Actor: System, only after slot start time has passed).
    - `confirmed` &rarr; `cancelled` (Actor: Driver or Host, strictly before slot start time).
    - `confirmed` &rarr; `completed` (Actor: System, only after slot end time has passed).
  - Strictly rejects transitions out of terminal states (`declined`, `cancelled`, `expired`, `completed`).
- **`refreshBookingStatuses(bookings: BookingRecord[], now: Date | string): StatusRefreshResult`**
  - Evaluates bookings lazily upon read to mark past-due `requested` bookings as `expired` and completed `confirmed` bookings as `completed`.

### F. Privacy & Approximate Location (`lib/rules/privacy.ts`)
- **`canViewExactLocation(viewer: Actor, charger: { hostId: string }, userBookings?: BookingRecord[]): boolean`**
  - Returns `true` if viewer is the charger host.
  - Returns `true` if viewer is a driver with a `confirmed` booking on this charger.
  - Returns `false` for all other drivers (including drivers with only `requested` bookings).
- **`getApproximateCoordinates(chargerId: string, exact: GeoPoint): GeoPoint`**
  - Computes a deterministic pseudo-random offset based on an FNV-1a hash of `chargerId`.
  - Shifts coordinates by ~200m to 350m radius.
  - Guarantees the pin position is 100% stable across repeated calls and never jumps between page reloads.
- **`calculateHaversineDistance(a: GeoPoint, b: GeoPoint): number`**
  - Great-circle distance calculation in meters.

### G. Timezone Utilities (`lib/rules/timezone.ts`)
- **`toKolkataLocalDetails(utcDateOrIso: Date | string): LocalTimeDetails`**
  - Converts UTC instants to `Asia/Kolkata` local calendar date (`YYYY-MM-DD`), day of week (0–6), and minutes from midnight.
- **`timeStringToMinutes(timeStr: string): number`**
  - Parses `"HH:MM"` or `"HH:MM:SS"` to minutes from midnight (0–1440).

---

## 3. Error Codes Reference

| Error Code | Meaning |
| :--- | :--- |
| `PAST_SLOT` | Requested start time is in the past relative to `now`. |
| `INVALID_END_TIME` | End time is before or equal to start time. |
| `DURATION_TOO_SHORT` | Slot duration is under 30 minutes. |
| `DURATION_TOO_LONG` | Slot duration exceeds 8 hours (480 minutes). |
| `INVALID_STEP` | Slot duration is not an increment of 30 minutes. |
| `INVALID_DATE_FORMAT` | Date string could not be parsed into a valid timestamp. |
| `CHARGER_INACTIVE` | Charger has `isActive = false` and cannot be booked. |
| `CROSSES_MIDNIGHT` | Slot crosses local midnight in `Asia/Kolkata`. |
| `OUTSIDE_AVAILABILITY` | Slot falls outside the host's availability window for that day. |
| `SLOT_BLOCKED` | Slot overlaps with an existing `confirmed` booking. |
| `INVALID_PRICE` | Hourly price is negative or NaN. |
| `INVALID_DURATION` | Duration is non-positive or NaN. |
| `UNAUTHORIZED_ACTOR` | User or role is not authorized to trigger this state transition. |
| `INVALID_TRANSITION` | Transition is not allowed by the booking lifecycle. |
| `TERMINAL_STATE` | Attempted to modify a booking already in a terminal state. |
| `CANNOT_CANCEL_STARTED` | A confirmed booking cannot be cancelled after its start time. |

---

## 4. Key Assumptions
1. **Timezone:** Single application timezone: `Asia/Kolkata` (+05:30, `APP_TIMEZONE_OFFSET_MS = 19,800,000`).
2. **Currency:** Single currency: Indian Rupee (`APP_CURRENCY = 'INR'`).
3. **Day of Week:** Standard JavaScript & PostgreSQL convention where `0 = Sunday`, `1 = Monday`, ..., `6 = Saturday`.
4. **Availability Windows:** Windows belong to a single calendar day (00:00 to 23:59) and do not cross midnight.
5. **Conflict Blocking:** Only `confirmed` bookings block search and slot booking. Multiple drivers may have concurrent `requested` slots for the same charger.
6. **Cancellation Horizon:** Drivers and hosts may cancel confirmed bookings at any time strictly before `booking.startAt`.
7. **Approximate Pin Offset:** 200m to 350m deterministic displacement derived from hashing `chargerId`.
