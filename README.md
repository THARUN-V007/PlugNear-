# PlugNear

> Peer-to-peer EV charging marketplace connecting stranded or low-battery drivers with idle residential and commercial charging hosts — built on deterministic conflict-free scheduling and PostGIS proximity search.

---

## What is in here

- **Framework & Auth:** Next.js 15 (App Router), Tailwind CSS, Zod validation, Supabase PostgreSQL with PostGIS, and role guards (`driver` vs `host`).
- **Domain Rules Engine (`lib/rules`):** Pure, unit-tested TypeScript for slot validity, availability windows, overlap checking, cost, booking state transitions and privacy masking.
- **Search Engine:** Server-side proximity search (`GET /api/chargers/search`) combining a PostGIS spatial index with the domain rules.
- **Booking Integrity:** `requested → confirmed/declined/cancelled/expired/completed` transitions with an atomic host-approval function and a database exclusion constraint that makes two overlapping confirmed bookings impossible.

---

## Test Accounts (Seed Data)

The seed is intentionally minimal — one host, one driver, two chargers, two bookings — with realistic Bengaluru data instead of placeholder rows.

**Shared dev password:** `Password123!`

| Role | Name | Email | Phone | What they own / hold |
| :--- | :--- | :--- | :--- | :--- |
| **Host** | Manjunath Setty | `host@plugnear.dev` | `+91 98860 41235` | Two chargers in Indiranagar: a 7.4 kW Type 2 home bay (₹85/hr) and a 30 kW CCS2 store point on 100 Feet Road (₹190/hr, closed Sundays) |
| **Driver** | Nithya Rao | `driver@plugnear.dev` | `+91 99001 27654` | One **confirmed** booking tomorrow 18:00–19:30 IST on the home bay, and one **requested** booking awaiting the host's decision |

Both demo slots are computed against tomorrow's Asia/Kolkata calendar day, so they always land inside a real availability window and never conflict with each other.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill it in (never commit the real file — `.gitignore` already excludes it):

```ini
# Browser-safe Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_anon_key

# Server-only credential (NEVER prefix with NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=your_secret_service_role_key
```

---

## Database Setup

1. **Enable Supabase extensions** (Dashboard → Database → Extensions): `postgis`, `btree_gist`, `pgcrypto`.

2. **Apply every migration, in order,** in the SQL Editor. Skipping any one of them breaks a feature at runtime — the app calls these functions and columns directly:

   | Migration | Provides | Used by |
   | :--- | :--- | :--- |
   | `20261026000001_initial_schema.sql` | Tables, enums, exclusion constraint, profile trigger, RLS | Everything |
   | `20261027000001_restrict_charger_privacy.sql` | `public_chargers` view, `search_chargers_nearby()` | Driver search |
   | `20261027000002_get_charger_details.sql` | `get_charger_details_for_driver()`, `is_charger_host()` | Charger details page |
   | `20261027000003_host_approval_atomicity.sql` | `host_approve_booking_atomic()` | Host approve + auto-decline |
   | `20261027000004_add_charger_acknowledgement.sql` | `electricity_permission_acknowledged` column | Host listing form |
   | `20261027000005_fix_profile_bootstrap.sql` | Pinned-search_path `handle_new_user()`, repaired details RPC, profile backfill | **Sign-up (without it every sign-up returns HTTP 500)** |
   | `20261028000001_replace_availability_windows.sql` | `replace_charger_availability_windows()` | Weekly availability editor |
   | `20261028000002_restrict_profile_visibility.sql` | Profiles visible only to counterparties | Privacy |
   | `20261028000003_booking_edge_integrity.sql` | Cross-charger conflict guard, wider auto-decline, duplicate index | Booking integrity |
   | `20261028000004_driver_slot_exclusion.sql` | One confirmed slot per driver, enforced by the database | Booking integrity under concurrency |

3. **Populate seed data** — either path lands on the same rows:
   - **Recommended:** `npm run seed` (uses the Supabase Admin API, idempotent, and retires older bulkier demo accounts).
   - **SQL Editor alternative:** run `supabase/seed.sql`.

4. **Verify the database guardrails:**
   - `supabase/tests/verify_exclusion_constraint.sql` — back-to-back bookings succeed, overlaps fail with `exclusion_violation`.
   - `supabase/tests/verify_privacy_lockdown.sql` — direct client reads of private coordinates are blocked.

---

## Local Development

```bash
npm install
npm run seed     # idempotent
npm test         # 179 unit tests over lib/rules, lib/search, lib/validation, lib/bookings
npm run lint     # tsc --noEmit (no ESLint dependency is installed)
npm run dev
npm run build    # type check + production build
```

---

## Manual Verification Guide (Real Database & API)

### 1. Privacy lockdown

- **Direct table query:** as a signed-in driver, run `supabase.from('chargers').select('address_text, latitude, longitude')` in the console.
  Expected: **0 rows** for any charger where the driver has no confirmed booking.
