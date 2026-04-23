/**
 * Bulk update eol_date for all endpoints based on po_number.
 * EOL = purchase date (from PO) + 5 years.
 *
 * PO format: PO/ICICIUK/DD/MM/YYYY/suffix  (trailing suffix optional)
 *
 * Run:  cd backend && npm run update-eol
 * Dry run (preview only, no DB writes):  npm run update-eol -- --dry-run
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

const EOL_YEARS = 5;

// Matches: PO/<anything>/<DD>/<MM>/<YYYY>  (trailing slash + suffix optional)
const PO_REGEX = /^PO\/[^/]+\/(\d{1,2})\/(\d{1,2})\/(\d{4})/i;

function calcEol(po: string): string | null {
  const trimmed = (po || '').trim();
  const m = trimmed.match(PO_REGEX);
  if (!m) return null;
  const [, day, month, year] = m;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(date.getTime())) return null;
  date.setFullYear(date.getFullYear() + EOL_YEARS);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('DRY RUN — no changes will be written.\n');

  console.log('Fetching all endpoints with a PO number...');

  const rows = await db('endpoints')
    .whereNull('deleted_at')
    .whereNotNull('po_number')
    .select('id', 'po_number', 'serial_number', 'eol_date');

  console.log(`Found ${rows.length} endpoints with a PO number.\n`);

  let updated   = 0;
  let unchanged = 0;
  let skipped   = 0;

  for (const row of rows as any[]) {
    const eol = calcEol(row.po_number);

    if (!eol) {
      console.log(`  SKIP     [${row.serial_number || row.id}] "${row.po_number}" — format not recognised`);
      skipped++;
      continue;
    }

    const existing = row.eol_date ? String(row.eol_date).slice(0, 10) : null;

    if (existing === eol) {
      unchanged++;
      continue; // already correct, no noise in the log
    }

    const was = existing ? `was ${existing}` : 'was null';
    console.log(`  UPDATE   [${row.serial_number || row.id}] "${row.po_number}" → EOL ${eol}  (${was})`);

    if (!dryRun) {
      await db('endpoints').where({ id: row.id }).update({
        eol_date:   eol,
        updated_at: db.fn.now(),
      });
    }
    updated++;
  }

  console.log(`
────────────────────────────────
  Updated  : ${updated}
  Unchanged: ${unchanged}
  Skipped  : ${skipped}  (PO format not recognised)
  Total    : ${rows.length}
────────────────────────────────`);
  if (dryRun) console.log('  (dry run — nothing was written)');

  await db.destroy();
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
