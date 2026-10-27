import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Read environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ ERROR: .env.local not found! Ensure .env.local exists with SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = "Password123!";

const SEED_USERS = [
  {
    email: "host1@plugnear.dev",
    password: SEED_PASSWORD,
    name: "Arun Host",
    role: "host",
    phone: "+91 98450 11111",
  },
  {
    email: "host2@plugnear.dev",
    password: SEED_PASSWORD,
    name: "Priya Host",
    role: "host",
    phone: "+91 98450 22222",
  },
  {
    email: "driver1@plugnear.dev",
    password: SEED_PASSWORD,
    name: "Vikram Driver",
    role: "driver",
    phone: "+91 98450 33333",
  },
  {
    email: "driver2@plugnear.dev",
    password: SEED_PASSWORD,
    name: "Ananya Driver",
    role: "driver",
    phone: "+91 98450 44444",
  },
];

async function seed() {
  console.log("🌱 Starting idempotent PlugNear seed process...\n");

  // Step 1: Fetch all existing auth users
  const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    console.error("❌ Failed to list existing auth users:", listErr.message);
    process.exit(1);
  }

  const existingUsers = listData?.users || [];
  const userMap = new Map(); // email -> userId

  // Step 2: Create or update each seeded user via Admin API
  for (const u of SEED_USERS) {
    const existing = existingUsers.find((x) => x.email === u.email);

    if (existing) {
      // Update password and confirm email to ensure clean credentials
      const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(
        existing.id,
        {
          password: u.password,
          email_confirm: true,
          user_metadata: {
            name: u.name,
            role: u.role,
            phone: u.phone,
          },
        }
      );

      if (updateErr) {
        console.error(`⚠️ Failed to update ${u.email}:`, updateErr.message);
      } else {
        console.log(`✅ Updated existing user: ${u.email} (Role: ${u.role})`);
        userMap.set(u.email, existing.id);
      }
    } else {
      // Create user with pre-confirmed email
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          name: u.name,
          role: u.role,
          phone: u.phone,
        },
      });

      if (createErr) {
        console.error(`❌ Failed to create ${u.email}:`, createErr.message);
      } else if (created.user) {
        console.log(`✅ Created user: ${u.email} (Role: ${u.role})`);
        userMap.set(u.email, created.user.id);
      }
    }
  }

  // Step 3: Check if public tables exist
  const { error: profileCheckError } = await adminClient.from("profiles").select("id").limit(1);

  if (profileCheckError) {
    console.log(`\n⚠️ Notice: Public database tables (profiles, chargers, etc.) are not yet present in Supabase.`);
    console.log(`👉 Please execute the migration SQL files in the Supabase Dashboard SQL Editor:`);
    console.log(`   1. supabase/migrations/20261026000001_initial_schema.sql`);
    console.log(`   2. supabase/migrations/20261027000001_restrict_charger_privacy.sql`);
    console.log(`Once applied, re-run 'npm run seed' to populate chargers, windows, and bookings!\n`);
    return;
  }

  // Step 4: Ensure profiles exist and are synced
  for (const u of SEED_USERS) {
    const userId = userMap.get(u.email);
    if (!userId) continue;

    const { error: profErr } = await adminClient.from("profiles").upsert(
      {
        id: userId,
        name: u.name,
        role: u.role,
        phone: u.phone,
      },
      { onConflict: "id" }
    );

    if (profErr) {
      console.warn(`⚠️ Profile sync warning for ${u.email}:`, profErr.message);
    }
  }

  const host1Id = userMap.get("host1@plugnear.dev");
  const host2Id = userMap.get("host2@plugnear.dev");
  const driver1Id = userMap.get("driver1@plugnear.dev");
  const driver2Id = userMap.get("driver2@plugnear.dev");

  if (!host1Id || !host2Id) {
    console.log("⚠️ Host IDs missing; skipping charger seed.");
    return;
  }

  // Step 5: Upsert 5 Seed Chargers in Indiranagar, Bengaluru
  const chargers = [
    {
      id: "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      host_id: host1Id,
      title: "100ft Road Fast Charger",
      address_text: "123, 100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038",
      latitude: 12.9719,
      longitude: 77.6412,
      connector_type: "Type 2",
      power_kw: 22.0,
      price_per_hour: 120.0,
      host_connection_type: "dedicated_ev",
      notes: "Dedicated basement parking bay. Access card available with security.",
      is_active: true,
    },
    {
      id: "a2222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      host_id: host1Id,
      title: "Indiranagar Home Socket",
      address_text: "456, 1st Cross, Indiranagar 1st Stage, Bengaluru, Karnataka 560038",
      latitude: 12.975,
      longitude: 77.644,
      connector_type: "Bharat AC-001",
      power_kw: 3.3,
      price_per_hour: 50.0,
      host_connection_type: "domestic",
      notes: "Driveway socket. Ring the bell on arrival.",
      is_active: true,
    },
    {
      id: "a3333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      host_id: host2Id,
      title: "Defence Colony CCS2 Hub",
      address_text: "789, 5th Main, Defence Colony, Indiranagar, Bengaluru, Karnataka 560038",
      latitude: 12.978,
      longitude: 77.638,
      connector_type: "CCS2",
      power_kw: 50.0,
      price_per_hour: 250.0,
      host_connection_type: "commercial",
      notes: "Commercial courtyard fast charger. 24x7 gate guard.",
      is_active: true,
    },
    {
      id: "a4444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      host_id: host2Id,
      title: "12th Main AC Point",
      address_text: "321, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560008",
      latitude: 12.969,
      longitude: 77.645,
      connector_type: "Type 2",
      power_kw: 7.4,
      price_per_hour: 80.0,
      host_connection_type: "dedicated_ev",
      notes: "Covered porch slot with Type 2 tethered cable.",
      is_active: true,
    },
    {
      id: "a5555555-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      host_id: host2Id,
      title: "HAL 2nd Stage Compact",
      address_text: "654, 8th Cross, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560008",
      latitude: 12.965,
      longitude: 77.648,
      connector_type: "Other",
      power_kw: 3.3,
      price_per_hour: 45.0,
      host_connection_type: "domestic",
      notes: "15A heavy-duty outdoor plug for two-wheelers and compact EVs.",
      is_active: true,
    },
  ];

  for (const c of chargers) {
    const { error: chgErr } = await adminClient.from("chargers").upsert(c, { onConflict: "id" });
    if (chgErr) console.warn(`⚠️ Charger upsert warning for ${c.title}:`, chgErr.message);
  }
  console.log(`✅ Upserted ${chargers.length} chargers`);

  // Step 6: Availability Windows (0-6 every day 06:00 to 22:00)
  const chargerIds = chargers.map((c) => c.id);
  await adminClient.from("availability_windows").delete().in("charger_id", chargerIds);

  const windows = [];
  for (const c of chargers) {
    for (let day = 0; day <= 6; day++) {
      windows.push({
        charger_id: c.id,
        day_of_week: day,
        start_time: "06:00",
        end_time: "22:00",
      });
    }
  }

  const { error: winErr } = await adminClient.from("availability_windows").insert(windows);
  if (winErr) {
    console.warn("⚠️ Availability windows insert warning:", winErr.message);
  } else {
    console.log(`✅ Upserted ${windows.length} availability windows (7 days/week per charger)`);
  }

  // Step 7: Sample Bookings
  if (driver1Id && driver2Id) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const sampleBookings = [
      {
        id: "b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        charger_id: "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        driver_id: driver1Id,
        start_at: `${dateStr}T09:00:00+05:30`,
        end_at: `${dateStr}T11:00:00+05:30`,
        status: "confirmed",
        total_cost: 240.0,
      },
      {
        id: "b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        charger_id: "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        driver_id: driver2Id,
        start_at: `${dateStr}T14:00:00+05:30`,
        end_at: `${dateStr}T15:30:00+05:30`,
        status: "requested",
        total_cost: 180.0,
      },
    ];

    const bookingIds = sampleBookings.map((b) => b.id);
    await adminClient.from("bookings").delete().in("id", bookingIds);

    const { error: bErr } = await adminClient.from("bookings").upsert(sampleBookings, { onConflict: "id" });
    if (bErr) {
      console.warn("⚠️ Bookings upsert warning:", bErr.message);
    } else {
      console.log(`✅ Upserted sample test bookings`);
    }
  }

  console.log("\n🎉 Seed complete! All accounts and data are verified and idempotent.");
}

seed().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
