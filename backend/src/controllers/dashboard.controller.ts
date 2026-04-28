import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { enrichAuditRows } from '../services/entity-resolver.service';

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);

const ASSET_TABLES = [
  { key: 'endpoint', table: 'endpoints', label: 'Endpoints' },
  { key: 'monitor', table: 'monitors', label: 'Monitors' },
  { key: 'mobile_device', table: 'mobile_devices', label: 'Mobile Devices' },
  { key: 'ip_phone', table: 'ip_phones', label: 'IP Phones' },
  { key: 'server', table: 'servers', label: 'Servers' },
  { key: 'printer', table: 'printers', label: 'Printers' },
  { key: 'network_device', table: 'network_devices', label: 'Network Devices' },
  { key: 'other_asset', table: 'other_assets', label: 'Other Assets' },
];

const TABLES_WITH_WARRANTY = ['endpoints', 'servers', 'network_devices'];
const TABLES_WITH_EOL = ['endpoints', 'servers', 'printers', 'network_devices'];

dashboardRouter.get('/summary', async (_req, res) => {
  const results: Record<string, number> = {};
  let total = 0;
  let unassigned = 0;

  for (const { key, table } of ASSET_TABLES) {
    const [row] = await db(table).whereNull('deleted_at').count('* as c');
    const count = Number((row as any).c);
    results[key] = count;
    total += count;
    const [unrow] = await db(table).whereNull('deleted_at').whereNull('employee_id').count('* as c');
    unassigned += Number((unrow as any).c);
  }

  const [vendors] = await db('vendors').whereNull('deleted_at').count('* as c');
  const [employees] = await db('employees').whereNull('deleted_at').count('* as c');
  const [locations] = await db('locations').whereNull('deleted_at').count('* as c');
  const [incidents] = await db('network_incidents').whereNull('deleted_at').count('* as c');

  res.json({
    byType: results,
    total,
    unassigned,
    vendors: Number((vendors as any).c),
    employees: Number((employees as any).c),
    locations: Number((locations as any).c),
    incidents: Number((incidents as any).c),
  });
});

interface AlertRow {
  asset_type: string;
  asset_table: string;
  asset_label: string;
  id: number;
  serial_number: string;
  asset_name: string | null;
  model: string | null;
  vendor_name: string | null;
  location_name: string | null;
  department_name: string | null;
  employee_name: string | null;
  employee_code: string | null;
  expiry_date: string;
  days_remaining: number;
}

async function fetchAlertRows(tables: string[], dateField: string): Promise<AlertRow[]> {
  const today = new Date();
  const rows: AlertRow[] = [];

  for (const table of tables) {
    const meta = ASSET_TABLES.find((a) => a.table === table)!;
    const data = await db(table)
      .leftJoin('vendors',       `${table}.vendor_id`,     'vendors.id')
      .leftJoin('locations',     `${table}.location_id`,   'locations.id')
      .leftJoin('departments',   `${table}.department_id`, 'departments.id')
      .leftJoin('employees',     `${table}.employee_id`,   'employees.id')
      .whereNull(`${table}.deleted_at`)
      .whereNotNull(`${table}.${dateField}`)
      .select(
        `${table}.id`,
        `${table}.serial_number`,
        `${table}.asset_name`,
        `${table}.model`,
        db.raw(`${table}.${dateField} as expiry_date`),
        'vendors.name as vendor_name',
        'locations.name as location_name',
        'departments.name as department_name',
        'employees.full_name as employee_name',
        'employees.employee_code as employee_code',
      );

    for (const row of data as any[]) {
      const exp = new Date(row.expiry_date);
      const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      rows.push({
        asset_type:      meta.key,
        asset_table:     table,
        asset_label:     meta.label,
        id:              row.id,
        serial_number:   row.serial_number,
        asset_name:      row.asset_name,
        model:           row.model,
        vendor_name:     row.vendor_name,
        location_name:   row.location_name,
        department_name: row.department_name,
        employee_name:   row.employee_name,
        employee_code:   row.employee_code,
        expiry_date:     row.expiry_date,
        days_remaining:  diff,
      });
    }
  }

  return rows.sort((a, b) => a.days_remaining - b.days_remaining);
}

function toBuckets(rows: AlertRow[]) {
  const buckets = { expired: [] as AlertRow[], within30: [] as AlertRow[], within60: [] as AlertRow[], within90: [] as AlertRow[] };
  for (const r of rows) {
    if (r.days_remaining < 0)       buckets.expired.push(r);
    else if (r.days_remaining <= 30) buckets.within30.push(r);
    else if (r.days_remaining <= 60) buckets.within60.push(r);
    else if (r.days_remaining <= 90) buckets.within90.push(r);
  }
  return buckets;
}

dashboardRouter.get('/warranty', async (_req, res) => {
  const rows = await fetchAlertRows(TABLES_WITH_WARRANTY, 'warranty_expiry_date');
  res.json(toBuckets(rows));
});

dashboardRouter.get('/eol', async (_req, res) => {
  const rows = await fetchAlertRows(TABLES_WITH_EOL, 'eol_date');
  res.json(toBuckets(rows));
});

dashboardRouter.get('/recent-activity', async (_req, res) => {
  const rows = await db('audit_logs')
    .leftJoin('users', 'audit_logs.user_id', 'users.id')
    .select(
      'audit_logs.id',
      'audit_logs.action',
      'audit_logs.entity_type',
      'audit_logs.entity_id',
      'audit_logs.created_at',
      'users.username',
      'users.full_name as user_full_name',
    )
    .orderBy('audit_logs.created_at', 'desc')
    .limit(15);
  const enriched = await enrichAuditRows(rows);
  res.json(enriched);
});

dashboardRouter.get('/charts', async (_req, res) => {
  // Aggregated counts by location / status / department / vendor across all asset tables.
  const locationCounts: Record<string, number> = {};
  const statusCounts: Record<string, { count: number; color: string }> = {};
  const departmentCounts: Record<string, number> = {};
  const vendorCounts: Record<string, number> = {};

  for (const { table } of ASSET_TABLES) {
    const rows = await db(table)
      .leftJoin('locations', `${table}.location_id`, 'locations.id')
      .leftJoin('asset_statuses', `${table}.status_id`, 'asset_statuses.id')
      .leftJoin('departments', `${table}.department_id`, 'departments.id')
      .leftJoin('vendors', `${table}.vendor_id`, 'vendors.id')
      .whereNull(`${table}.deleted_at`)
      .select(
        'locations.name as location_name',
        'asset_statuses.name as status_name',
        'asset_statuses.color as status_color',
        'departments.name as department_name',
        'vendors.name as vendor_name',
      );

    for (const r of rows as any[]) {
      const loc = r.location_name || 'Unknown';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;

      const st = r.status_name || 'Unknown';
      if (!statusCounts[st]) statusCounts[st] = { count: 0, color: r.status_color || '#64748b' };
      statusCounts[st].count++;

      const dept = r.department_name || 'Unknown';
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;

      if (r.vendor_name) {
        vendorCounts[r.vendor_name] = (vendorCounts[r.vendor_name] || 0) + 1;
      }
    }
  }

  const toArray = (obj: Record<string, number>) =>
    Object.entries(obj)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  res.json({
    byLocation: toArray(locationCounts).slice(0, 10),
    byStatus: Object.entries(statusCounts).map(([name, { count, color }]) => ({ name, value: count, color })),
    byDepartment: toArray(departmentCounts).slice(0, 10),
    byVendor: toArray(vendorCounts).slice(0, 10),
  });
});
