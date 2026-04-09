import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

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
  id: number;
  serial_number: string;
  asset_name: string | null;
  expiry_date: string;
  days_remaining: number;
}

dashboardRouter.get('/warranty', async (_req, res) => {
  const today = new Date();
  const buckets = { expired: [] as AlertRow[], within30: [] as AlertRow[], within60: [] as AlertRow[], within90: [] as AlertRow[] };

  const addRow = (row: any, table: string, assetType: string, dateField: string) => {
    if (!row[dateField]) return;
    const exp = new Date(row[dateField]);
    const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
    const alert: AlertRow = {
      asset_type: assetType,
      asset_table: table,
      id: row.id,
      serial_number: row.serial_number,
      asset_name: row.asset_name,
      expiry_date: row[dateField],
      days_remaining: diff,
    };
    if (diff < 0) buckets.expired.push(alert);
    else if (diff <= 30) buckets.within30.push(alert);
    else if (diff <= 60) buckets.within60.push(alert);
    else if (diff <= 90) buckets.within90.push(alert);
  };

  for (const table of TABLES_WITH_WARRANTY) {
    const rows = await db(table)
      .whereNull('deleted_at')
      .whereNotNull('warranty_expiry_date')
      .select('id', 'serial_number', 'asset_name', 'warranty_expiry_date');
    const assetType = ASSET_TABLES.find((a) => a.table === table)!.key;
    rows.forEach((r) => addRow(r, table, assetType, 'warranty_expiry_date'));
  }

  // Sort each bucket by expiry soonest
  (['expired', 'within30', 'within60', 'within90'] as const).forEach((k) => {
    buckets[k].sort((a, b) => a.days_remaining - b.days_remaining);
  });

  res.json(buckets);
});

dashboardRouter.get('/eol', async (_req, res) => {
  const today = new Date();
  const buckets = { expired: [] as AlertRow[], within30: [] as AlertRow[], within60: [] as AlertRow[], within90: [] as AlertRow[] };

  for (const table of TABLES_WITH_EOL) {
    const rows = await db(table)
      .whereNull('deleted_at')
      .whereNotNull('eol_date')
      .select('id', 'serial_number', 'asset_name', 'eol_date');
    const assetType = ASSET_TABLES.find((a) => a.table === table)!.key;
    rows.forEach((row: any) => {
      const exp = new Date(row.eol_date);
      const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      const alert = {
        asset_type: assetType,
        asset_table: table,
        id: row.id,
        serial_number: row.serial_number,
        asset_name: row.asset_name,
        expiry_date: row.eol_date,
        days_remaining: diff,
      };
      if (diff < 0) buckets.expired.push(alert);
      else if (diff <= 30) buckets.within30.push(alert);
      else if (diff <= 60) buckets.within60.push(alert);
      else if (diff <= 90) buckets.within90.push(alert);
    });
  }

  (['expired', 'within30', 'within60', 'within90'] as const).forEach((k) => {
    buckets[k].sort((a, b) => a.days_remaining - b.days_remaining);
  });

  res.json(buckets);
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
  res.json(rows);
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
