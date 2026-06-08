#!/usr/bin/env node
/**
 * scripts/discover-zones.js
 *
 * Fetches all permit divisions (zones/trailheads) for a given facility ID.
 * Use this when adding a new location to find the division IDs to put in
 * the LOCATIONS config in scanner.js and api.js.
 *
 * Usage:
 *   node scripts/discover-zones.js <facilityId>
 *
 * Examples:
 *   node scripts/discover-zones.js 232447    # Yosemite Wilderness
 *   node scripts/discover-zones.js 233261    # John Muir Trail
 *
 * To find a facility ID: go to recreation.gov, open the permit page,
 * and grab the number from the URL:
 *   https://www.recreation.gov/permits/232447  →  facilityId = 232447
 */

require("dotenv").config();
const { getPermitDivisions } = require("../recreation-gov");

const facilityId = process.argv[2];

if (!facilityId) {
  console.error("Usage: node scripts/discover-zones.js <facilityId>");
  console.error("  e.g. node scripts/discover-zones.js 232447");
  process.exit(1);
}

async function main() {
  console.log(`\nFetching permit divisions for facility ${facilityId}...\n`);

  let data;
  try {
    data = await getPermitDivisions(facilityId);
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (!process.env.RIDB_API_KEY) {
      console.error("\nRIDB_API_KEY is not set. Get a free key at https://ridb.recreation.gov/");
    }
    process.exit(1);
  }

  const divisions = data?.RECDATA || data?.data || data;
  if (!Array.isArray(divisions) || divisions.length === 0) {
    console.log("No divisions found. Raw response:");
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(`Found ${divisions.length} division(s):\n`);
  console.log("─".repeat(60));

  for (const div of divisions) {
    const id = div.PermitEntranceID || div.DivisionId || div.id;
    const name = div.PermitEntranceName || div.Name || div.name;
    const type = div.PermitEntranceType || div.Type || "";
    console.log(`  ID:   ${id}`);
    console.log(`  Name: ${name}`);
    if (type) console.log(`  Type: ${type}`);
    console.log();
  }

  console.log("─".repeat(60));
  console.log("\nAdd these to LOCATIONS in scanner.js and api.js:");
  console.log("\n  zones: {");
  for (const div of divisions) {
    const id = div.PermitEntranceID || div.DivisionId || div.id;
    const name = div.PermitEntranceName || div.Name || div.name;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    console.log(`    ${key}: "${name}",   // division ID: ${id}`);
  }
  console.log("  }");
}

main().catch(console.error);
