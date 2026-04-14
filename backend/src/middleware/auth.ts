import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import db from '../config/db';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    permissions: string[];
    isSuperAdmin: boolean;
  };
}

async function loadUserRoleAndPermissions(userId: number): Promise<{
  role: string;
  permissions: string[];
  isSuperAdmin: boolean;
}> {
  const userWithRole = await db('users')
    .leftJoin('roles', 'users.role_id', 'roles.id')
    .select('roles.name as role_name', 'roles.id as role_id')
    .where('users.id', userId)
    .first();

  if (!userWithRole || !userWithRole.role_name) {
    return { role: 'user', permissions: [], isSuperAdmin: false };
  }

  const roleName = userWithRole.role_name as string;
  const isSuperAdmin = roleName === 'superadmin';

  const permRows = await db('role_permissions')
    .where({ role_id: userWithRole.role_id })
    .select('permission');

  const permissions = permRows.map((r: { permission: string }) => r.permission);

  return { role: roleName, permissions, isSuperAdmin };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { id: number; username: string };
    const { role, permissions, isSuperAdmin } = await loadUserRoleAndPermissions(payload.id);
    req.user = {
      id: payload.id,
      username: payload.username,
      role,
      permissions,
      isSuperAdmin,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requirePermission(key: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.isSuperAdmin) {
      return next();
    }
    if (req.user.permissions.includes(key)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  };
}

export { loadUserRoleAndPermissions };
