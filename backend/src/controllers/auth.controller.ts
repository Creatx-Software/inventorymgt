import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db';
import { env } from '../config/env';
import { AuthRequest, loadUserRoleAndPermissions } from '../middleware/auth';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = await db('users')
    .where({ username })
    .orWhere({ email: username })
    .first();

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as jwt.SignOptions,
  );

  await db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() });

  const { role, permissions } = await loadUserRoleAndPermissions(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role,
      permissions,
    },
  });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await db('users')
    .select('id', 'username', 'email', 'full_name', 'last_login_at')
    .where({ id: req.user!.id })
    .first();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { role, permissions } = await loadUserRoleAndPermissions(req.user!.id);

  res.json({
    user: {
      ...user,
      role,
      permissions,
    },
  });
}

export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  const user = await db('users').where({ id: req.user!.id }).first();
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 10);
  await db('users').where({ id: user.id }).update({ password_hash: hash });
  res.json({ success: true });
}
