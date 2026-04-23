import { Router, Response } from 'express';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';
import db from '../config/db';

export const rolesRouter = Router();

const SYSTEM_ROLE_NAMES = ['superadmin', 'admin', 'user'];

// GET / — list all roles with permission count
rolesRouter.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const roles = await db('roles')
    .select(
      'roles.id',
      'roles.name',
      'roles.description',
      'roles.is_system',
      'roles.created_at',
      'roles.updated_at',
      db.raw('COUNT(rp.id) as permission_count'),
    )
    .leftJoin('role_permissions as rp', 'roles.id', 'rp.role_id')
    .groupBy('roles.id')
    .orderBy('roles.id', 'asc');

  res.json({ data: roles });
});

// GET /:id — get role + its permissions array
rolesRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const role = await db('roles').where({ id }).first();
  if (!role) return res.status(404).json({ error: 'Role not found' });

  const perms = await db('role_permissions').where({ role_id: id }).select('permission');
  const permissions = perms.map((p: { permission: string }) => p.permission);

  res.json({ data: { ...role, permissions } });
});

// POST / — create role
rolesRouter.post(
  '/',
  authMiddleware,
  requirePermission('roles_manage'),
  async (req: AuthRequest, res: Response) => {
    const { name, description, permissions } = req.body as {
      name: string;
      description?: string;
      permissions?: string[];
    };

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const normalised = name.trim().toLowerCase();
    if (SYSTEM_ROLE_NAMES.includes(normalised)) {
      return res.status(400).json({ error: 'Cannot use a reserved system role name' });
    }

    const existing = await db('roles').where({ name: normalised }).first();
    if (existing) {
      return res.status(409).json({ error: 'A role with that name already exists' });
    }

    const [id] = await db('roles').insert({
      name: normalised,
      description: description || null,
      is_system: false,
    });

    if (permissions && permissions.length > 0) {
      await db('role_permissions').insert(
        permissions.map((p) => ({ role_id: id, permission: p })),
      );
    }

    const role = await db('roles').where({ id }).first();
    const perms = await db('role_permissions').where({ role_id: id }).select('permission');
    res.status(201).json({ data: { ...role, permissions: perms.map((p: { permission: string }) => p.permission) } });
  },
);

// PUT /:id — update role name/description
rolesRouter.put(
  '/:id',
  authMiddleware,
  requirePermission('roles_manage'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const role = await db('roles').where({ id }).first();
    if (!role) return res.status(404).json({ error: 'Role not found' });

    if (role.is_system) {
      return res.status(403).json({ error: 'Cannot edit system roles' });
    }

    const { name, description } = req.body as { name?: string; description?: string };

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      const normalised = name.trim().toLowerCase();
      if (SYSTEM_ROLE_NAMES.includes(normalised)) {
        return res.status(400).json({ error: 'Cannot use a reserved system role name' });
      }
      updates.name = normalised;
    }
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      await db('roles').where({ id }).update(updates);
    }

    const updated = await db('roles').where({ id }).first();
    res.json({ data: updated });
  },
);

// DELETE /:id — delete role
rolesRouter.delete(
  '/:id',
  authMiddleware,
  requirePermission('roles_manage'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const role = await db('roles').where({ id }).first();
    if (!role) return res.status(404).json({ error: 'Role not found' });

    if (role.is_system) {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }

    const inUse = await db('users').where({ role_id: id }).first();
    if (inUse) {
      return res.status(409).json({ error: 'Cannot delete a role that is assigned to users' });
    }

    await db('role_permissions').where({ role_id: id }).delete();
    await db('roles').where({ id }).delete();
    res.json({ success: true });
  },
);

// PUT /:id/permissions — set full permissions list for a role
rolesRouter.put(
  '/:id/permissions',
  authMiddleware,
  requirePermission('roles_manage'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const role = await db('roles').where({ id }).first();
    if (!role) return res.status(404).json({ error: 'Role not found' });

    // The superadmin role itself is always locked
    if (role.name === 'superadmin') {
      return res.status(403).json({ error: 'Cannot edit the superadmin role permissions' });
    }

    const { permissions } = req.body as { permissions: string[] };
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    await db('role_permissions').where({ role_id: id }).delete();

    if (permissions.length > 0) {
      await db('role_permissions').insert(
        permissions.map((p) => ({ role_id: id, permission: p })),
      );
    }

    res.json({ data: { role_id: id, permissions } });
  },
);
