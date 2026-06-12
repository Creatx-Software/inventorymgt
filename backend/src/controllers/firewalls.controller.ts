import { Router } from 'express';
import db from '../config/db';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';
import { audit } from '../services/audit.service';


export const firewallsRouter = Router();
firewallsRouter.use(authMiddleware);

const T = 'firewall_rules';

function parseJsonArray(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; }
    catch { return []; }
  }
  return [];
}

function rowOut(row: any) {
  return {
    ...row,
    sources:          parseJsonArray(row.sources),
    source_nats:      parseJsonArray(row.source_nats),
    destinations:     parseJsonArray(row.destinations),
    destination_nats: parseJsonArray(row.destination_nats),
  };
}

function cleanIps(v: any): string {
  const arr = Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  return JSON.stringify(arr);
}

function bodyToData(body: any) {
  return {
    application_name: (body.application_name || '').trim(),
    sources:          cleanIps(body.sources),
    source_nats:      cleanIps(body.source_nats),
    destinations:     cleanIps(body.destinations),
    destination_nats: cleanIps(body.destination_nats),
    ports:            body.ports?.toString().trim() || null,
    protocol:         body.protocol || 'TCP',
    direction:        body.direction || 'Uni-Directional',
    rule_type:        body.rule_type || 'Permanent',
    expire_date:      body.expire_date || null,
    days_window:      body.days_window?.trim() || null,
    time_window:      body.time_window?.trim() || null,
    sn_call_number:   body.sn_call_number?.trim() || null,
    engineer_requested_employee_id: body.engineer_requested_employee_id || null,
    request_date:     body.request_date || null,
    description:      body.description?.trim() || null,
  };
}

firewallsRouter.get('/', requirePermission('firewalls_view'), async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize || 100)));
  const offset = (page - 1) * pageSize;
  const search = (req.query.search as string | undefined)?.trim();
  const expireBucket = req.query.expire_within as string | undefined;
  const sortByRaw = (req.query.sortBy as string) || 'created_at';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const allowedSort = [
    'id', 'application_name', 'rule_type', 'expire_date', 'request_date', 'created_at', 'updated_at',
    'protocol', 'direction', 'ports', 'days_window', 'time_window', 'sn_call_number', 'engineer_name', 'description',
  ];
  const JOIN_SORT: Record<string, string> = { engineer_name: 'e.full_name' };
  const sortBy = allowedSort.includes(sortByRaw) ? (JOIN_SORT[sortByRaw] ?? `${T}.${sortByRaw}`) : `${T}.created_at`;

  const buildWhere = (q: any) => {
    q.whereNull(`${T}.deleted_at`);
    if (search) {
      const term = `%${search}%`;
      q.where((sub: any) => {
        sub.where(`${T}.application_name`, 'like', term)
          .orWhere(`${T}.sources`, 'like', term)
          .orWhere(`${T}.destinations`, 'like', term)
          .orWhere(`${T}.source_nats`, 'like', term)
          .orWhere(`${T}.destination_nats`, 'like', term)
          .orWhere(`${T}.ports`, 'like', term)
          .orWhere(`${T}.sn_call_number`, 'like', term)
          .orWhere(`${T}.description`, 'like', term)
          .orWhere('e.full_name', 'like', term);
      });
    }
    if (expireBucket) {
      const map: Record<string, number> = { '1d': 1, '1w': 7, '2w': 14, '1m': 30, '3m': 90 };
      const days = map[expireBucket];
      if (days != null) {
        // Expire date is within the next N days (and not yet expired)
        const today = new Date();
        const future = new Date(); future.setDate(today.getDate() + days);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        q.whereNotNull(`${T}.expire_date`).where(`${T}.expire_date`, '>=', fmt(today)).andWhere(`${T}.expire_date`, '<=', fmt(future));
      } else if (expireBucket === 'expired') {
        const today = new Date().toISOString().slice(0, 10);
        q.whereNotNull(`${T}.expire_date`).where(`${T}.expire_date`, '<', today);
      }
    }
    return q;
  };

  const dataQ = buildWhere(
    db(T)
      .leftJoin('employees as e', `${T}.engineer_requested_employee_id`, 'e.id')
      .select(`${T}.*`, 'e.full_name as engineer_name', 'e.employee_code as engineer_code'),
  ).orderBy(sortBy, sortDir).limit(pageSize).offset(offset);

  const countQ = buildWhere(db(T).leftJoin('employees as e', `${T}.engineer_requested_employee_id`, 'e.id')).countDistinct(`${T}.id as total`);

  const [rows, countRows] = await Promise.all([dataQ, countQ]) as any;
  const total = Number(countRows[0].total);
  res.json({
    data: (rows as any[]).map(rowOut),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

firewallsRouter.get('/:id', requirePermission('firewalls_view'), async (req, res) => {
  const row = await db(T)
    .leftJoin('employees as e', `${T}.engineer_requested_employee_id`, 'e.id')
    .where(`${T}.id`, Number(req.params.id))
    .whereNull(`${T}.deleted_at`)
    .select(`${T}.*`, 'e.full_name as engineer_name', 'e.employee_code as engineer_code')
    .first();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowOut(row));
});

firewallsRouter.post('/', requirePermission('firewalls_create'), async (req: AuthRequest, res) => {
  try {
    const data = bodyToData(req.body);
    if (!data.application_name) return res.status(400).json({ error: 'Application name is required' });
    const [id] = await db(T).insert(data);
    await audit({ userId: req.user!.id, action: 'CREATE', entityType: 'firewall', entityId: id, changes: req.body, ipAddress: req.ip });
    const row = await db(T).where({ id }).first();
    res.status(201).json(rowOut(row));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

firewallsRouter.put('/:id', requirePermission('firewalls_edit'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const data = bodyToData(req.body);
    if (!data.application_name) return res.status(400).json({ error: 'Application name is required' });
    await db(T).where({ id }).update({ ...data, updated_at: db.fn.now() });
    await audit({ userId: req.user!.id, action: 'UPDATE', entityType: 'firewall', entityId: id, changes: req.body, ipAddress: req.ip });
    const row = await db(T).where({ id }).first();
    res.json(rowOut(row));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

firewallsRouter.delete('/:id', requirePermission('firewalls_delete'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db(T).where({ id }).update({ deleted_at: db.fn.now() });
  await audit({ userId: req.user!.id, action: 'DELETE', entityType: 'firewall', entityId: id, ipAddress: req.ip });
  res.json({ success: true });
});

firewallsRouter.post('/bulk-delete', requirePermission('firewalls_delete'), async (req: AuthRequest, res) => {
  const ids: number[] = req.body?.ids || [];
  if (!ids.length) return res.json({ deleted: 0 });
  const n = await db(T).whereIn('id', ids).update({ deleted_at: db.fn.now() });
  await audit({ userId: req.user!.id, action: 'DELETE', entityType: 'firewall', changes: { ids }, ipAddress: req.ip });
  res.json({ deleted: n });
});

firewallsRouter.post('/:id/restore', requirePermission('firewalls_edit'), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db(T).where({ id }).update({ deleted_at: null });
  await audit({ userId: req.user!.id, action: 'RESTORE', entityType: 'firewall', entityId: id, ipAddress: req.ip });
  res.json({ success: true });
});

