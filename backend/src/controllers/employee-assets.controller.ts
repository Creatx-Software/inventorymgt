import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

export const employeeAssetsRouter = Router();
employeeAssetsRouter.use(authMiddleware);

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

employeeAssetsRouter.get('/:id/assets', async (req, res) => {
  const employeeId = Number(req.params.id);
  const result: {
    key: string;
    label: string;
    count: number;
    assets: { id: number; serial_number: string; asset_name: string | null; model: string | null; status_name: string; status_color: string }[];
  }[] = [];

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
      .where(`${table}.employee_id`, employeeId)
      .whereNull(`${table}.deleted_at`)
      .select(cols);
    result.push({ key, label, count: rows.length, assets: rows as any });
  }

  const totalCount = result.reduce((s, r) => s + r.count, 0);
  res.json({ totalCount, groups: result.filter((r) => r.count > 0) });
});

// Bulk mark employees as reviewed
employeeAssetsRouter.post('/bulk-review', async (req, res) => {
  const ids: number[] = req.body?.ids || [];
  if (!ids.length) return res.json({ updated: 0 });
  const n = await db('employees').whereIn('id', ids).update({ needs_review: false });
  res.json({ updated: n });
});
