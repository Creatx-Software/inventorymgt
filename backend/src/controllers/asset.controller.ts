import { Router, Response } from 'express';
import { AssetService, AssetCrudOptions } from '../services/asset.service';
import { audit } from '../services/audit.service';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';

export function buildAssetRouter(opts: AssetCrudOptions) {
  const svc = new AssetService(opts);
  const router = Router();
  router.use(authMiddleware);

  // Derive permission prefix: 'endpoint' → 'endpoints', 'mobile_device' → 'mobile_devices'
  const perm = `${opts.assetType}s`;

  router.get('/', async (req: AuthRequest, res: Response) => {
    const { page, pageSize, search, sortBy, sortDir, includeDeleted, ...rest } = req.query as any;
    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v === 'string') filters[k] = v;
    }
    const result = await svc.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search as string | undefined,
      sortBy: sortBy as string | undefined,
      sortDir: (sortDir as 'asc' | 'desc') || undefined,
      filters,
      includeDeleted: includeDeleted === 'true',
    });
    res.json(result);
  });

  router.get('/:id', async (req, res) => {
    const row = await svc.get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  router.get('/:id/history', async (req, res) => {
    const rows = await svc.assignmentHistory(Number(req.params.id));
    res.json(rows);
  });

  router.post('/', requirePermission(`${perm}_create`), async (req: AuthRequest, res) => {
    try {
      const id = await svc.create(req.body, req.user!.id);
      const row = await svc.get(id);
      await audit({ userId: req.user!.id, action: 'CREATE', entityType: opts.assetType, entityId: id, changes: req.body, ipAddress: req.ip });
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.put('/:id', requirePermission(`${perm}_edit`), async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      await svc.update(id, req.body, req.user!.id);
      const row = await svc.get(id);
      await audit({ userId: req.user!.id, action: 'UPDATE', entityType: opts.assetType, entityId: id, changes: req.body, ipAddress: req.ip });
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.delete('/:id', requirePermission(`${perm}_delete`), async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    await svc.softDelete(id);
    await audit({ userId: req.user!.id, action: 'DELETE', entityType: opts.assetType, entityId: id, ipAddress: req.ip });
    res.json({ success: true });
  });

  router.post('/:id/restore', requirePermission(`${perm}_edit`), async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    await svc.restore(id);
    await audit({ userId: req.user!.id, action: 'RESTORE', entityType: opts.assetType, entityId: id, ipAddress: req.ip });
    res.json({ success: true });
  });

  router.post('/bulk-delete', requirePermission(`${perm}_delete`), async (req: AuthRequest, res) => {
    const ids: number[] = req.body?.ids || [];
    const n = await svc.bulkDelete(ids);
    await audit({ userId: req.user!.id, action: 'DELETE', entityType: opts.assetType, changes: { ids }, ipAddress: req.ip });
    res.json({ deleted: n });
  });

  return router;
}
