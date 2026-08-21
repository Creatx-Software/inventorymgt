import { Router } from 'express';
import db from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const settingsRouter = Router();
settingsRouter.use(authMiddleware);

const ASSET_TABLES = ['endpoints', 'monitors', 'mobile_devices', 'ip_phones', 'servers', 'printers', 'network_devices', 'other_assets'];

async function syncTable(
  table: string,
  empMap: Map<number, { dept: number | null; loc: number | null }>,
  deptMap: Map<number, string>,
  locMap: Map<number, string>,
  dryRun: boolean,
) {
  const rows = await db(table).whereNull('deleted_at').whereNotNull('employee_id')
    .select('id', 'serial_number', 'employee_id', 'department_id', 'location_id');
  const results: { serial: string; changes: string[] }[] = [];
  let updated = 0, unchanged = 0, skipped = 0;
  for (const row of rows as any[]) {
    const emp = empMap.get(Number(row.employee_id));
    if (!emp) { skipped++; continue; }
    const deptMismatch = emp.dept !== null && Number(row.department_id || 0) !== emp.dept;
    const locMismatch  = emp.loc  !== null && Number(row.location_id  || 0) !== emp.loc;
    if (!deptMismatch && !locMismatch) { unchanged++; continue; }
    const changes: string[] = [];
    if (deptMismatch) {
      const from = row.department_id ? (deptMap.get(Number(row.department_id)) ?? `#${row.department_id}`) : 'None';
      const to   = deptMap.get(emp.dept!) ?? `#${emp.dept}`;
      changes.push(`Dept: ${from} → ${to}`);
    }
    if (locMismatch) {
      const from = row.location_id ? (locMap.get(Number(row.location_id)) ?? `#${row.location_id}`) : 'None';
      const to   = locMap.get(emp.loc!) ?? `#${emp.loc}`;
      changes.push(`Location: ${from} → ${to}`);
    }
    results.push({ serial: row.serial_number || `#${row.id}`, changes });
    if (!dryRun) {
      const patch: any = { updated_at: db.fn.now() };
      if (deptMismatch) patch.department_id = emp.dept;
      if (locMismatch)  patch.location_id   = emp.loc;
      await db(table).where({ id: row.id }).update(patch);
    }
    updated++;
  }
  return { total: rows.length, updated, unchanged, skipped, results };
}

settingsRouter.post('/sync-employee-location', async (req: AuthRequest, res) => {
  if (req.user!.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
  const { table, dryRun } = req.body as { table?: string; dryRun?: boolean };
  if (table && !ASSET_TABLES.includes(table)) return res.status(400).json({ error: 'Unknown table' });
  const tables = table ? [table] : ASSET_TABLES;

  const [employees, departments, locations] = await Promise.all([
    db('employees').select('id', 'department_id', 'location_id'),
    db('departments').select('id', 'name'),
    db('locations').select('id', 'name'),
  ]);
  const empMap  = new Map<number, { dept: number | null; loc: number | null }>();
  const deptMap = new Map<number, string>();
  const locMap  = new Map<number, string>();
  for (const e of employees as any[]) empMap.set(Number(e.id), { dept: e.department_id != null ? Number(e.department_id) : null, loc: e.location_id != null ? Number(e.location_id) : null });
  for (const d of departments as any[]) deptMap.set(Number(d.id), d.name);
  for (const l of locations  as any[]) locMap.set(Number(l.id),  l.name);

  const tableResults: Record<string, any> = {};
  let grandTotal = 0, grandUpdated = 0, grandUnchanged = 0, grandSkipped = 0;
  for (const t of tables) {
    const r = await syncTable(t, empMap, deptMap, locMap, !!dryRun);
    tableResults[t] = r;
    grandTotal     += r.total;
    grandUpdated   += r.updated;
    grandUnchanged += r.unchanged;
    grandSkipped   += r.skipped;
  }
  res.json({ dryRun: !!dryRun, tables: tableResults, summary: { total: grandTotal, updated: grandUpdated, unchanged: grandUnchanged, skipped: grandSkipped } });
});

const ALLOWED_KEYS = ['firewall_it_department_id'];

settingsRouter.get('/', async (_req, res) => {
  const rows = await db('app_settings').whereIn('key', ALLOWED_KEYS);
  const result: Record<string, string | null> = {};
  for (const key of ALLOWED_KEYS) result[key] = null;
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
});

settingsRouter.put('/', async (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== 'superadmin' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const updates = req.body as Record<string, string | null>;
  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    await db('app_settings')
      .insert({ key, value: value ?? null, updated_at: db.fn.now() })
      .onConflict('key')
      .merge({ value: value ?? null, updated_at: db.fn.now() });
  }
  res.json({ success: true });
});
