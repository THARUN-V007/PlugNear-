# PlugNear — Peer-to-Peer EV Charging Marketplace

> An enterprise-grade peer-to-peer EV charging network connecting electric vehicle drivers with private residential and commercial charger hosts. Powered by **Next.js 15 (App Router)**, **Supabase PostgreSQL with PostGIS**, deterministic mathematical scheduling algorithms, and a sleek automotive-inspired dark design system.

---

## ⚡ Overview & Key Capabilities

PlugNear eliminates EV range anxiety by unlocking private chargers (home driveways, apartments, office retail slots) while guaranteeing **zero double-bookings** and protecting **residential privacy by default**.

- **Deterministic Scheduling Engine (`lib/rules`):** Pure, zero-dependency, unit-tested TypeScript validation engine enforcing half-open time intervals `[start, end)`, 30-minute operational steps, and timezone alignment to Indian Standard Time (`Asia/Kolkata`).
- **PostGIS Proximity Search:** Sub-15ms spatial query execution using GiST spatial indexing (`ST_DWithin`) combined with server-side availability window checks and real-time conflict filtering.
- **Atomic Exclusion Locking:** PostgreSQL exclusion constraints (`btree_gist` with `tstzrange`) prevent concurrent overlapping confirmed reservations at the database storage layer.
- **1-Click Low-Battery Emergency Mode:** Instant search identifying the single nearest active, verified-free charging point within 25 km with automated slot refresh.
- **Privacy-Guarded Location Layer:** Public search surfaces an approximate randomized ~300m neighborhood pin. True street address and Google Maps turn-by-turn directions unlock strictly upon host confirmation.
- **Automotive Dark Design System:** Tailored high-voltage dark theme with deep slate canvas (`#0F1115`), crisp card panels (`#181B22`, border `#2C303B`), toxic bright green accents (`#39FF14`), and neon cyan host indicators (`#00E5FF`).

---

## 🎨 Design System & Palette

| Token | Hex Value | Usage / Semantic Role |
| :--- | :--- | :--- |
| **Canvas** | `#0F1115` | Global app shell, background for all pages and viewports |
| **Panel Surface** | `#181B22` | Cards, dashboard panels, search containers, modals, form wrappers |
| **Panel Border** | `#2C303B` | Crisp 1px structural border separating panels, inputs, and tables |
| **Primary Green** | `#39FF14` | Toxic bright neon green for active states, CTA buttons, map pins, and verified indicators |
| **Cyan Accent** | `#00E5FF` | Host action buttons, location picker pin, host badges, and connection indicators |
| **Warning / Emergency**| `#F59E0B` | Low battery emergency hero banner, pending approval badges |
| **Error / Destructive**| `#EF4444` | Cancellations, declination buttons, and validation alert banners |
| **Typography** | `Plus Jakarta Sans` | High-contrast off-white (`#F8FAFC`) headings and slate (`#94A3B8`) body |

---

## 👥 Seed Accounts & Demo Credentials

The database includes pre-configured demo accounts in Bengaluru with real-world geographic coordinates, active weekly schedules, and sample reservations:

**Shared Development Password:** `Password123!`

| Role | Name | Email | Coordinates / Location | Charger Details |
| :--- | :--- | :--- | :--- | :--- |
| **Host** | Manjunath Setty | `host@plugnear.dev` | 100 Feet Rd & HAL 2nd Stage, Indiranagar, Bengaluru | **Charger 1:** 7.4 kW Type 2 Home Bay (₹85/hr)<br/>**Charger 2:** 30 kW CCS2 Store Point (₹190/hr, Mon–Sat) |
| **Driver** | Nithya Rao | `driver@plugnear.dev` | Indiranagar, Bengaluru | **Booking 1:** Confirmed slot tomorrow 18:00–19:30 IST<br/>**Booking 2:** Pending request awaiting approval |

*Note: Demo slots are dynamically anchored to tomorrow's date in Indian Standard Time (`Asia/Kolkata`) to guarantee real availability windows.*

---

## 🛠️ Tech Stack & Architecture

