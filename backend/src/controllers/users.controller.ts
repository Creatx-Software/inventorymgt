import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';
import db from '../config/db';

export const usersRouter = Router();

// GET / — list all users with role info
usersRouter.get('/', authMiddleware, requirePermission('users_manage'), async (_req: AuthRequest, res: Response) => {
  const users = await db('users')
    .leftJoin('roles', 'users.role_id', 'roles.id')
    .select(
      'users.id',
      'users.username',
      'users.email',
      'users.full_name',
      'users.is_active',
      'users.last_login_at',
      'users.created_at',
      'users.role_id',
      'roles.name as role_name',
    )
    .orderBy('users.id', 'asc');

  res.json({ data: users });
});

// GET /:id — get single user (no password_hash)
usersRouter.get('/:id', authMiddleware, requirePermission('users_manage'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const user = await db('users')
    .leftJoin('roles', 'users.role_id', 'roles.id')
    .select(
      'users.id',
      'users.username',
      'users.email',
      'users.full_name',
      'users.is_active',
      'users.last_login_at',
      'users.created_at',
      'users.role_id',
      'roles.name as role_name',
    )
    .where('users.id', id)
    .first();

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ data: user });
});

// POST / — create user
usersRouter.post(
  '/',
  authMiddleware,
  requirePermission('users_manage'),
  async (req: AuthRequest, res: Response) => {
    const { username, email, full_name, password, role_id, is_active } = req.body as {
      username: string;
      email: string;
      full_name: string;
      password: string;
      role_id?: number;
      is_active?: boolean;
    };

    if (!username || !email || !full_name || !password) {
      return res.status(400).json({ error: 'username, email, full_name, and password are required' });
    }

    // Admin cannot promote to superadmin
    if (!req.user!.isSuperAdmin && role_id) {
      const targetRole = await db('roles').where({ id: role_id }).first();
      if (targetRole && targetRole.name === 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can assign the superadmin role' });
      }
    }

    const existingUsername = await db('users').where({ username }).first();
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const existingEmail = await db('users').where({ email }).first();
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({
      username,
      email,
      full_name,
      password_hash,
      role_id: role_id || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    const created = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.full_name',
        'users.is_active',
        'users.role_id',
        'roles.name as role_name',
      )
      .where('users.id', id)
      .first();

    res.status(201).json({ data: created });
  },
);

// PUT /:id — update user
usersRouter.put(
  '/:id',
  authMiddleware,
  requirePermission('users_manage'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const { username, email, full_name, password, role_id, is_active } = req.body as {
      username?: string;
      email?: string;
      full_name?: string;
      password?: string;
      role_id?: number | null;
      is_active?: boolean;
    };

    // Admin cannot promote to superadmin
    if (!req.user!.isSuperAdmin && role_id !== undefined) {
      const targetRole = await db('roles').where({ id: role_id }).first();
      if (targetRole && targetRole.name === 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can assign the superadmin role' });
      }
    }

    const updates: Record<string, unknown> = {};
    if (username !== undefined) {
      const existing = await db('users').where({ username }).whereNot({ id }).first();
      if (existing) return res.status(409).json({ error: 'Username already taken' });
      updates.username = username;
    }
    if (email !== undefined) {
      const existing = await db('users').where({ email }).whereNot({ id }).first();
      if (existing) return res.status(409).json({ error: 'Email already in use' });
      updates.email = email;
    }
    if (full_name !== undefined) updates.full_name = full_name;
    if (password !== undefined && password !== '') {
      updates.password_hash = await bcrypt.hash(password, 10);
    }
    if (role_id !== undefined) updates.role_id = role_id;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length > 0) {
      await db('users').where({ id }).update(updates);
    }

    const updated = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.full_name',
        'users.is_active',
        'users.role_id',
        'roles.name as role_name',
      )
      .where('users.id', id)
      .first();

    res.json({ data: updated });
  },
);

// PUT /:id/toggle-active — toggle is_active
usersRouter.put(
  '/:id/toggle-active',
  authMiddleware,
  requirePermission('users_manage'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);

    // Prevent self-deactivation
    if (req.user!.id === id) {
      return res.status(400).json({ error: 'Cannot toggle your own active status' });
    }

    const user = await db('users').where({ id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db('users').where({ id }).update({ is_active: !user.is_active });

    const updated = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.full_name',
        'users.is_active',
        'users.role_id',
        'roles.name as role_name',
      )
      .where('users.id', id)
      .first();

    res.json({ data: updated });
  },
);
