import { Router, Response } from 'express';
import db from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const ASSET_TABLES: Record<string, string> = {
  endpoint: 'endpoints',
  monitor: 'monitors',
  mobile_device: 'mobile_devices',
  ip_phone: 'ip_phones',
  server: 'servers',
  printer: 'printers',
  network_device: 'network_devices',
  other_asset: 'other_assets',
};

// Fields that are join aliases, not real DB columns — strip before updating
const VIRTUAL_FIELD_SUFFIXES = ['_name', '_color', '_code'];
const VIRTUAL_FIELD_EXACT = new Set([
  'has_pending_approval',
  'vendor_name',
  'location_name',
  'department_name',
  'employee_name',
  'employee_code',
  'status_name',
  'status_color',
]);

function stripVirtualFields(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (VIRTUAL_FIELD_EXACT.has(key)) continue;
    if (VIRTUAL_FIELD_SUFFIXES.some((suffix) => key.endsWith(suffix))) continue;
    result[key] = value;
  }
  return result;
}

export const approvalsRouter = Router();

approvalsRouter.use(authMiddleware);

// GET / — list pending approvals, optionally filter by assetType
approvalsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { assetType } = req.query as { assetType?: string };

    const q = db('pending_approvals')
      .join('users as changer', 'pending_approvals.changed_by_user_id', 'changer.id')
      .select(
        'pending_approvals.*',
        'changer.full_name as changed_by_name',
        'changer.username as changed_by_username',
      )
      .where('pending_approvals.status', 'pending')
      .orderBy('pending_approvals.created_at', 'desc');

    if (assetType) {
      q.where('pending_approvals.asset_type', assetType);
    }

    const rows = await q;
    res.json({ data: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /:id — single approval
approvalsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    const row = await db('pending_approvals')
      .join('users as changer', 'pending_approvals.changed_by_user_id', 'changer.id')
      .select(
        'pending_approvals.*',
        'changer.full_name as changed_by_name',
        'changer.username as changed_by_username',
      )
      .where('pending_approvals.id', id)
      .first();

    if (!row) return res.status(404).json({ error: 'Approval not found' });

    // Parse JSON strings if needed
    if (typeof row.before_data === 'string') {
      try { row.before_data = JSON.parse(row.before_data); } catch {}
    }
    if (typeof row.after_data === 'string') {
      try { row.after_data = JSON.parse(row.after_data); } catch {}
    }

    res.json({ data: row });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /:id/approve — superadmin only
approvalsRouter.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Superadmin access required' });
    }

    const id = Number(req.params.id);
    const approval = await db('pending_approvals')
      .where({ id, status: 'pending' })
      .first();

    if (!approval) return res.status(404).json({ error: 'Pending approval not found' });

    await db('pending_approvals').where({ id }).update({
      status: 'approved',
      reviewed_by_user_id: req.user.id,
      reviewed_at: db.fn.now(),
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /:id/reject — superadmin only
approvalsRouter.post('/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Superadmin access required' });
    }

    const id = Number(req.params.id);
    const approval = await db('pending_approvals')
      .where({ id, status: 'pending' })
      .first();

    if (!approval) return res.status(404).json({ error: 'Pending approval not found' });

    const tableName = ASSET_TABLES[approval.asset_type];
    if (!tableName) {
      return res.status(400).json({ error: `Unknown asset type: ${approval.asset_type}` });
    }

    // Parse before_data
    let beforeData: Record<string, any> = approval.before_data;
    if (typeof beforeData === 'string') {
      try { beforeData = JSON.parse(beforeData); } catch {}
    }

    // Strip virtual/join fields before restoring to DB
    const cleanBefore = stripVirtualFields(beforeData);

    // Restore original data to the asset table
    await db(tableName)
      .where({ id: approval.asset_id })
      .update({ ...cleanBefore, updated_at: db.fn.now() });

    // Mark approval as rejected
    await db('pending_approvals').where({ id }).update({
      status: 'rejected',
      reviewed_by_user_id: req.user.id,
      reviewed_at: db.fn.now(),
      notes: req.body?.notes || null,
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