- **Frontend & Routing:** Next.js 15 (App Router, Server Components, Server Actions)
- **Styling & Icons:** Tailwind CSS 3.4 with custom design tokens, Lucide React icons
- **Mapping & Spatial Visualization:** Leaflet & React-Leaflet (custom SVG DivIcons, zero broken PNG assets, dynamic SSR-safe imports)
- **Database & Storage:** Supabase PostgreSQL with PostGIS (`geometry(Point, 4326)`), `btree_gist`, and `pgcrypto`
- **Validation:** Zod schemas for forms, search queries, booking slots, and charger specs
- **Authentication & Security:** Supabase Auth with JWT, Row Level Security (RLS), and database role guards

---

## 📁 Repository Structure

```text
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                # Signed-in role redirection guard
│   │   ├── login/page.tsx            # Automotive-themed sign-in terminal
│   │   └── signup/page.tsx           # Dual-role (Driver / Host) registration
│   ├── actions/auth.ts               # Server actions for login, signup, logout
│   ├── api/
│   │   ├── bookings/route.ts         # Booking creation & slot validation
│   │   ├── bookings/[id]/cancel/     # Driver cancellation endpoint
│   │   ├── chargers/emergency/       # 1-click nearest free charger search
│   │   ├── chargers/search/          # Scheduled PostGIS proximity search
│   │   └── host/                     # Host charger & booking approval endpoints
│   ├── driver/
│   │   ├── page.tsx                  # Driver search & interactive map
│   │   ├── bookings/page.tsx         # Driver active & past reservations
│   │   └── chargers/[id]/page.tsx    # Guarded charger details & address unlock
│   ├── host/
│   │   ├── page.tsx                  # Host command center dashboard
│   │   ├── bookings/page.tsx         # Host booking request management
│   │   └── chargers/                 # Charger listing, creation & schedule editor
│   ├── globals.css                   # Dark theme design system variables & Leaflet styling
│   ├── layout.tsx                    # Root HTML layout with Plus Jakarta Sans & dark canvas
│   └── not-found.tsx                 # Custom 404 error page
├── components/
│   ├── Navbar.tsx                    # Role-aware navigation with dynamic pending badges
│   ├── booking/                      # Charger details view & approximate location map
│   ├── driver/                       # Driver bookings view & booking card components
│   ├── host/                         # Host charger management, cards & schedule editor
│   ├── map/                          # Leaflet map container & location picker
│   └── search/                       # Search filters, emergency hero banner & charger cards
├── lib/
│   ├── auth/guard.ts                 # Role-based route protection helpers
│   ├── bookings/                     # Booking loader, status helpers & cancellation rules
│   ├── chargers/                     # Charger loader & weekly schedule helpers
│   ├── rules/                        # Pure domain rules: slots, intervals, transitions, cost
│   ├── search/                       # Spatial search assembly & emergency mode algorithms
│   ├── supabase/                     # SSR, browser, and service-role client helpers
│   └── validation/                   # Zod schemas for chargers, bookings & search
├── supabase/
│   ├── migrations/                   # Sequential SQL schema migrations
│   ├── seed.sql                      # SQL seed file for test data
│   └── tests/                        # Automated database constraint verification tests
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v18.18.0 or newer
- **Package Manager:** `npm`
- **Database:** Supabase project with PostgreSQL

### 2. Environment Configuration
Create a `.env.local` file in the project root:

```ini
# Supabase Public API credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only Service Role Secret (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Database Migration Order
Enable required PostgreSQL extensions in Supabase (Dashboard → Database → Extensions):
- `postgis`
- `btree_gist`
- `pgcrypto`

Apply migrations sequentially in the Supabase SQL Editor:

| Migration File | Description | Essential For |
| :--- | :--- | :--- |
| `20261026000001_initial_schema.sql` | Tables, enums, GiST exclusion constraints, profiles, RLS | Core foundation |
| `20261027000001_restrict_charger_privacy.sql` | `public_chargers` view and spatial search function | Proximity search |
| `20261027000002_get_charger_details.sql` | `get_charger_details_for_driver()` RPC | Details & address masking |
| `20261027000003_host_approval_atomicity.sql` | `host_approve_booking_atomic()` transaction | Race-free host approvals |
| `20261027000004_add_charger_acknowledgement.sql` | `electricity_permission_acknowledged` column | Host compliance declaration |
| `20261027000005_fix_profile_bootstrap.sql` | Fixed search path `handle_new_user()` trigger | Sign-up reliability |
| `20261028000001_replace_availability_windows.sql`| Atomic weekly availability replacement RPC | Weekly schedule editor |
| `20261028000002_restrict_profile_visibility.sql` | Counterparty-only profile visibility RLS | Privacy compliance |
| `20261028000003_booking_edge_integrity.sql` | Auto-decline conflicting pending bookings | Conflict resolution |
| `20261028000004_driver_slot_exclusion.sql` | Enforces one confirmed booking per driver | Driver overlap guard |

