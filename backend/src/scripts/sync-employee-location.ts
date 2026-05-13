/**
 * Sync department_id and location_id for every assigned asset so they
 * match the assigned employee's department and location.
 *
 * Only updates assets where the value differs from the employee's value.
 * If the employee has no department or location, that field is left alone.
 *
 * Run:        cd backend && npm run sync-employee-location
 * Dry run:    npm run sync-employee-location -- --dry-run
 * One table:  npm run sync-employee-location -- --table=endpoints
 */

import knex from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const db = knex({
  client: 'mysql2',
  connection: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT || 3306),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'inventory_mgt',
  },
});

const ASSET_TABLES = [
  'endpoints',
  'monitors',
  'mobile_devices',
  'ip_phones',
  'servers',
  'printers',
  'network_devices',
  'other_assets',
];

interface EmpData { dept: number | null; loc: number | null }

async function syncTable(
  table: string,
  empMap: Map<number, EmpData>,
  dryRun: boolean,
) {
  const rows = await db(table)
    .whereNull('deleted_at')
    .whereNotNull('employee_id')
    .select('id', 'serial_number', 'employee_id', 'department_id', 'location_id');

  let updated   = 0;
  let unchanged = 0;
  let skipped   = 0;

  for (const row of rows as any[]) {
    const emp = empMap.get(Number(row.employee_id));

    if (!emp) {
      // Employee record not found (deleted?) — skip
      skipped++;
      continue;
    }

    const deptMismatch = emp.dept !== null && Number(row.department_id || 0) !== emp.dept;
    const locMismatch  = emp.loc  !== null && Number(row.location_id  || 0) !== emp.loc;

    if (!deptMismatch && !locMismatch) {
      unchanged++;
      continue;
    }

    const parts: string[] = [];
    if (deptMismatch) parts.push(`dept ${row.department_id ?? 'null'} → ${emp.dept}`);
    if (locMismatch)  parts.push(`loc  ${row.location_id  ?? 'null'} → ${emp.loc}`);
    console.log(`  UPDATE  [${(row.serial_number || '#' + row.id).padEnd(25)}]  ${parts.join('   ')}`);

    if (!dryRun) {
      const patch: any = { updated_at: db.fn.now() };
      if (deptMismatch) patch.department_id = emp.dept;
      if (locMismatch)  patch.location_id   = emp.loc;
      await db(table).where({ id: row.id }).update(patch);
    }
    updated++;
  }

  return { total: rows.length, updated, unchanged, skipped };
}

async function run() {
  const dryRun   = process.argv.includes('--dry-run');
  const tableArg = process.argv.find((a) => a.startsWith('--table='))?.split('=')[1];

  console.log('='.repeat(60));
  console.log('  Sync asset dept/location from assigned employee');
  console.log('='.repeat(60));
  if (dryRun) console.log('  MODE: DRY RUN — nothing will be written\n');
  else        console.log('  MODE: LIVE — changes will be committed\n');

  const tables = tableArg
    ? (ASSET_TABLES.includes(tableArg) ? [tableArg] : (() => { throw new Error(`Unknown table: ${tableArg}`); })())
    : ASSET_TABLES;

  // Load all employees in one shot
  const employees = await db('employees').select('id', 'department_id', 'location_id');
  const empMap = new Map<number, EmpData>();
  for (const e of employees as any[]) {
    empMap.set(Number(e.id), {
      dept: e.department_id != null ? Number(e.department_id) : null,
      loc:  e.location_id  != null ? Number(e.location_id)  : null,
    });
  }
  console.log(`Loaded ${empMap.size} employees.\n`);

  let grandTotal = 0, grandUpdated = 0, grandUnchanged = 0, grandSkipped = 0;

  for (const table of tables) {
    console.log(`\n── ${table} ${'─'.repeat(Math.max(0, 40 - table.length))}`);
    const r = await syncTable(table, empMap, dryRun);
    grandTotal     += r.total;
    grandUpdated   += r.updated;
    grandUnchanged += r.unchanged;
    grandSkipped   += r.skipped;
    if (r.total === 0) console.log('  (no assigned assets)');
    else console.log(`  ↳ assigned: ${r.total}  |  updated: ${r.updated}  |  unchanged: ${r.unchanged}  |  skipped: ${r.skipped}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  Total assigned assets : ${grandTotal}`);
  console.log(`  Updated               : ${grandUpdated}`);
  console.log(`  Already correct       : ${grandUnchanged}`);
  console.log(`  Skipped (emp missing) : ${grandSkipped}`);
  if (dryRun) console.log('\n  DRY RUN — re-run without --dry-run to apply changes.');
  console.log('='.repeat(60));

  await db.destroy();
}

run().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
