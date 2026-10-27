import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// PlugNear seed — minimal but realistic demo data.
// One host, one driver, two chargers, two bookings (plus weekly windows).
// Everything is keyed on fixed ids/emails so re-running is idempotent.
// ---------------------------------------------------------------------------

const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("ERROR: .env.local not found. It must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = "Password123!";

const HOST = {
  email: "host@plugnear.dev",
  name: "Manjunath Setty",
  role: "host",
  phone: "+91 98860 41235",
};

const DRIVER = {
  email: "driver@plugnear.dev",
  name: "Nithya Rao",
  role: "driver",
  phone: "+91 99001 27654",
};

// Retired demo accounts from earlier, bulkier seed revisions. Removed so the
// demo shows exactly one host and one driver.
const LEGACY_EMAILS = [
  "host1@plugnear.dev",
  "host2@plugnear.dev",
  "driver1@plugnear.dev",
  "driver2@plugnear.dev",
  "host1@plugnear.local",
  "host2@plugnear.local",
  "driver1@plugnear.local",
  "driver2@plugnear.local",
];

const CHARGER_HOME_ID = "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHARGER_STORE_ID = "a2222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOOKING_CONFIRMED_ID = "b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BOOKING_PENDING_ID = "b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const IST_OFFSET_MS = 330 * 60_000;

// Asia/Kolkata calendar parts of a UTC instant.
function istParts(utcDate) {
  const shifted = new Date(utcDate.getTime() + IST_OFFSET_MS);
  return { date: shifted.toISOString().slice(0, 10), weekday: shifted.getUTCDay() };
}

// A UTC instant for tomorrow's Asia/Kolkata wall-clock time.
function istTomorrow(hh, mm) {
  return new Date(`${istParts(new Date(Date.now() + 24 * 3600_000)).date}T${hh}:${mm}:00+05:30`);
}

function chargersFor(hostId) {
  return [
    {
      id: CHARGER_HOME_ID,
      host_id: hostId,
      title: "Home Bay Charger - Indiranagar 1st Stage",
      address_text: "No. 24, 4th Cross Rd, Indiranagar 1st Stage, Bengaluru, Karnataka 560038",
      latitude: 12.9755,
      longitude: 77.6395,
      connector_type: "Type 2",
      power_kw: 7.4,
      price_per_hour: 85.0,
      host_connection_type: "domestic",
      notes:
        "Covered ground-floor bay behind the main gate with a 6 m tethered Type 2 cable. Ring the intercom for Manjunath - the socket breaker is the third switch in the meter box by the door. Slow but dependable; good for topping up while you are at work or overnight.",
      is_active: true,
      electricity_permission_acknowledged: true,
    },
    {
      id: CHARGER_STORE_ID,
      host_id: hostId,
      title: "Store Fast Point - 100 Feet Road",
      address_text: "Shop No. 7, 100 Feet Rd, near Trinity Metro, Indiranagar, Bengaluru, Karnataka 560008",
      latitude: 12.9784,
      longitude: 77.6403,
      connector_type: "CCS2",
      power_kw: 30.0,
      price_per_hour: 190.0,
      host_connection_type: "commercial",
      notes:
        "Customer parking bay behind the store shutter on a commercial meter. Open whenever the shop is, closed Sundays. Ask for the charging bay at the counter - staff will walk you through, and coffee is available next door while you wait.",
      is_active: true,
      electricity_permission_acknowledged: true,
    },
  ];
}

// Two realistic availability shapes: a weekday-away-from-home split schedule,
// and store hours with no Sunday service.
const WINDOWS_HOME = [
  { day_of_week: 0, slots: [["06:00", "22:30"]] },
  { day_of_week: 1, slots: [["06:00", "10:00"], ["17:00", "22:30"]] },
  { day_of_week: 2, slots: [["06:00", "10:00"], ["17:00", "22:30"]] },
  { day_of_week: 3, slots: [["06:00", "10:00"], ["17:00", "22:30"]] },
  { day_of_week: 4, slots: [["06:00", "10:00"], ["17:00", "22:30"]] },
  { day_of_week: 5, slots: [["06:00", "10:00"], ["17:00", "22:30"]] },
  { day_of_week: 6, slots: [["06:00", "12:00"], ["16:00", "22:30"]] },
];

const WINDOWS_STORE = [
  { day_of_week: 0, slots: [] },
  { day_of_week: 1, slots: [["08:00", "20:00"]] },
  { day_of_week: 2, slots: [["08:00", "20:00"]] },
  { day_of_week: 3, slots: [["08:00", "20:00"]] },
  { day_of_week: 4, slots: [["08:00", "20:00"]] },
  { day_of_week: 5, slots: [["08:00", "20:00"]] },
  { day_of_week: 6, slots: [["08:00", "20:00"]] },
];

function expandWindows(chargerId, shape) {
  const rows = [];
  for (const day of shape) {
    for (const [start_time, end_time] of day.slots) {
      rows.push({ charger_id: chargerId, day_of_week: day.day_of_week, start_time, end_time });
    }
  }
  return rows;
}

async function ensureUser(desired) {
  const { data, error } = await admin.auth.admin.createUser({
    email: desired.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { name: desired.name, role: desired.role, phone: desired.phone },
  });
  if (error) {
    if (/already exists|already been registered/i.test(error.message)) return null;
    throw new Error(`createUser ${desired.email}: ${error.message}`);
  }
  return data.user?.id ?? null;
}

async function findUserId(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function pruneLegacyUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);

  const stale = data.users.filter((u) => LEGACY_EMAILS.includes(u.email?.toLowerCase()));
  if (stale.length === 0) {
    console.log("- No retired demo accounts to remove.");
    return;
  }

  for (const u of stale) {
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) console.warn(`  ! Could not delete ${u.email}: ${delErr.message}`);
    else console.log(`  - Deleted retired demo account ${u.email} (cascaded its chargers and bookings).`);
  }
}

