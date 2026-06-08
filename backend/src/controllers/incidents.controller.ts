import { Router, Response } from 'express';
import multer from 'multer';
import db from '../config/db';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';
import { audit } from '../services/audit.service';

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

export const incidentsRouter = Router();
incidentsRouter.use(authMiddleware);

const ALLOWED_SORT = ['id', 'date', 'incident_code', 'start_datetime', 'end_datetime', 'application_impacted', 'created_at'];

const SELECT_COLS = [
  'n.id', 'n.date', 'n.incident_code', 'n.start_datetime', 'n.end_datetime',
  'n.application_impacted', 'n.problem_statement',
  'n.sn_call_number', 'n.raised_by_employee_id',
  'n.email_attachment_name', 'n.deleted_at', 'n.created_at', 'n.updated_at',
  'emp.full_name as raised_by_name',
  db.raw('CASE WHEN n.email_attachment_data IS NOT NULL THEN 1 ELSE 0 END as has_attachment'),
];

function baseQ() {
  return db('network_incidents as n')
    .leftJoin('employees as emp', 'n.raised_by_employee_id', 'emp.id');
}

// GET /api/incidents
incidentsRouter.get('/', requirePermission('incidents_view'), async (req: AuthRequest, res: Response) => {
  const page     = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize || 100)));
  const offset   = (page - 1) * pageSize;
  const search   = String(req.query.search || '');
  const sortKey  = String(req.query.sortBy || 'date');
  const sortDir  = req.query.sortDir === 'asc' ? 'asc' : ('desc' as const);
  const sort     = ALLOWED_SORT.includes(sortKey) ? `n.${sortKey}` : 'n.date';

  const applyWhere = (q: ReturnType<typeof baseQ>) => {
    q.whereNull('n.deleted_at');
    if (search) {
      const like = `%${search}%`;
      q.where((sub) => {
        sub.where('n.incident_code', 'like', like)
          .orWhere('n.application_impacted', 'like', like)
          .orWhere('n.sn_call_number', 'like', like)
          .orWhere('n.problem_statement', 'like', like)
          .orWhere('emp.full_name', 'like', like);
      });
    }
    return q;
  };

  const [rows, [{ total }]] = await Promise.all([
    applyWhere(baseQ().select(...SELECT_COLS))
      .orderBy(sort, sortDir)
      .limit(pageSize)
      .offset(offset),
    applyWhere(baseQ()).countDistinct<{ total: number }[]>('n.id as total'),
  ]);

  res.json({
    data: rows,
    pagination: { page, pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / pageSize) },
  });
});

// GET /api/incidents/:id
incidentsRouter.get('/:id', requirePermission('incidents_view'), async (req: AuthRequest, res: Response) => {
  const row = await baseQ()
    .select(...SELECT_COLS)
    .where('n.id', req.params.id)
    .whereNull('n.deleted_at')
    .first();
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

// POST /api/incidents
incidentsRouter.post(
  '/',
  requirePermission('incidents_create'),
  upload.single('email_attachment'),
  async (req: AuthRequest, res: Response) => {
    const { date, start_datetime, end_datetime, incident_code, application_impacted,
            problem_statement, sn_call_number, raised_by_employee_id } = req.body as Record<string, string>;

    const [id] = await db('network_incidents').insert({
      date:                 date || null,
      start_datetime:       start_datetime || null,
      end_datetime:         end_datetime   || null,
      incident_code:        incident_code?.trim()        || null,
      application_impacted: application_impacted?.trim() || null,
      problem_statement:    problem_statement?.trim()    || null,
      sn_call_number:       sn_call_number?.trim()       || null,
      raised_by_employee_id: raised_by_employee_id ? Number(raised_by_employee_id) : null,
      email_attachment_name: req.file?.originalname ?? null,
      email_attachment_data: req.file?.buffer       ?? null,
    });

    await audit({ userId: req.user!.id, action: 'CREATE', entityType: 'incident', entityId: id, changes: req.body, ipAddress: req.ip });
    const row = await baseQ().select(...SELECT_COLS).where('n.id', id).first();
    res.status(201).json(row);
  },
);

// PUT /api/incidents/:id
incidentsRouter.put(
  '/:id',
  requirePermission('incidents_edit'),
  upload.single('email_attachment'),
  async (req: AuthRequest, res: Response) => {
    const existing = await db('network_incidents').where('id', req.params.id).whereNull('deleted_at').first();
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

    const { date, start_datetime, end_datetime, incident_code, application_impacted,
            problem_statement, sn_call_number, raised_by_employee_id, remove_attachment } = req.body as Record<string, string>;

    const patch: Record<string, unknown> = {
      date:                 date || null,
      start_datetime:       start_datetime || null,
      end_datetime:         end_datetime   || null,
      incident_code:        incident_code?.trim()        || null,
      application_impacted: application_impacted?.trim() || null,
      problem_statement:    problem_statement?.trim()    || null,
      sn_call_number:       sn_call_number?.trim()       || null,
      raised_by_employee_id: raised_by_employee_id ? Number(raised_by_employee_id) : null,
      updated_at: db.fn.now(),
    };

    if (req.file) {
      patch.email_attachment_name = req.file.originalname;
      patch.email_attachment_data = req.file.buffer;
    } else if (remove_attachment === '1') {
      patch.email_attachment_name = null;
      patch.email_attachment_data = null;
    }

    await db('network_incidents').where('id', req.params.id).update(patch);
    await audit({ userId: req.user!.id, action: 'UPDATE', entityType: 'incident', entityId: Number(req.params.id), changes: req.body, ipAddress: req.ip });
    const row = await baseQ().select(...SELECT_COLS).where('n.id', req.params.id).first();
    res.json(row);
  },
);

// DELETE /api/incidents/:id
incidentsRouter.delete('/:id', requirePermission('incidents_delete'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db('network_incidents').where({ id }).update({ deleted_at: db.fn.now() });
  await audit({ userId: req.user!.id, action: 'DELETE', entityType: 'incident', entityId: id, ipAddress: req.ip });
  res.json({ success: true });
});

// POST /api/incidents/bulk-delete
incidentsRouter.post('/bulk-delete', requirePermission('incidents_delete'), async (req: AuthRequest, res: Response) => {
  const ids: number[] = req.body?.ids || [];
  if (!ids.length) { res.json({ deleted: 0 }); return; }
  const n = await db('network_incidents').whereIn('id', ids).update({ deleted_at: db.fn.now() });
  await audit({ userId: req.user!.id, action: 'DELETE', entityType: 'incident', changes: { ids }, ipAddress: req.ip });
  res.json({ deleted: n });
});

// GET /api/incidents/:id/attachment
incidentsRouter.get('/:id/attachment', requirePermission('incidents_view'), async (req: AuthRequest, res: Response) => {
  const row = await db('network_incidents')
    .select('email_attachment_name', 'email_attachment_data')
    .where('id', req.params.id)
    .first();
  if (!row || !row.email_attachment_data) { res.status(404).json({ error: 'Attachment not found' }); return; }
  res.setHeader('Content-Disposition', `attachment; filename="${row.email_attachment_name}"`);
  res.setHeader('Content-Type', 'application/vnd.ms-outlook');
  res.send(row.email_attachment_data);
});
