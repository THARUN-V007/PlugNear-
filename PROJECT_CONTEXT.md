# PlugNear: Project Context for AI Agents

**Purpose:** Give every AI coding agent the full picture of the project before it writes anything. Save this as `PROJECT_CONTEXT.md` in the repository root, and paste or attach it at the start of every agent session. Step-by-step task prompts come after this file.

---

## 0. Instructions to the agent (read first)
1. Read this entire file before doing anything.
2. Reply with a short summary of the project in your own words, the role you were assigned (Developer D or Developer H, see section 12), and any questions. Then stop and wait for a step prompt. Do not start building on your own.
3. When a step prompt arrives, do only that step. Do not add extra features, pages or libraries that were not asked for.
4. If a step conflicts with this file, say so and ask instead of guessing.
5. After finishing a step, explain in plain language what you built, which files changed, and how to test it by hand.
6. Anything labelled **ASSUMPTION** is a default the team may change. Follow it unless told otherwise.

---

## 1. What the product is
PlugNear is a web marketplace for renting idle EV charging points. A host (someone who owns a charger, for example at home or at a shop) lists the charger with its location, connector type, power, hourly price and weekly availability. A driver whose battery is running low searches a map for chargers that are compatible with the car and genuinely free for the time needed, sends a booking request, and the host approves or declines. The system guarantees that the same charger can never be double booked.

**Origin story used in the demo:** A driver is stranded on the road with a nearly empty battery and no public station nearby, but a house on the route has an unused charger. PlugNear connects them.

---

## 2. Goal, deadline and how it is graded
- This is a university end-term project: a working, deployed full-stack application, built by a team of two with AI agents. Deadline: 27 Oct 2026.
- It must **NOT** look like a basic CRUD app, a thin API wrapper, a UI-only mock-up or a tutorial clone. The real engineering lives in the availability rules, conflict prevention, booking state machine, distance-ranked search and role-based permissions.
- **Graded areas:** problem understanding (10%), core implementation (25%), engineering and application logic (20%), architecture decisions (15%), user experience and reliability (10%), code quality and structure (10%), deployment and documentation (10%).
- **Required deliverables:** public deployed link, GitHub repo with meaningful commit history from both people, README, no exposed secrets, and a 3 to 5 minute demo video.
- **Priority rule:** depth over feature count. Three workflows that fully work beat ten that half work.

---

## 3. Users and roles

| Role | Who | What they can do |
| :--- | :--- | :--- |
| **Driver** | EV owner who needs to charge | Search chargers, use emergency mode, view charger details, request a booking, see and cancel own bookings |
| **Host** | Person or business with a charger | Create and edit own chargers, set availability windows, approve or decline requests for own chargers, cancel confirmed bookings before they start |

Every account has exactly one role chosen at sign-up. There is no admin role in v1.

---

## 4. Scope

### Core workflows (must work end to end)
1. **Host lists a charger:** location chosen by clicking on a map, connector type, power in kW, price per hour, weekly availability windows, edit and deactivate.
2. **Driver searches:** location, radius, time slot and connector type give a map and list of chargers that are free in that slot, ranked by distance. Includes Emergency mode.
3. **Booking with conflict checking:** driver requests a slot and sees the cost, host approves or declines, bookings move through defined states, overlapping bookings are impossible.

### Should-have (only after the core works)
- **Approximate pin:** drivers see a rounded, approximate location until their booking is confirmed; the exact address and pin appear only after confirmation.
- Cancellation rules (section 8).
- Host connection declaration (section 11).

### Nice-to-have (only if time is left)
- Ratings and reviews, notifications, host earnings summary.

### Out of scope for v1
- Real payments (cost is only calculated and displayed), live charging-session tracking, hardware or smart-socket integration, route-based planning, battery-range calculation, native mobile apps, identity verification, admin panel.

---

## 5. Tech stack (fixed, do not swap without asking)

| Layer | Choice |
| :--- | :--- |
| **Framework** | Next.js (React), one codebase for pages and server logic |
| **Database** | Supabase Postgres, with the PostGIS extension for location queries (fallback: plain distance formula) |
| **Auth** | Supabase Auth, email and password, role stored in a `profiles` table |
| **Maps** | Leaflet with `react-leaflet` and OpenStreetMap tiles (no API key) |
| **Address search**| Nominatim, light use only, optional |
| **Validation** | Zod, same schemas used on client and server |
| **Styling** | Tailwind CSS |
| **Hosting** | Vercel, auto-deploy from the main branch |

Keep dependencies minimal. Ask before adding any library not listed here.

---

## 6. Architecture and folder layout
- Browser pages call server logic (route handlers or server actions). All business rules run on the server. The browser is never trusted for prices, times, roles or ownership.
- The server talks to Supabase. Row-level security in the database is a second layer of defence, not the only one.
- Keep business rules in a separate `rules` folder as small, pure, testable functions, separate from pages and database calls.

### Suggested layout
- `app`: pages and routes grouped by role (driver, host, auth)
- `components`: reusable UI pieces (map, charger card, booking form, status badge)
- `lib/rules`: availability check, overlap check, booking state transitions, cost calculation, search ranking
- `lib/supabase`: client setup for browser and server
- `lib/validation`: Zod schemas
- `supabase`: migrations (database design as versioned files) and seed data
- `docs`: architecture notes and README assets

