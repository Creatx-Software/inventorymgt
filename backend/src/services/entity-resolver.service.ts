import db from '../config/db';

export interface ResolvedEntity {
  label: string | null;
  secondary: string | null;
  link: string | null;
}

interface EntityTypeConfig {
  table: string;
  labelColumn: string;
  secondaryColumn?: string;
  routePrefix: string;
  /** if true, append `?openId=` */
  deepLink?: boolean;
  /** human-readable label for the entity type itself, e.g. "Mobile Device" */
  displayName: string;
}

/** All entity types we resolve for audit logs. */
export const ENTITY_TYPES: Record<string, EntityTypeConfig> = {
  endpoint:       { table: 'endpoints',         labelColumn: 'serial_number', secondaryColumn: 'asset_name',          routePrefix: '/endpoints',       deepLink: true, displayName: 'Endpoint' },
  monitor:        { table: 'monitors',          labelColumn: 'serial_number', secondaryColumn: 'asset_name',          routePrefix: '/monitors',        deepLink: true, displayName: 'Monitor' },
  mobile_device:  { table: 'mobile_devices',    labelColumn: 'serial_number', secondaryColumn: 'asset_name',          routePrefix: '/mobile-devices',  deepLink: true, displayName: 'Mobile Device' },
  ip_phone:       { table: 'ip_phones',         labelColumn: 'serial_number', secondaryColumn: 'asset_name',          routePrefix: '/ip-phones',       deepLink: true, displayName: 'IP Phone' },
  server:         { table: 'servers',           labelColumn: 'serial_number', secondaryColumn: 'application_name',    routePrefix: '/servers',         deepLink: true, displayName: 'Server' },
  printer:        { table: 'printers',          labelColumn: 'serial_number', secondaryColumn: 'device_name',         routePrefix: '/printers',        deepLink: true, displayName: 'Printer' },
  network_device: { table: 'network_devices',   labelColumn: 'serial_number', secondaryColumn: 'device_name',         routePrefix: '/network-devices', deepLink: true, displayName: 'Network Device' },
  other_asset:    { table: 'other_assets',      labelColumn: 'serial_number', secondaryColumn: 'asset_name',          routePrefix: '/other-assets',    deepLink: true, displayName: 'Other Asset' },

  employee:       { table: 'employees',         labelColumn: 'full_name',     secondaryColumn: 'employee_code',       routePrefix: '/employees',       deepLink: true, displayName: 'Employee' },
  vendor:         { table: 'vendors',           labelColumn: 'name',                                                  routePrefix: '/vendors',         deepLink: true, displayName: 'Vendor' },
  location:       { table: 'locations',         labelColumn: 'name',          secondaryColumn: 'country',             routePrefix: '/locations',       deepLink: true, displayName: 'Location' },
  department:     { table: 'departments',       labelColumn: 'name',                                                  routePrefix: '/departments',     deepLink: true, displayName: 'Department' },
  asset_status:   { table: 'asset_statuses',    labelColumn: 'name',                                                  routePrefix: '',                                 displayName: 'Asset Status' },

  incident:       { table: 'network_incidents', labelColumn: 'incident_code', secondaryColumn: 'application_impacted', routePrefix: '/incidents',      deepLink: true, displayName: 'Incident' },

  user:           { table: 'users',             labelColumn: 'username',      secondaryColumn: 'full_name',           routePrefix: '/users',                           displayName: 'User' },
  role:           { table: 'roles',             labelColumn: 'name',          secondaryColumn: 'description',         routePrefix: '/roles',                           displayName: 'Role' },
  consumable:     { table: 'consumable_items',  labelColumn: 'name',          secondaryColumn: 'category',            routePrefix: '/consumables',     deepLink: true, displayName: 'Consumable' },
};

/**
 * Resolve a list of (entity_type, entity_id) pairs into label + secondary + link.
 * Bulk-fetches per table to avoid N+1.
 */
export async function resolveEntities(
  pairs: { entity_type: string; entity_id: number | null }[],
): Promise<Map<string, ResolvedEntity>> {
  const result = new Map<string, ResolvedEntity>();

  // Group ids by entity type
  const byType = new Map<string, Set<number>>();
  for (const p of pairs) {
    if (!p.entity_id) continue;
    if (!byType.has(p.entity_type)) byType.set(p.entity_type, new Set());
    byType.get(p.entity_type)!.add(p.entity_id);
  }

  // One query per type
  for (const [type, idSet] of byType.entries()) {
    const cfg = ENTITY_TYPES[type];
    if (!cfg) continue;
    const ids = Array.from(idSet);
    const cols: string[] = ['id', cfg.labelColumn];
    if (cfg.secondaryColumn) cols.push(cfg.secondaryColumn);
    try {
      const rows = await db(cfg.table).whereIn('id', ids).select(cols);
      for (const row of rows as any[]) {
        const label = row[cfg.labelColumn] != null ? String(row[cfg.labelColumn]) : null;
        const secondary = cfg.secondaryColumn && row[cfg.secondaryColumn] != null
          ? String(row[cfg.secondaryColumn])
          : null;
        const link = cfg.routePrefix
          ? cfg.deepLink
            ? `${cfg.routePrefix}?openId=${row.id}`
            : cfg.routePrefix
          : null;
        result.set(`${type}:${row.id}`, { label, secondary, link });
      }
    } catch {
      // swallow — table may not exist yet (e.g. consumables on older deploys)
    }
  }

  return result;
}

export function entityDisplayName(type: string): string {
  return ENTITY_TYPES[type]?.displayName || type;
}

export interface EnrichedAuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  user_full_name: string | null;
  action: string;
  entity_type: string;
  entity_type_display: string;
  entity_id: number | null;
  entity_label: string | null;
  entity_secondary: string | null;
  entity_link: string | null;
  changes: any;
  ip_address: string | null;
  created_at: string;
}

export async function enrichAuditRows(rows: any[]): Promise<EnrichedAuditLog[]> {
  const resolved = await resolveEntities(
    rows.map((r) => ({ entity_type: r.entity_type, entity_id: r.entity_id })),
  );
  return rows.map((r) => {
    const key = `${r.entity_type}:${r.entity_id}`;
    const ent = resolved.get(key) || { label: null, secondary: null, link: null };
    return {
      ...r,
      entity_type_display: entityDisplayName(r.entity_type),
      entity_label: ent.label,
      entity_secondary: ent.secondary,
      entity_link: ent.link,
    };
  });
}
