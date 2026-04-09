import db from '../config/db';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'LOGIN' | 'IMPORT' | 'EXPORT';

export async function audit(args: {
  userId: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: number | null;
  changes?: any;
  ipAddress?: string;
}) {
  try {
    await db('audit_logs').insert({
      user_id: args.userId,
      action: args.action,
      entity_type: args.entityType,
      entity_id: args.entityId ?? null,
      changes: args.changes ? JSON.stringify(args.changes) : null,
      ip_address: args.ipAddress ?? null,
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
}
