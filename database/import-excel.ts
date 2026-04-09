/**
 * One-time migration of UK & Germany Asset Inventory 2024 New(1).xlsx
 * Run with: cd backend && npm run import-excel
 */
import * as path from 'path';
import * as XLSX from 'xlsx';
import knex from 'knex';
import * as dotenv from 'dotenv';
import {
  upsertVendor, upsertLocation, upsertDepartment, upsertEmployee,
  getStatusId, normVal, parseDate, parseBool,
} from '../backend/src/services/lookup-upsert.service';

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const SOURCE_FILE = path.join(__dirname, '..', 'UK & Germany Asset Inventory 2024 New(1).xlsx');

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_mgt',
  },
});

interface Counters {
  inserted: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

async function generateSerial(trx: any, assetType: string): Promise<string> {
  const prefix = `N/A-${assetType}-`;
  const last = await trx('serial_registry')
    .where('serial_number', 'like', `${prefix}%`)
    .orderBy('id', 'desc')
    .first();
  let next = 1;
  if (last) {
    const m = String(last.serial_number).match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(5, '0')}`;
}

async function insertAsset(
  trx: any,
  table: string,
  assetType: string,
  data: Record<string, any>,
): Promise<number> {
  let serial = normVal(data.serial_number);
  if (!serial) serial = await generateSerial(trx, assetType);
  else {
    // Skip duplicates silently
    const dup = await trx('serial_registry').where({ serial_number: serial }).first();
    if (dup) {
      throw new Error(`Duplicate serial "${serial}" — already exists for ${dup.asset_type}`);
    }
  }
  const [id] = await trx(table).insert({ ...data, serial_number: serial });
  await trx('serial_registry').insert({ serial_number: serial, asset_type: assetType, asset_id: id });
  return id;
}

async function processRows(
  sheetName: string,
  table: string,
  assetType: string,
  rows: any[],
  mapper: (row: any, trx: any) => Promise<Record<string, any> | null>,
): Promise<Counters> {
  const c: Counters = { inserted: 0, skipped: 0, errors: [] };
  console.log(`\n📋 ${sheetName}: ${rows.length} rows to process...`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || Object.values(row).every((v) => v == null || v === '')) {
      c.skipped++;
      continue;
    }
    try {
      await db.transaction(async (trx) => {
        const data = await mapper(row, trx);
        if (!data) {
          c.skipped++;
          return;
        }
        await insertAsset(trx, table, assetType, data);
        c.inserted++;
      });
    } catch (e: any) {
      c.errors.push({ row: i + 2, error: e.message });
    }
  }
  console.log(`  ✓ Inserted: ${c.inserted}  ⊘ Skipped: ${c.skipped}  ✗ Errors: ${c.errors.length}`);
  if (c.errors.length > 0 && c.errors.length <= 10) {
    c.errors.forEach((e) => console.log(`    row ${e.row}: ${e.error}`));
  } else if (c.errors.length > 10) {
    c.errors.slice(0, 10).forEach((e) => console.log(`    row ${e.row}: ${e.error}`));
    console.log(`    ... and ${c.errors.length - 10} more`);
  }
  return c;
}

async function commonLookups(row: any, trx: any, branchKey: string, deptKey: string, vendorKey: string, userKey: string, codeKey: string) {
  const vendor_id = await upsertVendor(trx, row[vendorKey]);
  const location_id = await upsertLocation(trx, row[branchKey]);
  const department_id = await upsertDepartment(trx, row[deptKey]);
  const employee_id = await upsertEmployee(trx, row[userKey], row[codeKey], department_id, location_id);
  return { vendor_id, location_id, department_id, employee_id };
}

async function main() {
  console.log(`Reading: ${SOURCE_FILE}`);
  const wb = XLSX.readFile(SOURCE_FILE);

  // Reset everything except admin user + statuses
  console.log('\n⚠ Clearing existing asset data...');
  await db('asset_assignments').delete();
  await db('serial_registry').delete();
  for (const tbl of ['endpoints', 'monitors', 'mobile_devices', 'ip_phones', 'servers', 'printers', 'network_devices', 'other_assets']) {
    await db(tbl).delete();
  }
  await db('employees').delete();
  await db('vendors').delete();
  await db('locations').delete();
  await db('departments').delete();
  console.log('  ✓ Cleared.');

  // ============ ENDPOINTS ============
  if (wb.SheetNames.includes('Endpoints')) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Endpoints'], { defval: null });
    await processRows('Endpoints', 'endpoints', 'endpoint', rows, async (r, trx) => {
      const lk = await commonLookups(r, trx,
        'Branch', 'Department', 'Make', 'Name of User', 'Employee ID');
      const status_id = await getStatusId(trx, r['Status']);
      const typeRaw = (normVal(r['End Point Asset (Laptop/Desktop/Printer/Scanner etc.)']) || '').toLowerCase();
      let endpoint_type: 'Laptop' | 'Desktop' | 'Scanner' | 'Other' = 'Other';
      if (typeRaw.includes('laptop')) endpoint_type = 'Laptop';
      else if (typeRaw.includes('desktop')) endpoint_type = 'Desktop';
      else if (typeRaw.includes('scan')) endpoint_type = 'Scanner';

      return {
        serial_number: normVal(r['Asset Serial No.']),
        asset_name: normVal(r['End Point Asset (Laptop/Desktop/Printer/Scanner etc.)']),
        model: normVal(r['Model']),
        ...lk,
        status_id,
        po_number: normVal(r['PO Number']),
        invoice_number: normVal(r['Invoice Number']),
        remarks: normVal(r['Remarks']),
        endpoint_type,
        host_name: normVal(r['Host Name']),
        asset_code: normVal(r['Asset Code']),
        mac_address: normVal(r['MAC']),
        os_name_version: normVal(r['Operating System Name \nand version']) || normVal(r['Operating System Name and version']),
        ip_address: normVal(r['IP Address']),
        is_under_warranty: parseBool(r['Is it under Warranty / AMC Support']),
        warranty_expiry_date: parseDate(r['Expiry date for Warranty / AMC Support']),
        eol_date: parseDate(r['EOS/ EOL date \nof physical asset']) || parseDate(r['EOS/ EOL date of physical asset']),
      };
    });
  }

  // ============ MONITORS ============
  if (wb.SheetNames.includes('Monitors')) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Monitors'], { defval: null });
    await processRows('Monitors', 'monitors', 'monitor', rows, async (r, trx) => {
      const lk = await commonLookups(r, trx, 'Branch', 'Department', 'Make', 'Name of User', 'Employee ID');
      const status_id = await getStatusId(trx, null);
      return {
        serial_number: normVal(r['Asset Serial No.']),
        asset_name: normVal(r['Asset Name']),
        model: normVal(r['Model']),
        ...lk,
        status_id,
        po_number: normVal(r['PO Number']),
        invoice_number: normVal(r['Invoice Number']),
        remarks: normVal(r['Remarks']),
        host_name: normVal(r['Host Name']),
      };
    });
  }

  // ============ MOBILE DEVICES ============
  if (wb.SheetNames.includes('Mobile Devices')) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Mobile Devices'], { defval: null });
    await processRows('Mobile Devices', 'mobile_devices', 'mobile_device', rows, async (r, trx) => {
      const lk = await commonLookups(r, trx, 'Branch', 'Department', 'Make', 'Name of User', 'Employee ID');
      const status_id = await getStatusId(trx, null);
      return {
        serial_number: normVal(r['Asset Serial No.']),
        asset_name: normVal(r['Asset Name']),
        model: normVal(r['Model']),
        ...lk,
        status_id,
        po_number: normVal(r['PO Number']),
        invoice_number: normVal(r['Invoice Number']),
        remarks: normVal(r['Remarks']),
        eid: normVal(r['EID']),
        mobile_number: normVal(r['Mobile Number']),
        sim_number: normVal(r['SIM Number']),
        imei_number: normVal(r['IMEI Number']),
        production_year: normVal(r['Production Year']) ? Number(r['Production Year']) : null,
      };
    });
  }

  // ============ IP PHONES ============
  if (wb.SheetNames.includes('IP Phones Germany')) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['IP Phones Germany'], { defval: null });
    await processRows('IP Phones Germany', 'ip_phones', 'ip_phone', rows, async (r, trx) => {
      const lk = await commonLookups(r, trx, 'Branch', 'Department', 'Make', 'Name of User', 'Employee ID');
      // Override location to Germany since this is the Germany sheet
      if (lk.location_id) {
        await trx('locations').where({ id: lk.location_id }).update({ country: 'Germany' });
      }
      const status_id = await getStatusId(trx, null);
      return {
        serial_number: normVal(r['Asset Serial No.']),
        asset_name: normVal(r['Asset Name']),
        model: normVal(r['Model']),
        ...lk,
        status_id,
        po_number: normVal(r['PO Number']),
        invoice_number: normVal(r['Invoice Number']),
        remarks: normVal(r['Remarks']),
      };
    });
  }

  // ============ OTHER ASSETS ============
  if (wb.SheetNames.includes('Other Assets')) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Other Assets'], { defval: null });
    await processRows('Other Assets', 'other_assets', 'other_asset', rows, async (r, trx) => {
      const lk = await commonLookups(r, trx, 'Branch', 'Department', 'Make', 'Name of User', 'Employee ID');
      const status_id = await getStatusId(trx, null);
      return {
        serial_number: normVal(r['Asset Serial No.']),
        asset_name: normVal(r['Asset Name']),
        model: normVal(r['Model']),
        ...lk,
        status_id,
        po_number: normVal(r['PO Number']),
        invoice_number: normVal(r['Invoice Number']),
        remarks: normVal(r['Comments']),
        host_name: normVal(r['Host Name']),
      };
    });
  }

  // ============ SERVERS ============
  if (wb.SheetNames.includes('Servers')) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Servers'], { defval: null });
    await processRows('Servers', 'servers', 'server', rows, async (r, trx) => {
      const vendor_id = await upsertVendor(trx, r['Vendor Name']);
      const location_id = await upsertLocation(trx, r['Location  (IBG/ HYD DC/  JPR DC'] || r['Location'], 'datacenter');
      const status_id = await getStatusId(trx, null);

      const tierRaw = normVal(r['Application  Tier (0,1,2,3,4)']) || normVal(r['Application Tier (0,1,2,3,4)']);
      const tier = tierRaw && ['0', '1', '2', '3', '4'].includes(tierRaw) ? tierRaw : null;

      const physVirtRaw = (normVal(r['Physical/ Virtual\nServer']) || normVal(r['Physical/ Virtual Server']) || '').toLowerCase();
      const server_class = physVirtRaw.includes('physical') ? 'Physical' : physVirtRaw.includes('virtual') ? 'Virtual' : null;

      const stRaw = (normVal(r['Server Type  (Web/ App/ DB)']) || '').toLowerCase();
      const server_type = stRaw.includes('web') ? 'Web' : stRaw.includes('app') ? 'App' : stRaw.includes('db') ? 'DB' : null;

      const envRaw = (normVal(r['Environment  (Prod/ FB/ DR)']) || '').toLowerCase();
      const environment = envRaw.includes('prod') ? 'Prod' : envRaw.includes('dr') ? 'DR' : envRaw.includes('fb') ? 'FB' : null;

      return {
        serial_number: normVal(r['Asset Serial No.']),
        asset_name: normVal(r['Application Name']),
        model: normVal(r['Model']),
        vendor_id,
        location_id,
        department_id: null,
        employee_id: null,
        status_id,
        po_number: normVal(r['PO Number']),
        invoice_number: normVal(r['Invoice Number']),
        remarks: normVal(r['Comments']),
        application_name: normVal(r['Application Name']),
        can_id: normVal(r['CAN ID']),
        application_tier: tier,
        server_class,
        os_name_version: normVal(r['Operating System Name \nand version']) || normVal(r['Operating System Name and version']),
        server_type,
        server_software: normVal(r['Name of (Web/ App/ DB) Serverand version (e.g.IIS/ WebLogic/ Oracle etc.)']),
        managed_by: normVal(r['Managed by (IBG/ India)']),
        ip_address: normVal(r['IP Address']),
        host_name: normVal(r['Host Name']),
        asset_code: normVal(r['Asset Code']),
        dc_location: normVal(r['Location  (IBG/ HYD DC/  JPR DC']) || normVal(r['Location']),
        environment,
        is_under_warranty: parseBool(r['Is it under Warranty / AMC Support']),
        warranty_expiry_date: parseDate(r['Expiry date for Warranty / AMC Support']),
        eol_date: parseDate(r['EOS/ EOL date \nof physical asset']) || parseDate(r['EOS/ EOL date of physical asset']),
        hardening_status: parseBool(r['Hardening status for year 2021, Yes / No']),
        patching_status: parseBool(r['Patching status for Dec - May 2021, Yes / No']),
        exception_memo_no: normVal(r['Exception Approval Memo No. for either EOL/EOS, or Hardening, or Patching']),
      };
    });
  }

  // ============ PRINTERS ============
  if (wb.SheetNames.includes('Printers')) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Printers'], { defval: null });
    await processRows('Printers', 'printers', 'printer', rows, async (r, trx) => {
      const vendor_id = await upsertVendor(trx, r['Vendor Name']);
      const location_id = await upsertLocation(trx, r['Location  (IBG/ HYD DC/  JPR DC'] || r['Location']);
      const status_id = await getStatusId(trx, null);
      return {
        serial_number: normVal(r['Asset Serial No.']),
        asset_name: normVal(r['Network Device Name']),
        model: normVal(r['Model']),
        vendor_id,
        location_id,
        department_id: null,
        employee_id: null,
        status_id,
        po_number: normVal(r['PO Number']),
        invoice_number: normVal(r['Invoice Number']),
        remarks: normVal(r['Comments']),
        device_name: normVal(r['Network Device Name']),
        host_name: normVal(r['Hostname']),
        ip_address: normVal(r['IP Address']),
        managed_by: normVal(r['Managed by (IBG/ India)']),
        eol_date: parseDate(r['EOS/ EOL date \nof physical asset']) || parseDate(r['EOS/ EOL date of physical asset']),
      };
    });
  }

  // ============ NETWORK DEVICES ============
  if (wb.SheetNames.includes('Network Devices')) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Network Devices'], { defval: null });
    await processRows('Network Devices', 'network_devices', 'network_device', rows, async (r, trx) => {
      const vendor_id = await upsertVendor(trx, r['Vendor Name']);
      const location_id = await upsertLocation(trx, r['Location']);
      const status_id = await getStatusId(trx, null);
      return {
        serial_number: normVal(r['Asset Serial No.']),
        asset_name: normVal(r['Network Device Name']),
        model: normVal(r['Model']),
        vendor_id,
        location_id,
        department_id: null,
        employee_id: null,
        status_id,
        po_number: normVal(r['PO Number']),
        invoice_number: normVal(r['Invoice Number']),
        remarks: normVal(r['Comments']),
        device_name: normVal(r['Network Device Name']),
        host_name: normVal(r['Hostname']),
        ip_address: normVal(r['IP Address']),
        asset_code: normVal(r['Asset Code']),
        managed_by: normVal(r['Managed by (IBG/ India)']),
        warranty_expiry_date: parseDate(r['Expiry date for Warranty / AMC Support']),
        eol_date: parseDate(r['EOS/ EOL date \nof physical asset']) || parseDate(r['EOS/ EOL date of physical asset']),
      };
    });
  }

  console.log('\n✅ Migration complete!');
  await db.destroy();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
