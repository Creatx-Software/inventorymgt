import { Response, Router } from 'express';
import { CrudService, CrudOptions, ListParams } from '../services/crud.service';
import { audit } from '../services/audit.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export function buildCrudRouter(opts: CrudOptions & { entityType: string }) {
  const svc = new CrudService<any>(opts);
  const router = Router();
  router.use(authMiddleware);

  router.get('/', async (req: AuthRequest, res: Response) => {
    const { page, pageSize, search, sortBy, sortDir, includeDeleted, ...rest } = req.query as any;
    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v === 'string') filters[k] = v;
    }
    const params: ListParams = {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search as string | undefined,
      sortBy: sortBy as string | undefined,
      sortDir: (sortDir as 'asc' | 'desc') || undefined,
      filters,
      includeDeleted: includeDeleted === 'true',
    };
    const result = await svc.list(params);
    res.json(result);
  });

  router.get('/:id', async (req, res) => {
    const row = await svc.get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  router.post('/', async (req: AuthRequest, res) => {
    try {
      const row = await svc.create(req.body);
      await audit({
        userId: req.user!.id,
        action: 'CREATE',
        entityType: opts.entityType,
        entityId: row.id,
        changes: req.body,
        ipAddress: req.ip,
      });
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.put('/:id', async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const before = await svc.get(id);
      if (!before) return res.status(404).json({ error: 'Not found' });
      const row = await svc.update(id, req.body);
      await audit({
        userId: req.user!.id,
        action: 'UPDATE',
        entityType: opts.entityType,
        entityId: id,
        changes: { before, after: row },
        ipAddress: req.ip,
      });
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.delete('/:id', async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const ok = await svc.softDelete(id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    await audit({ userId: req.user!.id, action: 'DELETE', entityType: opts.entityType, entityId: id, ipAddress: req.ip });
    res.json({ success: true });
  });

  router.post('/:id/restore', async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const ok = await svc.restore(id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    await audit({ userId: req.user!.id, action: 'RESTORE', entityType: opts.entityType, entityId: id, ipAddress: req.ip });
    res.json({ success: true });
  });

  router.post('/bulk-delete', async (req: AuthRequest, res) => {
    const ids: number[] = req.body?.ids || [];
    const n = await svc.bulkDelete(ids);
    await audit({
      userId: req.user!.id,
      action: 'DELETE',
      entityType: opts.entityType,
      changes: { ids },
      ipAddress: req.ip,
    });
    res.json({ deleted: n });
  });

  return router;
}