async function seed() {
  console.log("Starting PlugNear minimal demo seed...\n");

  await pruneLegacyUsers();

  let hostId = (await findUserId(HOST.email))?.id;
  if (!hostId) {
    hostId = await ensureUser(HOST);
    hostId = hostId ?? (await findUserId(HOST.email))?.id;
    console.log(hostId ? `+ Created host ${HOST.email}` : `x Failed to create host ${HOST.email}`);
  } else {
    await admin.auth.admin.updateUserById(hostId, {
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { name: HOST.name, role: HOST.role, phone: HOST.phone },
    });
    console.log(`= Updated host ${HOST.email}`);
  }

  let driverId = (await findUserId(DRIVER.email))?.id;
  if (!driverId) {
    driverId = await ensureUser(DRIVER);
    driverId = driverId ?? (await findUserId(DRIVER.email))?.id;
    console.log(driverId ? `+ Created driver ${DRIVER.email}` : `x Failed to create driver ${DRIVER.email}`);
  } else {
    await admin.auth.admin.updateUserById(driverId, {
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { name: DRIVER.name, role: DRIVER.role, phone: DRIVER.phone },
    });
    console.log(`= Updated driver ${DRIVER.email}`);
  }

  if (!hostId || !driverId) {
    console.error("Could not resolve both demo accounts; aborting before touching tables.");
    process.exit(1);
  }

  const { error: tableProbe } = await admin.from("profiles").select("id").limit(1);
  if (tableProbe) {
    console.log(
      "\nThe public tables are not in this Supabase project yet. Apply the migrations in supabase/migrations/ from the SQL Editor, then re-run npm run seed."
    );
    return;
  }

  for (const u of [HOST, DRIVER]) {
    const id = u === HOST ? hostId : driverId;
    const { error } = await admin
      .from("profiles")
      .upsert({ id, name: u.name, role: u.role, phone: u.phone }, { onConflict: "id" });
    if (error) console.warn(`  ! Profile sync warning for ${u.email}: ${error.message}`);
  }
  console.log(`= Synced 2 profiles`);

  const chargers = chargersFor(hostId);
  for (const c of chargers) {
    const { error } = await admin.from("chargers").upsert(c, { onConflict: "id" });
    if (error) console.warn(`  ! Charger upsert warning for ${c.title}: ${error.message}`);
  }
  console.log(`= Upserted ${chargers.length} chargers`);

  const chargerIds = chargers.map((c) => c.id);
  await admin.from("bookings").delete().in("charger_id", chargerIds);
  await admin.from("availability_windows").delete().in("charger_id", chargerIds);

  const windows = [
    ...expandWindows(CHARGER_HOME_ID, WINDOWS_HOME),
    ...expandWindows(CHARGER_STORE_ID, WINDOWS_STORE),
  ];
  const { error: winErr } = await admin.from("availability_windows").insert(windows);
  if (winErr) console.warn(`  ! Availability windows insert warning: ${winErr.message}`);
  else console.log(`+ Inserted ${windows.length} weekly availability windows`);

  // Demo slots, computed in IST so they always land inside a real window.
  // The home charger has an evening window every day, so the confirmed booking
  // is safe on any weekday. The pending request targets the store on weekdays
  // and falls back to the home charger's evening window otherwise.
  const tomorrowIst = istParts(new Date(Date.now() + 24 * 3600_000));
  const storeOpenTomorrow = WINDOWS_STORE[tomorrowIst.weekday].slots.length > 0;

  const pendingChargerId = storeOpenTomorrow ? CHARGER_STORE_ID : CHARGER_HOME_ID;
  const pendingStart = storeOpenTomorrow ? istTomorrow("11:00", "00") : istTomorrow("20:00", "00");
  const pendingEnd = storeOpenTomorrow ? istTomorrow("12:30", "00") : istTomorrow("21:00", "00");
  const pendingPrice = storeOpenTomorrow ? 190.0 : 85.0;

  const bookings = [
    {
      id: BOOKING_CONFIRMED_ID,
      charger_id: CHARGER_HOME_ID,
      driver_id: driverId,
      start_at: istTomorrow("18:00", "00").toISOString(),
      end_at: istTomorrow("19:30", "00").toISOString(),
      status: "confirmed",
      total_cost: 127.5,
      decided_at: new Date().toISOString(),
    },
    {
      id: BOOKING_PENDING_ID,
      charger_id: pendingChargerId,
      driver_id: driverId,
      start_at: pendingStart.toISOString(),
      end_at: pendingEnd.toISOString(),
      status: "requested",
      total_cost: Math.round(((pendingEnd - pendingStart) / 3_600_000) * pendingPrice * 100) / 100,
    },
  ];

  const { error: bookingErr } = await admin.from("bookings").upsert(bookings, { onConflict: "id" });
  if (bookingErr) console.warn(`  ! Booking upsert warning: ${bookingErr.message}`);
  else console.log(`+ Inserted 2 bookings (1 confirmed, 1 awaiting host decision)`);

  console.log("\nSeed complete.");
  console.log(`  host    ${HOST.email} / ${SEED_PASSWORD}   -> owns ${chargers.length} chargers`);
  console.log(`  driver  ${DRIVER.email} / ${SEED_PASSWORD} -> 1 confirmed + 1 pending booking`);
  console.log(`  (demo slots are placed on ${tomorrowIst.date}, the next Asia/Kolkata calendar day)`);
}

seed().catch((err) => {
  console.error("Fatal seed error:", err.message || err);
  process.exit(1);
});
