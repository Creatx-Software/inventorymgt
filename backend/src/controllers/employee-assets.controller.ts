import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

export const employeeAssetsRouter = Router();
employeeAssetsRouter.use(authMiddleware);

const ASSET_TABLES = [
  { key: 'endpoint',       table: 'endpoints',       label: 'Endpoints' },
  { key: 'monitor',        table: 'monitors',        label: 'Monitors' },
  { key: 'mobile_device',  table: 'mobile_devices',  label: 'Mobile Devices' },
  { key: 'ip_phone',       table: 'ip_phones',       label: 'IP Phones' },
  { key: 'server',         table: 'servers',         label: 'Servers' },
  { key: 'printer',        table: 'printers',        label: 'Printers' },
  { key: 'network_device', table: 'network_devices', label: 'Network Devices' },
  { key: 'other_asset',    table: 'other_assets',    label: 'Other Assets' },
];

employeeAssetsRouter.get('/:id/assets', async (req, res) => {
  const employeeId = Number(req.params.id);
  const result: {
    key: string;
    label: string;
    count: number;
    assets: { id: number; serial_number: string; asset_name: string | null; model: string | null; status_name: string; status_color: string }[];
  }[] = [];

  for (const { key, table, label } of ASSET_TABLES) {
    const rows = await db(table)
      .leftJoin('asset_statuses', `${table}.status_id`, 'asset_statuses.id')
      .where(`${table}.employee_id`, employeeId)
      .whereNull(`${table}.deleted_at`)
      .select(
        `${table}.id`,
        `${table}.serial_number`,
        `${table}.asset_name`,
        `${table}.model`,
        'asset_statuses.name as status_name',
        'asset_statuses.color as status_color',
      );
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
