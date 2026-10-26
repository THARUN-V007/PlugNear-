# PlugNear

> Peer-to-peer EV charging point marketplace connecting stranded or low-battery drivers with idle residential and commercial charging hosts — built with deterministic conflict-free scheduling and PostGIS proximity search.

---

## Shared Foundation (Phase 0)

This repository provides the core architectural foundation for PlugNear. It includes Next.js App Router, Tailwind CSS, Zod validation, Supabase PostgreSQL with PostGIS, role-based authentication (Driver vs. Host), and database-level exclusion constraints preventing overlapping bookings.

---

## Test Accounts (Seed Data)

All test accounts share a dev password:

- **Shared Dev Password:** `Password123!`

| Role | Name | Email | Phone | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Host** | Arun Host | `host1@plugnear.local` | `+91 98450 11111` | Owns 3 chargers in Indiranagar |
| **Host** | Priya Host | `host2@plugnear.local` | `+91 98450 22222` | Owns 2 chargers in Indiranagar |
| **Driver** | Rahul Driver | `driver1@plugnear.local` | `+91 98450 33333` | Has confirmed booking on Charger 1 |
| **Driver** | Sneha Driver | `driver2@plugnear.local` | `+91 98450 44444` | Has back-to-back & pending bookings |

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

## Database Migrations & Seed Data

1. **Enable Supabase Extensions** in the Supabase Dashboard under **Database -> Extensions**:
   - `postgis`
   - `btree_gist`
   - `pgcrypto`

2. **Apply Initial Migration:**
   - Open **SQL Editor** in your Supabase project.
   - Run the contents of `supabase/migrations/20261026000001_initial_schema.sql`.

3. **Populate Seed Data:**
   - In **SQL Editor**, run the contents of `supabase/seed.sql`.
   - Seeds 2 hosts, 2 drivers, 5 chargers in Indiranagar (Bengaluru), weekly availability windows, and sample confirmed/conflicting bookings.

4. **Verify Database Exclusion Constraint:**
   - In **SQL Editor**, run `supabase/tests/verify_exclusion_constraint.sql`.
   - Confirms back-to-back bookings succeed and overlapping confirmed bookings fail with `exclusion_violation`.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Sign in with a driver account -> automatically directed to `/driver`.
- Sign in with a host account -> automatically directed to `/host`.
- Attempting to cross boundaries redirects to the proper role home with an access restriction notice.

---

## Verification & Build

```bash
# Compile and verify types
npm run build
```
