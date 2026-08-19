import { Router } from 'express';
import db from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const settingsRouter = Router();
settingsRouter.use(authMiddleware);

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
