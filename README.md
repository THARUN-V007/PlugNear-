# PlugNear

> Peer-to-peer EV charging point marketplace connecting stranded or low-battery drivers with idle residential and commercial charging hosts — built with deterministic conflict-free scheduling and PostGIS proximity search.

---

## Shared Foundation (Phase 0) & Search Engine (Developer D)

This repository provides the core architectural foundation and search engine for PlugNear:
- **Framework & Auth:** Next.js (App Router), Tailwind CSS, Zod validation, Supabase PostgreSQL with PostGIS, and role guards (`driver` vs `host`).
- **Domain Rules Engine (`lib/rules`):** Pure TypeScript business logic for slot validity, availability windows, overlap checking, cost calculations, state transitions, and privacy masking.
- **Search Engine:** Server-side proximity search (`GET /api/chargers/search`) combining PostGIS spatial indexing with domain rules.

---

## Test Accounts (Seed Data)

All test accounts share a dev password:

- **Shared Dev Password:** `Password123!`

| Role | Name | Email | Phone | Seed Role Details |
| :--- | :--- | :--- | :--- | :--- |
| **Host** | Arun Host | `host1@plugnear.local` | `+91 98450 11111` | Owns Chargers 1 (Fast Hub), 2 (Home Plug), and 5 (Inactive) |
| **Host** | Priya Host | `host2@plugnear.local` | `+91 98450 22222` | Owns Chargers 3 (Defence Colony) and 4 (Double Rd Commercial) |
| **Driver** | Rahul Driver | `driver1@plugnear.local` | `+91 98450 33333` | Has confirmed booking on Charger 1 tomorrow 10:00–11:30 UTC |
| **Driver** | Sneha Driver | `driver2@plugnear.local` | `+91 98450 44444` | Has confirmed booking on Charger 1 tomorrow 11:30–13:00 UTC |

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Populate the following variables (values must never be committed to Git):

```ini
# Supabase browser-safe credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase server-only credentials (NEVER prefix with NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

## Seed Test Accounts (Single Source of Truth)

All seeded test accounts share the development password: **`Password123!`**

| Role | Name | Email | Password | Phone | Redirect on Login |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Driver** | Vikram Driver | `driver1@plugnear.dev` | `Password123!` | +91 98450 33333 | `/driver` |
| **Driver** | Ananya Driver | `driver2@plugnear.dev` | `Password123!` | +91 98450 44444 | `/driver` |
| **Host** | Arun Host | `host1@plugnear.dev` | `Password123!` | +91 98450 11111 | `/host` |
| **Host** | Priya Host | `host2@plugnear.dev` | `Password123!` | +91 98450 22222 | `/host` |

---

## Database Migrations & Seed Data

1. **Enable Supabase Extensions** in the Supabase Dashboard under **Database -> Extensions**:
   - `postgis`
   - `btree_gist`
   - `pgcrypto`

2. **Apply Migrations in SQL Editor (in sequence):**
   - **Migration 1:** Run `supabase/migrations/20261026000001_initial_schema.sql` (Creates core tables, enums, triggers, exclusion constraints).
   - **Migration 2:** Run `supabase/migrations/20261027000001_restrict_charger_privacy.sql` (Restricts base table RLS, creates `public_chargers` safe view, and introduces server-only PostGIS search function `search_chargers_nearby`).

3. **Populate Seed Data:**
   - **Automated Script (Recommended):** Run `npm run seed` locally to idempotently create/update test accounts, chargers, schedules, and test bookings using the Supabase Admin API.
   - **SQL Editor Alternative:** Run `supabase/seed.sql` directly in the Supabase SQL Editor.

4. **Run Database Verification Tests:**
   - Run `supabase/tests/verify_exclusion_constraint.sql` (Verifies back-to-back bookings succeed and overlaps fail with `exclusion_violation`).
   - Run `supabase/tests/verify_privacy_lockdown.sql` (Verifies direct client table reads of private coordinates are blocked).

---

## Local Development & Testing

```bash
# 1. Install dependencies
npm install

# 2. Populate / refresh seed data (idempotent)
npm run seed

# 3. Run unit tests
npm test

# 4. Start local development server
npm run dev
```

---

## Manual Verification Guide (Real Database & API)

### 1. Manual Privacy Lockdown Test
Run `supabase/tests/verify_privacy_lockdown.sql` in the Supabase SQL Editor, or test via the Supabase browser client:
- **Direct Table Query:** Sign in as a driver in the browser and run `supabase.from('chargers').select('address_text, latitude, longitude')`.
  - **Expected Result:** Returns **0 rows** for any charger where the driver does not have a confirmed booking.
- **Direct RPC Query:** Run `supabase.rpc('search_chargers_nearby', { ... })`.
  - **Expected Result:** Rejected by the database with `42501: permission denied for function search_chargers_nearby` because execution is granted strictly to `service_role`.

---

### 2. Manual Search API Test (`GET /api/chargers/search`)

Log in as `driver1@plugnear.dev` in your browser, then call the search endpoint with query parameters:

```text
http://localhost:3000/api/chargers/search?lat=12.9719&lng=77.6412&radius=10&start=<TOMORROW_DATE>T10:00:00Z&end=<TOMORROW_DATE>T11:00:00Z
```

#### Seed Chargers Exclusion Matrix:
| Charger | Seed Configuration | Slot / Filter Tested | Expected Outcome & Reason |
| :--- | :--- | :--- | :--- |
| **Charger 5** (CMH Rd DC) | `is_active = false` | Any search | **Excluded:** Inactive chargers never appear in search. |
| **Charger 1** (100ft Rd Hub) | Confirmed booking: Tomorrow 10:00–11:30 UTC | Slot: Tomorrow 10:00–11:00 UTC | **Excluded:** Overlaps with confirmed booking by Driver 1. |
| **Charger 1** (100ft Rd Hub) | Confirmed booking ends at 13:00 UTC | Slot: Tomorrow 13:00–14:00 UTC | **Included:** Back-to-back with confirmed booking; non-blocking pending booking ignored. |
| **Charger 3** (Defence Colony) | Windows: 06:00–12:00, 16:00–22:00 IST | Slot: Tomorrow 08:00–09:30 UTC (13:30–15:00 IST) | **Excluded:** Falls in afternoon gap outside availability windows. |
| **Charger 4** (Double Rd AC) | Connector: `Bharat AC-001` | Query with `connectorType=Bharat AC-001` | **Included:** Only charger matching this specific connector. |

#### Auth & Input Validation Failure Cases:
- **Logged Out / No Session:** Returns `401 Unauthorized` (`UNAUTHORIZED`).
- **Host User:** Log in as `host1@plugnear.dev` and call the endpoint &rarr; Returns `403 Forbidden` (`FORBIDDEN_ROLE`).
- **Past Start Time:** Pass past timestamp for `start` &rarr; Returns `400 Bad Request` (`PAST_SLOT`).
- **End Before Start:** Pass `end < start` &rarr; Returns `400 Bad Request` (`INVALID_END_TIME`).
- **Invalid Duration:** Pass duration of 15 minutes or 9 hours &rarr; Returns `400 Bad Request` (`DURATION_TOO_SHORT` / `DURATION_TOO_LONG`).
- **Radius > 50 km:** Pass `radius=100` &rarr; Returns `400 Bad Request` (`INVALID_QUERY_PARAMS`).

---

## Verification & Build

```bash
# Verify types and production build
npm run build
```
