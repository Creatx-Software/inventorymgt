import { Router, Response } from 'express';
import multer from 'multer';
import db from '../config/db';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.msg')) {
      cb(null, true);
    } else {
      cb(new Error('Only .msg files are allowed'));
    }
  },
});

export const activitiesRouter = Router();
activitiesRouter.use(authMiddleware);

const ALLOWED_SORT = ['date', 'sub_category', 'ip_address', 'device', 'sn_call_number', 'created_at'];
const FILTER_COLS   = ['sub_category', 'ip_address', 'device', 'sn_call_number'];

const SELECT_COLS = [
  'a.id', 'a.date', 'a.sub_category', 'a.ip_address', 'a.device',
  'a.sn_call_number', 'a.description',
  'a.raised_by_employee_id',
  'a.email_attachment_name', 'a.created_by_user_id', 'a.created_at', 'a.updated_at',
  'u.full_name as created_by_name',
  'emp.full_name as raised_by_name',
  db.raw('CASE WHEN a.email_attachment_data IS NOT NULL THEN 1 ELSE 0 END as has_attachment'),
];

function baseQ() {
  return db('activities as a')
    .join('users as u', 'a.created_by_user_id', 'u.id')
    .leftJoin('employees as emp', 'a.raised_by_employee_id', 'emp.id');
}

// GET /api/activities  — paginated, searchable, filterable, sortable
activitiesRouter.get('/', requirePermission('activities_view'), async (req: AuthRequest, res: Response) => {
  const page     = Math.max(1, Number(req.query.page     || 1));
  const pageSize = Math.min(99999, Math.max(1, Number(req.query.pageSize || 100)));
  const offset   = (page - 1) * pageSize;
  const search   = String(req.query.search || '');
  const sortKey  = String(req.query.sortBy || 'date');
  const sortDir  = req.query.sortDir === 'asc' ? 'asc' : ('desc' as const);
  const filters  = (req.query.filters as Record<string, string>) || {};

  const sortCol = ALLOWED_SORT.includes(sortKey) ? `a.${sortKey}` : 'a.date';

  const applyWhere = (q: ReturnType<typeof baseQ>) => {
    if (search) {
      const like = `%${search}%`;
      q.where((sub) => {
        sub.where('a.sub_category', 'like', like)
          .orWhere('a.ip_address', 'like', like)
          .orWhere('a.device', 'like', like)
          .orWhere('a.sn_call_number', 'like', like)
          .orWhere('a.description', 'like', like)
          .orWhere('u.full_name', 'like', like)
          .orWhere('emp.full_name', 'like', like);
      });
    }
    for (const [k, v] of Object.entries(filters)) {
      if (!v || !FILTER_COLS.includes(k)) continue;
      q.where(`a.${k}`, 'like', `%${v}%`);
    }
    return q;
  };

  const [rows, [{ total }]] = await Promise.all([
    applyWhere(baseQ().select(...SELECT_COLS))
      .orderBy(sortCol, sortDir)
      .limit(pageSize)
      .offset(offset),
    applyWhere(baseQ()).countDistinct<{ total: number }[]>('a.id as total'),
  ]);

  res.json({
    data: rows,
    pagination: { page, pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / pageSize) },
  });
});

// POST /api/activities  (multipart/form-data)
activitiesRouter.post('/', requirePermission('activities_create'), upload.single('email_attachment'), async (req: AuthRequest, res: Response) => {
  const { date, sub_category, ip_address, device, sn_call_number, raised_by_employee_id, description } = req.body as Record<string, string>;

  if (!date) { res.status(400).json({ error: 'date is required' }); return; }

  const [id] = await db('activities').insert({
    date,
    sub_category:  sub_category?.trim()  || null,
    ip_address:    ip_address?.trim()    || null,
    device:        device?.trim()        || null,
    sn_call_number: sn_call_number?.trim() || null,
    raised_by_employee_id: raised_by_employee_id ? Number(raised_by_employee_id) : null,
    description:   description?.trim()   || null,
    email_attachment_name: req.file?.originalname ?? null,
    email_attachment_data: req.file?.buffer       ?? null,
    created_by_user_id: req.user!.id,
  });

  const row = await baseQ().select(...SELECT_COLS).where('a.id', id).first();
  res.status(201).json(row);
});

// PUT /api/activities/:id  (multipart/form-data)
activitiesRouter.put('/:id', requirePermission('activities_edit'), upload.single('email_attachment'), async (req: AuthRequest, res: Response) => {
  const existing = await db('activities').where('id', req.params.id).first();
  if (!existing) { res.status(404).json({ error: 'Activity not found' }); return; }

  const { date, sub_category, ip_address, device, sn_call_number, raised_by_employee_id, description, remove_attachment } = req.body as Record<string, string>;

  const patch: Record<string, unknown> = {
    date: date || existing.date,
    sub_category:  sub_category?.trim()   || null,
    ip_address:    ip_address?.trim()     || null,
    device:        device?.trim()         || null,
    sn_call_number: sn_call_number?.trim() || null,
    raised_by_employee_id: raised_by_employee_id ? Number(raised_by_employee_id) : null,
    description:   description?.trim()    || null,
  };

  if (req.file) {
    patch.email_attachment_name = req.file.originalname;
    patch.email_attachment_data = req.file.buffer;
  } else if (remove_attachment === '1') {
    patch.email_attachment_name = null;
    patch.email_attachment_data = null;
  }

  await db('activities').where('id', req.params.id).update(patch);
  const row = await baseQ().select(...SELECT_COLS).where('a.id', req.params.id).first();
  res.json(row);
});

// POST /api/activities/bulk-delete
activitiesRouter.post('/bulk-delete', requirePermission('activities_delete'), async (req: AuthRequest, res: Response) => {
  const { ids } = req.body as { ids: number[] };
  if (!ids?.length) { res.status(400).json({ error: 'ids required' }); return; }
  await db('activities').whereIn('id', ids).delete();
  res.json({ deleted: ids.length });
});

// GET /api/activities/:id/attachment  — download the .msg file
activitiesRouter.get('/:id/attachment', async (req: AuthRequest, res: Response) => {
  const row = await db('activities')
    .select('email_attachment_name', 'email_attachment_data')
    .where('id', req.params.id)
    .first();

  if (!row || !row.email_attachment_data) { res.status(404).json({ error: 'Attachment not found' }); return; }

  res.setHeader('Content-Disposition', `attachment; filename="${row.email_attachment_name}"`);
  res.setHeader('Content-Type', 'application/vnd.ms-outlook');
  res.send(row.email_attachment_data);
});

// DELETE /api/activities/:id
activitiesRouter.delete('/:id', requirePermission('activities_delete'), async (req: AuthRequest, res: Response) => {
  const activity = await db('activities').where('id', req.params.id).first();
  if (!activity) { res.status(404).json({ error: 'Activity not found' }); return; }
  const isSuperAdmin = req.user!.role === 'superadmin';
  if (!isSuperAdmin && activity.created_by_user_id !== req.user!.id) {
    res.status(403).json({ error: 'You can only delete your own activities' }); return;
  }
  await db('activities').where('id', req.params.id).delete();
  res.json({ success: true });
});
