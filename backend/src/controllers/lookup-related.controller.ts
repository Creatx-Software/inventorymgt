import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

export const lookupRelatedRouter = Router();
lookupRelatedRouter.use(authMiddleware);

const ASSET_TABLES = [
  { key: 'endpoint',       table: 'endpoints',       label: 'Endpoints',       hasHostName: true },
  { key: 'monitor',        table: 'monitors',        label: 'Monitors',        hasHostName: true },
  { key: 'mobile_device',  table: 'mobile_devices',  label: 'Mobile Devices',  hasHostName: false },
  { key: 'ip_phone',       table: 'ip_phones',       label: 'IP Phones',       hasHostName: false },
  { key: 'server',         table: 'servers',         label: 'Servers',         hasHostName: true },
  { key: 'printer',        table: 'printers',        label: 'Printers',        hasHostName: true },
  { key: 'network_device', table: 'network_devices', label: 'Network Devices', hasHostName: true },
  { key: 'other_asset',    table: 'other_assets',    label: 'Other Assets',    hasHostName: true },
];

interface AssetSummary {
  id: number;
  serial_number: string;
  asset_name: string | null;
  model: string | null;
  status_name: string | null;
  status_color: string | null;
  host_name?: string | null;
}

interface AssetGroup {
  key: string;
  label: string;
  count: number;
  assets: AssetSummary[];
}

async function fetchAssetsByFk(fkColumn: 'department_id' | 'location_id' | 'vendor_id', fkValue: number) {
  const groups: AssetGroup[] = [];
  let totalCount = 0;
  for (const { key, table, label, hasHostName } of ASSET_TABLES) {
    const cols = [
      `${table}.id`,
      `${table}.serial_number`,
      `${table}.asset_name`,
      `${table}.model`,
      'asset_statuses.name as status_name',
      'asset_statuses.color as status_color',
    ];
    if (hasHostName) cols.push(`${table}.host_name`);
    const rows = await db(table)
      .leftJoin('asset_statuses', `${table}.status_id`, 'asset_statuses.id')
      .where(`${table}.${fkColumn}`, fkValue)
      .whereNull(`${table}.deleted_at`)
      .select(cols);
    groups.push({ key, label, count: rows.length, assets: rows as AssetSummary[] });
    totalCount += rows.length;
  }
  return { totalCount, groups: groups.filter((g) => g.count > 0) };
}

// =================== DEPARTMENTS ===================
lookupRelatedRouter.get('/departments/:id/related', async (req, res) => {
  const id = Number(req.params.id);

  const employees = await db('employees')
    .leftJoin('locations', 'employees.location_id', 'locations.id')
    .where({ 'employees.department_id': id })
    .whereNull('employees.deleted_at')
    .select(
      'employees.id',
      'employees.full_name',
      'employees.employee_code',
      'employees.email',
      'employees.is_active',
      'locations.name as location_name',
    )
    .orderBy('employees.full_name', 'asc');

  const assets = await fetchAssetsByFk('department_id', id);

  res.json({
    employees,
    employeesCount: employees.length,
    ...assets,
  });
});

// =================== LOCATIONS ===================
lookupRelatedRouter.get('/locations/:id/related', async (req, res) => {
  const id = Number(req.params.id);

  const employees = await db('employees')
    .leftJoin('departments', 'employees.department_id', 'departments.id')
    .where({ 'employees.location_id': id })
    .whereNull('employees.deleted_at')
    .select(
      'employees.id',
      'employees.full_name',
      'employees.employee_code',
      'employees.email',
      'employees.is_active',
      'departments.name as department_name',
    )
    .orderBy('employees.full_name', 'asc');

  const assets = await fetchAssetsByFk('location_id', id);

  // Consumables stored at this location
  const consumables = await db('consumable_items')
    .where({ location_id: id })
    .whereNull('deleted_at')
    .select('id', 'name', 'category', 'unit', 'current_stock', 'minimum_stock')
    .orderBy('name', 'asc');

  res.json({
    employees,
    employeesCount: employees.length,
    ...assets,
    consumables,
    consumablesCount: consumables.length,
  });
});

// =================== VENDORS ===================
lookupRelatedRouter.get('/vendors/:id/related', async (req, res) => {
  const id = Number(req.params.id);

  const assets = await fetchAssetsByFk('vendor_id', id);

  // Models supplied rollup — count of each (asset_type, model) combination
  const modelMap = new Map<string, { asset_type: string; asset_label: string; model: string; count: number }>();
  for (const group of assets.groups) {
    for (const a of group.assets) {
      if (!a.model) continue;
      const k = `${group.key}::${a.model}`;
      const existing = modelMap.get(k);
      if (existing) existing.count++;
      else modelMap.set(k, { asset_type: group.key, asset_label: group.label, model: a.model, count: 1 });
    }
  }
  const models = Array.from(modelMap.values()).sort((a, b) => b.count - a.count);

  // Consumables from this vendor
  const consumables = await db('consumable_items')
    .where({ vendor_id: id })
    .whereNull('deleted_at')
    .select('id', 'name', 'category', 'unit', 'current_stock', 'minimum_stock')
    .orderBy('name', 'asc');

  res.json({
    ...assets,
    models,
    modelsCount: models.length,
    consumables,
    consumablesCount: consumables.length,
  });
});
