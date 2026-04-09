import { Knex } from 'knex';

const norm = (v: any): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a' ? null : s;
};

export async function upsertVendor(trx: Knex, name: any): Promise<number | null> {
  const n = norm(name);
  if (!n) return null;
  const existing = await trx('vendors').whereRaw('LOWER(name) = ?', [n.toLowerCase()]).first();
  if (existing) return existing.id;
  const [id] = await trx('vendors').insert({ name: n });
  return id;
}

export async function upsertLocation(
  trx: Knex,
  name: any,
  type: 'office' | 'datacenter' | 'other' = 'office',
  country: string | null = null,
): Promise<number | null> {
  const n = norm(name);
  if (!n) return null;
  const existing = await trx('locations').whereRaw('LOWER(name) = ?', [n.toLowerCase()]).first();
  if (existing) return existing.id;
  const [id] = await trx('locations').insert({ name: n, type, country });
  return id;
}

export async function upsertDepartment(trx: Knex, name: any): Promise<number | null> {
  const n = norm(name);
  if (!n) return null;
  const existing = await trx('departments').whereRaw('LOWER(name) = ?', [n.toLowerCase()]).first();
  if (existing) return existing.id;
  const [id] = await trx('departments').insert({ name: n });
  return id;
}

export async function upsertEmployee(
  trx: Knex,
  fullName: any,
  employeeCode: any,
  departmentId: number | null = null,
  locationId: number | null = null,
): Promise<number | null> {
  const name = norm(fullName);
  const code = norm(employeeCode);
  if (!name && !code) return null;

  // 1. Match by employee_code if present
  if (code) {
    const byCode = await trx('employees').where({ employee_code: code }).first();
    if (byCode) return byCode.id;
  }
  // 2. Fallback: match by name (case-insensitive)
  if (name) {
    const byName = await trx('employees').whereRaw('LOWER(full_name) = ?', [name.toLowerCase()]);
    if (byName.length === 1) return byName[0].id;
    // multiple matches → flag a new record for review
  }

  const [id] = await trx('employees').insert({
    employee_code: code,
    full_name: name || code || 'Unknown',
    department_id: departmentId,
    location_id: locationId,
    needs_review: !code,
  });
  return id;
}

export async function getStatusId(trx: Knex, name: any): Promise<number> {
  const n = norm(name);
  if (!n) {
    const inUse = await trx('asset_statuses').where({ name: 'In Use' }).first();
    return inUse?.id || 1;
  }
  const lower = n.toLowerCase();
  // Map common spreadsheet values
  const map: Record<string, string> = {
    'in use': 'In Use',
    'inuse': 'In Use',
    'use': 'In Use',
    'stores': 'In Stores',
    'store': 'In Stores',
    'in stores': 'In Stores',
    'in store': 'In Stores',
    'spare': 'In Stores',
    'repair': 'Under Repair',
    'under repair': 'Under Repair',
    'disposed': 'Disposed',
    'dispose': 'Disposed',
    'lost': 'Lost',
    'returned': 'Returned',
    'return': 'Returned',
  };
  const target = map[lower] || 'In Use';
  const row = await trx('asset_statuses').where({ name: target }).first();
  return row?.id || 1;
}

export function normVal(v: any): string | null {
  return norm(v);
}

export function parseDate(v: any): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export function parseBool(v: any): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === 'y' || s === '1';
}