---

## 7. Data model
- **`profiles`:** `id` (same as auth user id), `name`, `role` (driver or host), `phone` (optional), `created_at`.
- **`chargers`:** `id`, `host_id`, `title`, `address_text` (private), `latitude`, `longitude`, `connector_type`, `power_kw`, `price_per_hour`, `notes`, `host_connection_type` (section 11), `is_active`, `created_at`.
- **`availability_windows`:** `id`, `charger_id`, `day_of_week` (0 to 6), `start_time`, `end_time`. A charger has many windows. Windows must not overlap each other on the same day.
- **`bookings`:** `id`, `charger_id`, `driver_id`, `start_at`, `end_at`, `status`, `total_cost`, `created_at`, `decided_at`.

### Relationships
- A host profile has many chargers.
- A charger has many availability windows and many bookings.
- A driver profile has many bookings.

### Connector types (ASSUMPTION)
Type 2, CCS2, CHAdeMO, Bharat AC-001, Other.

### Conventions
- Timestamps: store all timestamps in UTC.
- Availability windows: in charger's local time (**ASSUMPTION:** single timezone, `Asia/Kolkata`, for the whole app).
- Prices: plain numbers in one currency kept in one constant (**ASSUMPTION:** INR).

---

## 8. Business rules (the heart of the project)
Implement each rule once in `lib/rules`, and reuse everywhere.
1. **Bookable slot:** Valid only if: future, end > start, duration between 30 min and 8 hours in 30-min steps (ASSUMPTION), fits entirely inside one availability window for that day, charger is active.
2. **Overlap:** Two bookings on the same charger overlap if `new_start < existing_end AND new_end > existing_start`. Back-to-back bookings do not overlap.
3. **What blocks a slot:** Only confirmed bookings block a slot (ASSUMPTION). Multiple drivers may have pending requests for the same slot.
4. **Double-booking protection:** When host approves, re-check overlap. Auto-decline any other overlapping pending requests. Database constraint ensures two overlapping confirmed bookings are impossible even on concurrent approval.
5. **Cost:** Duration in hours × charger's price per hour, rounded to 2 decimals. Calculated on server and stored at request time.
6. **Booking states and transitions:**
   - `requested` -> `confirmed` (host approves)
   - `requested` -> `declined` (host declines)
   - `requested` -> `cancelled` (driver cancels)
   - `requested` -> `expired` (slot start time passed without decision)
   - `confirmed` -> `cancelled` (driver or host, only before slot starts)
   - `confirmed` -> `completed` (slot end time passed)
   - *Expiry and completion may be applied lazily upon read; no background job needed.*
7. **Search:** Input: lat, lng, radius (default 10 km ASSUMPTION), time slot, optional connector type. Output: active chargers within radius, connector-compatible, inside availability window, not blocked by confirmed booking, sorted nearest first with distance and price.
8. **Emergency mode:** Slot fixed to now through next 1 hour, no connector filter required, nearest result highlighted. Fall back to manual map click if location denied.
9. **Privacy:** Exact address and exact coordinates visible only to host and driver with confirmed booking. Others see approximate position (fixed deterministic offset of a few hundred metres).

---

## 9. Permissions and security
- Drivers can only view/change their own bookings.
- Hosts can only edit their own chargers and decide bookings for their own chargers.
- Neither role can perform actions of the other. Enforced in server code AND Supabase RLS.
- Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Keep `.env.example`. Real env file must be in `.gitignore`.
- Validate every input on the server with Zod.

---

## 10. Errors and UI states
Handle loading, empty, success, and error states gracefully with human-readable feedback. Usable on phone-sized screen.

---

## 11. Regulatory note and host declaration (should-have)
- Choose connection type: `domestic`, `commercial`, or `dedicated EV connection` (`host_connection_type`).
- Checkbox confirmation regarding electricity provider permission.
- Limitations documented in README.

---

## 12. Team split and ownership
- **Developer D (Driver side):** Search logic & screen, map display, emergency mode, charger details page, booking request form, driver bookings page, and the booking rules module in `lib/rules` (overlap, transitions, cost). Sole owner of `lib/rules`.
- **Developer H (Host side):** Host sign-up flow pages, charger listing form with map picker, availability windows editor, host dashboard for approving/declining requests.
- **Together:** Phase 0 foundation, integration testing, README, deployment, demo video.

---

## 13. Build order
- **Phase 0, shared foundation:** Repo setup, Supabase config, Next.js skeleton, database tables & constraints, auth & roles, seed data, initial Vercel deploy.
- **Developer D steps:** (1) rules module with tests, (2) search function, (3) search screen with map/list/states, (4) emergency mode, (5) charger details & booking request, (6) driver bookings page with cancel.
- **Developer H steps:** (1) host pages & role guard, (2) charger form with map picker, (3) availability editor, (4) edit & deactivate, (5) host dashboard.
- **Phase 2, integration:** End-to-end journey, edge case testing, mobile polish.
- **Phase 3, delivery:** README, video, secret check, submission checklist.

---

## 14. Working rules for agents
- Small, frequent commits on feature branches (`feature/short-description`).
- Readable code, no unapproved libraries or structural changes.
- Never commit secrets.