### 4. Seed Data Population
Run the idempotent seed script to populate realistic Bengaluru test accounts and chargers:

```bash
npm run seed
```

### 5. Running the Application
```bash
# Start Next.js development server
npm run dev

# Run full test suite (179 unit tests)
npm test

# Run TypeScript type verification
npm run lint

# Production bundle build
npm run build
```

---

## 🛡️ Business Rules & Edge Cases Handled

### 1. Booking State Machine
```text
                  ┌──────────────┐
                  │  Requested   │
                  └──────┬───────┘
                         │
         ┌───────────────┼───────────────┐
         │ (Host Approve)│ (Host Decline)│ (Driver Cancel)
         ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │ Confirmed │   │ Declined  │   │ Cancelled │
   └─────┬─────┘   └───────────┘   └───────────┘
         │
         │ (Time Passes)
         ▼
   ┌───────────┐
   │ Completed │
   └───────────┘
```
- **Requested:** Cancellable by driver at any time prior to slot start time.
- **Confirmed:** Cancellable by host or driver *strictly before* slot start time. Once the slot starts, cancellation is disabled.
- **Atomic Auto-Decline:** When a host approves one booking request, any overlapping pending requests on that charger are automatically declined within the same atomic database transaction.
- **Lazy State Expiry:** Expired requests (past slot start without decision) and completed bookings are evaluated lazily on read.

### 2. Time & Scheduling Rules
- **Half-Open Intervals:** All bookings use `[start, end)`. A booking from `18:00 to 19:30` can be followed immediately by a booking from `19:30 to 21:00` without conflict.
- **Indian Standard Time Alignment:** Dates and times are selected in local IST (`Asia/Kolkata`), mapped cleanly against day-of-week weekly availability windows, and converted to UTC for database storage.
- **30-Minute Boundary Steps:** Slots must start and end on exact 30-minute boundaries (e.g., `:00` or `:30`), with a minimum duration of 30 minutes and a maximum of 8 hours.

### 3. Location Privacy Architecture
- **Public & Unconfirmed Search:** Returns approximate coordinates fuzzed by ~300 meters. The map renders a translucent privacy circle to indicate approximate neighborhood.
- **Confirmed Booking:** The exact street address, coordinates, and Google Maps directions link are unlocked exclusively for the confirmed driver and the charger host.

---

## 🧪 Automated Testing & Verification

The test suite contains **179 automated unit tests** covering:
- Slot validation and 30-minute step enforcement (`lib/rules/slot-validation.test.ts`)
- Weekly availability schedule parsing & day-of-week boundary overlaps (`lib/rules/availability-windows.test.ts`)
- Booking interval overlap detection & half-open bounds (`lib/rules/booking-overlap.test.ts`)
- Dynamic cost calculation algorithms (`lib/rules/cost-calculation.test.ts`)
- Booking state machine transitions & cancellability permissions (`lib/rules/booking-status.test.ts`)
- PostGIS search result filtering & distance calculations (`lib/search/search-assembly.test.ts`)
- Emergency 1-click slot generation (`lib/search/emergency-slot.test.ts`)

Run the test suite:
```bash
npm test
```

---

## 🔒 Security Best Practices Implemented

- **No Sensitive Leaks in Git:** `.env.local` is strictly ignored; only `.env.example` is tracked.
- **Role Isolation:** Next.js middleware and server-side `requireRole()` checks reject cross-role attempts (e.g., driver accessing `/host` or host calling `/driver`).
- **Input Sanitization & Zod Validation:** All client inputs, query parameters, and API payloads are strictly validated server-side.
- **Postgres Row Level Security (RLS):** Table access is restricted so drivers cannot query other drivers' bookings or private host coordinates directly through client Supabase instances.

---

## 📄 License

This project is licensed under the MIT License.
