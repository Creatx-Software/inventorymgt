import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { enrichAuditRows, ENTITY_TYPES } from '../services/entity-resolver.service';

export const auditRouter = Router();
auditRouter.use(authMiddleware);

// Returns the list of entity-type keys + display names — used by the UI filter dropdown
auditRouter.get('/entity-types', (_req, res) => {
  const list = Object.entries(ENTITY_TYPES).map(([key, cfg]) => ({
    key,
    displayName: cfg.displayName,
  }));
  res.json(list);
});

auditRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize || 100)));
  const offset = (page - 1) * pageSize;

  const buildWhere = (q: any) => {
    if (req.query.user_id) q.where('audit_logs.user_id', Number(req.query.user_id));
    if (req.query.entity_type) q.where('audit_logs.entity_type', req.query.entity_type);
    if (req.query.action) q.where('audit_logs.action', req.query.action);
    if (req.query.from) q.where('audit_logs.created_at', '>=', req.query.from);
    if (req.query.to) q.where('audit_logs.created_at', '<=', req.query.to);
    if (req.query.search) {
      const term = `%${req.query.search}%`;
      q.where((sub: any) => {
        sub.where('audit_logs.entity_type', 'like', term)
          .orWhere('users.username', 'like', term)
          .orWhere('users.full_name', 'like', term);
      });
    }
    return q;
  };

  const [rows, countRows] = await Promise.all([
    buildWhere(
      db('audit_logs')
        .leftJoin('users', 'audit_logs.user_id', 'users.id')
        .select(
          'audit_logs.*',
          'users.username',
          'users.full_name as user_full_name',
        ),
    ).orderBy('audit_logs.created_at', 'desc').limit(pageSize).offset(offset),
    (buildWhere(db('audit_logs').leftJoin('users', 'audit_logs.user_id', 'users.id')) as any).count('audit_logs.id as total') as Promise<{ total: number }[]>,
  ]);

  const enriched = await enrichAuditRows(rows);

  res.json({
    data: enriched,
    pagination: {
      page, pageSize,
      total: Number(countRows[0].total),
      totalPages: Math.ceil(Number(countRows[0].total) / pageSize),
    },
  });
});