- **Direct RPC call:** `supabase.rpc('search_chargers_nearby', { ... })`.
  Expected: rejected with `42501: permission denied for function` — execution is granted to `service_role` only.
- **Profile leak check:** `supabase.from('profiles').select('name, phone')` returns your own row plus booking counterparties, not the whole table.

### 2. Search API (`GET /api/chargers/search`)

Sign in as `driver@plugnear.dev`, then:

```text
http://localhost:3000/api/chargers/search?lat=12.9719&lng=77.6412&radius=10&start=<TOMORROW>T04:00:00Z&end=<TOMORROW>T05:30:00Z
```

Seed behaviour matrix:

| Charger | Seed configuration | Slot / filter | Expected |
| :--- | :--- | :--- | :--- |
| Home Bay (Type 2, 7.4 kW) | Weekdays 06:00–10:00 and 17:00–22:30 IST | Tomorrow 04:00–05:30 UTC (09:30–11:00 IST) | **Excluded:** the slot straddles the midday gap, so it fits no single window |
| Home Bay | Confirmed booking 18:00–19:30 IST | Tomorrow 19:30–21:00 IST | **Included:** back-to-back with the confirmed booking is allowed |
| Home Bay | Confirmed booking 18:00–19:30 IST | Tomorrow 18:30–19:00 IST | **Excluded:** overlaps a confirmed booking |
| Store Fast Point (CCS2, 30 kW) | Mon–Sat 08:00–20:00 IST, no Sunday windows | A Sunday slot | **Excluded:** no windows that day |
| Store Fast Point | `connector_type = CCS2` | `connectorType=CCS2` | **Included:** the only CCS2 charger in the seed |

Failure cases (all return a JSON `error.code`, never a stack trace):

| Case | Status | Code |
| :--- | :--- | :--- |
| No session | 401 | `UNAUTHORIZED` |
| Signed in as a host | 403 | `FORBIDDEN_ROLE` |
| Host acting on another host's charger | 404 | `CHARGER_NOT_FOUND` (never 403, to avoid enumeration) |
| Missing or empty `lat`/`lng` | 400 | `INVALID_QUERY_PARAMS` |
| `start` in the past | 400 | `PAST_SLOT` |
| `end` before `start` | 400 | `INVALID_END_TIME` |
| Duration under 30 min / over 8 h | 400 | `DURATION_TOO_SHORT` / `DURATION_TOO_LONG` |
| Duration not on a 30-minute step | 400 | `INVALID_STEP` |
| `radius` > 50 km | 400 | `INVALID_QUERY_PARAMS` |
| Booking collides with a confirmed slot at insert | 409 | `SLOT_BLOCKED` |
| Driver creating a duplicate request for the same slot | 409 | `DUPLICATE_BOOKING` |

### 3. Booking journey

1. Sign in as the driver → search a free slot → **Request Booking** (cost is computed and stored server-side).
2. Sign in as the host → `/host/bookings` → **Approve**. Approval re-runs the rules (charger still active, slot still inside a window, no overlapping confirmation) and then calls `host_approve_booking_atomic()`, which confirms the target and auto-declines overlapping pending requests in one transaction.
3. Back as the driver: the confirmed booking now shows the exact street address and a directions link; the details page map swaps the ~300 m privacy ring for the exact pin.

---

## Design decisions worth knowing

- **Server owns every decision.** Prices, durations, roles, ownership and slot validity are recomputed on the server; the browser is never trusted. RLS is a second layer, not the only one.
- **Business rules live in `lib/rules`** as pure functions with a `Result` type — no database, no React — so they are unit-testable and are reused by pages, route handlers and loaders.
- **Half-open intervals everywhere** (`[start, end)`), so back-to-back bookings are allowed but any overlap is impossible, in TypeScript and in the Postgres exclusion constraint.
- **Only `confirmed` bookings block a slot.** Several drivers may hold pending requests for the same time; the first approval wins and the rest are auto-declined.
- **Privacy is distance-aware too:** the published `distanceKm` is measured from the masked pin, not the true coordinates, so two searches from two origins cannot triangulate a home charger.
- **Lazy state transitions:** expiry and completion are applied when bookings are read, so no background job is needed.

## Known limitations

- No payments: cost is calculated and displayed only, and no money moves.
- No live charging-session tracking, hardware or smart-socket integration.
- Single timezone (`Asia/Kolkata`), single currency (INR), one role per account, no admin role.
- Availability windows may not cross local midnight, so an overnight 22:00–06:00 slot is not expressible yet.
- Host "electricity permission" is a self-declared checkbox; there is no identity or document verification.
- Roles are taken from sign-up metadata, so a profile's role is only as trustworthy as that choice — it cannot be changed afterwards (a DB trigger blocks role edits on an existing profile).
