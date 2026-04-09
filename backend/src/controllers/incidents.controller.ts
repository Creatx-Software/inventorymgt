import { Router, Response } from 'express';
import db from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { audit } from '../services/audit.service';

export const incidentsRouter = Router();
incidentsRouter.use(authMiddleware);

interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

incidentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize || 100)));
  const offset = (page - 1) * pageSize;
  const search = req.query.search as string | undefined;
  const sortBy = (req.query.sortBy as string) || 'start_datetime';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const allowedSort = ['id', 'incident_code', 'start_datetime', 'end_datetime', 'application_impacted', 'created_at'];
  const sort = allowedSort.includes(sortBy) ? sortBy : 'start_datetime';

  const buildWhere = (q: any) => {
    q.whereNull('deleted_at');
    if (search) {
      const term = `%${search}%`;
      q.where((sub: any) => {
        sub.where('incident_code', 'like', term)
          .orWhere('application_impacted', 'like', term)
          .orWhere('can_id', 'like', term)
          .orWhere('problem_statement', 'like', term)
          .orWhere('business_impact', 'like', term);
      });
    }
    return q;
  };

  const [rows, countRows] = await Promise.all([
    buildWhere(db('network_incidents').select('*')).orderBy(sort, sortDir).limit(pageSize).offset(offset),
    (buildWhere(db('network_incidents')) as any).count('* as total') as Promise<{ total: number }[]>,
  ]);

  res.json({
    data: rows,
    pagination: {
      page, pageSize,
      total: Number(countRows[0].total),
      totalPages: Math.ceil(Number(countRows[0].total) / pageSize),
    },
  });
});

incidentsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const incident = await db('network_incidents').where({ id }).whereNull('deleted_at').first();
  if (!incident) return res.status(404).json({ error: 'Not found' });

  const servers = await db('incident_servers')
    .join('servers', 'incident_servers.server_id', 'servers.id')
    .where('incident_servers.incident_id', id)
    .select('servers.id', 'servers.serial_number', 'servers.application_name', 'servers.host_name');

  const devices = await db('incident_network_devices')
    .join('network_devices', 'incident_network_devices.network_device_id', 'network_devices.id')
    .where('incident_network_devices.incident_id', id)
    .select('network_devices.id', 'network_devices.serial_number', 'network_devices.device_name', 'network_devices.host_name');

  res.json({ ...incident, servers, network_devices: devices });
});

incidentsRouter.post('/', async (req: AuthRequest, res) => {
  const { server_ids, network_device_ids, ...body } = req.body || {};
  try {
    const id = await db.transaction(async (trx) => {
      const [newId] = await trx('network_incidents').insert(body);
      if (Array.isArray(server_ids) && server_ids.length > 0) {
        await trx('incident_servers').insert(server_ids.map((sid: number) => ({ incident_id: newId, server_id: sid })));
      }
      if (Array.isArray(network_device_ids) && network_device_ids.length > 0) {
        await trx('incident_network_devices').insert(network_device_ids.map((did: number) => ({ incident_id: newId, network_device_id: did })));
      }
      return newId;
    });
    await audit({ userId: req.user!.id, action: 'CREATE', entityType: 'incident', entityId: id, changes: req.body, ipAddress: req.ip });
    const row = await db('network_incidents').where({ id }).first();
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

incidentsRouter.put('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const { server_ids, network_device_ids, ...body } = req.body || {};
  try {
    await db.transaction(async (trx) => {
      await trx('network_incidents').where({ id }).update({ ...body, updated_at: trx.fn.now() });
      if (Array.isArray(server_ids)) {
        await trx('incident_servers').where({ incident_id: id }).delete();
        if (server_ids.length > 0) {
          await trx('incident_servers').insert(server_ids.map((sid: number) => ({ incident_id: id, server_id: sid })));
        }
      }
      if (Array.isArray(network_device_ids)) {
        await trx('incident_network_devices').where({ incident_id: id }).delete();
        if (network_device_ids.length > 0) {
          await trx('incident_network_devices').insert(network_device_ids.map((did: number) => ({ incident_id: id, network_device_id: did })));
        }
      }
    });
    await audit({ userId: req.user!.id, action: 'UPDATE', entityType: 'incident', entityId: id, changes: req.body, ipAddress: req.ip });
    const row = await db('network_incidents').where({ id }).first();
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

incidentsRouter.delete('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db('network_incidents').where({ id }).update({ deleted_at: db.fn.now() });
  await audit({ userId: req.user!.id, action: 'DELETE', entityType: 'incident', entityId: id, ipAddress: req.ip });
  res.json({ success: true });
});

incidentsRouter.post('/bulk-delete', async (req: AuthRequest, res) => {
  const ids: number[] = req.body?.ids || [];
  if (!ids.length) return res.json({ deleted: 0 });
  const n = await db('network_incidents').whereIn('id', ids).update({ deleted_at: db.fn.now() });
  await audit({ userId: req.user!.id, action: 'DELETE', entityType: 'incident', changes: { ids }, ipAddress: req.ip });
  res.json({ deleted: n });
});
