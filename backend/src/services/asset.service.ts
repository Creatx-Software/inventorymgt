import db from '../config/db';

export type AssetTypeKey =
  | 'endpoint' | 'monitor' | 'mobile_device' | 'ip_phone'
  | 'server' | 'printer' | 'network_device' | 'other_asset';

export interface AssetCrudOptions {
  table: string;
  assetType: AssetTypeKey;
  searchableColumns: string[];
  allowedSortColumns: string[];
  allowedFilterColumns: string[];
  /** Whitelist of fields that can be bulk-edited (server-side validation) */
  bulkEditableFields?: string[];
  defaultSort?: { column: string; dir: 'asc' | 'desc' };
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, string>;
  includeDeleted?: boolean;
}

const COMMON_FIELDS = [
  'serial_number', 'asset_name', 'vendor_id', 'model', 'location_id',
  'department_id', 'employee_id', 'status_id', 'po_number', 'invoice_number', 'remarks',
];

export class AssetService {
  constructor(private opts: AssetCrudOptions) {}

  private async generatePlaceholderSerial(): Promise<string> {
    const prefix = `N/A-${this.opts.assetType}-`;
    const last = await db('serial_registry')
      .where('serial_number', 'like', `${prefix}%`)
      .orderBy('id', 'desc')
      .first();
    let next = 1;
    if (last) {
      const m = String(last.serial_number).match(/-(\d+)$/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  async list(params: ListParams) {
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(99999, Math.max(1, Number(params.pageSize || 100)));
    const offset = (page - 1) * pageSize;

    const T = this.opts.table;
    const buildBase = () => {
      const q = db(T)
        .leftJoin('vendors', `${T}.vendor_id`, 'vendors.id')
        .leftJoin('locations', `${T}.location_id`, 'locations.id')
        .leftJoin('departments', `${T}.department_id`, 'departments.id')
        .leftJoin('employees', `${T}.employee_id`, 'employees.id')
        .leftJoin('asset_statuses', `${T}.status_id`, 'asset_statuses.id')
        .leftJoin(
          db.raw(`(SELECT asset_id FROM pending_approvals WHERE asset_type = ? AND status = 'pending') AS pend`, [this.opts.assetType]),
          `pend.asset_id`,
          `${T}.id`,
        );
      if (!params.includeDeleted) q.whereNull(`${T}.deleted_at`);

      if (params.search && this.opts.searchableColumns.length) {
        const term = `%${params.search}%`;
        q.where((sub) => {
          this.opts.searchableColumns.forEach((c, i) => {
            const col = c.includes('.') ? c : `${T}.${c}`;
            if (i === 0) sub.where(col, 'like', term);
            else sub.orWhere(col, 'like', term);
          });
          sub.orWhere('vendors.name', 'like', term);
          sub.orWhere('employees.full_name', 'like', term);
          sub.orWhere('locations.name', 'like', term);
          sub.orWhere('departments.name', 'like', term);
        });
      }
      if (params.filters) {
        for (const [k, v] of Object.entries(params.filters)) {
          if (!v || !this.opts.allowedFilterColumns.includes(k)) continue;
          // FK columns: exact match; text columns: substring match
          if (k.endsWith('_id') || k.startsWith('is_')) q.where(`${T}.${k}`, v);
          else q.where(`${T}.${k}`, 'like', `%${v}%`);
        }
      }
      return q;
    };

    const JOIN_SORT_MAP: Record<string, string> = {
      status_name: 'asset_statuses.name',
      vendor_name: 'vendors.name',
      location_name: 'locations.name',
      department_name: 'departments.name',
      employee_name: 'employees.full_name',
    };
    const sortBy =
      params.sortBy && this.opts.allowedSortColumns.includes(params.sortBy)
        ? (JOIN_SORT_MAP[params.sortBy] ?? `${T}.${params.sortBy}`)
        : `${T}.${this.opts.defaultSort?.column || 'id'}`;
    const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';

    const dataQ = buildBase()
      .select(
        `${T}.*`,
        'vendors.name as vendor_name',
        'locations.name as location_name',
        'departments.name as department_name',
        'employees.full_name as employee_name',
        'employees.employee_code as employee_code',
        'asset_statuses.name as status_name',
        'asset_statuses.color as status_color',
        db.raw('IF(pend.asset_id IS NOT NULL, 1, 0) as has_pending_approval'),
      )
      .orderBy(sortBy, sortDir)
      .limit(pageSize)
      .offset(offset);

    const countQ = buildBase().count<{ total: number }[]>(`${T}.id as total`);

    const [rows, countRows] = await Promise.all([dataQ, countQ]);
    const total = Number(countRows[0].total);

    return {
      data: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async get(id: number) {
    const T = this.opts.table;
    return db(T)
      .leftJoin('vendors', `${T}.vendor_id`, 'vendors.id')
      .leftJoin('locations', `${T}.location_id`, 'locations.id')
      .leftJoin('departments', `${T}.department_id`, 'departments.id')
      .leftJoin('employees', `${T}.employee_id`, 'employees.id')
      .leftJoin('asset_statuses', `${T}.status_id`, 'asset_statuses.id')
      .select(
        `${T}.*`,
        'vendors.name as vendor_name',
        'locations.name as location_name',
        'departments.name as department_name',
        'employees.full_name as employee_name',
        'asset_statuses.name as status_name',
        'asset_statuses.color as status_color',
      )
      .where(`${T}.id`, id)
      .first();
  }

  async create(data: Record<string, any>, userId: number | null) {
    return db.transaction(async (trx) => {
      let serial = (data.serial_number || '').trim();
      if (!serial) serial = await this.generatePlaceholderSerial();

      // Global uniqueness check
      const existing = await trx('serial_registry').where({ serial_number: serial }).first();
      if (existing) {
        throw new Error(`Serial "${serial}" already exists for ${existing.asset_type}`);
      }

      const [id] = await trx(this.opts.table).insert({ ...data, serial_number: serial });

      await trx('serial_registry').insert({
        serial_number: serial,
        asset_type: this.opts.assetType,
        asset_id: id,
      });

      // If assigned to employee, open assignment record
      if (data.employee_id) {
        await trx('asset_assignments').insert({
          asset_type: this.opts.assetType,
          asset_id: id,
          employee_id: data.employee_id,
          assigned_date: new Date(),
          assigned_by_user_id: userId,
        });
      }
      return id;
    });
  }

  async update(id: number, data: Record<string, any>, userId: number | null, isSuperAdmin: boolean = true) {
    return db.transaction(async (trx) => {
      const before = await trx(this.opts.table).where({ id }).first();
      if (!before) throw new Error('Not found');

      // Serial change → update registry
      if (data.serial_number && data.serial_number !== before.serial_number) {
        const dup = await trx('serial_registry').where({ serial_number: data.serial_number }).first();
        if (dup) throw new Error(`Serial "${data.serial_number}" already exists`);
        await trx('serial_registry').where({
          asset_type: this.opts.assetType,
          asset_id: id,
        }).update({ serial_number: data.serial_number });
      }

      // Employee changed → close prior assignment, open new
      if ('employee_id' in data && data.employee_id !== before.employee_id) {
        await trx('asset_assignments')
          .where({ asset_type: this.opts.assetType, asset_id: id })
          .whereNull('returned_date')
          .update({ returned_date: new Date() });
        if (data.employee_id) {
          await trx('asset_assignments').insert({
            asset_type: this.opts.assetType,
            asset_id: id,
            employee_id: data.employee_id,
            assigned_date: new Date(),
            assigned_by_user_id: userId,
          });
        }
      }

      await trx(this.opts.table).where({ id }).update({ ...data, updated_at: trx.fn.now() });

      // Non-superadmin edits → create/update pending approval
      if (!isSuperAdmin && userId) {
        const existing = await trx('pending_approvals')
          .where({ asset_type: this.opts.assetType, asset_id: id, status: 'pending' })
          .first();
        if (existing) {
          // Keep original before_data, update after_data
          await trx('pending_approvals').where({ id: existing.id }).update({
            after_data: JSON.stringify({ ...before, ...data }),
            changed_by_user_id: userId,
          });
        } else {
          await trx('pending_approvals').insert({
            asset_type: this.opts.assetType,
            asset_id: id,
            changed_by_user_id: userId,
            before_data: JSON.stringify(before),
            after_data: JSON.stringify({ ...before, ...data }),
            status: 'pending',
          });
        }
      }

      return id;
    });
  }

  async softDelete(id: number) {
    return db.transaction(async (trx) => {
      await trx(this.opts.table).where({ id }).update({ deleted_at: trx.fn.now() });
      // close any open assignments
      await trx('asset_assignments')
        .where({ asset_type: this.opts.assetType, asset_id: id })
        .whereNull('returned_date')
        .update({ returned_date: new Date() });
      return true;
    });
  }

  async restore(id: number) {
    await db(this.opts.table).where({ id }).update({ deleted_at: null });
    return true;
  }

  async hardDelete(id: number) {
    return db.transaction(async (trx) => {
      await trx('serial_registry').where({ asset_type: this.opts.assetType, asset_id: id }).delete();
      await trx('asset_assignments').where({ asset_type: this.opts.assetType, asset_id: id }).delete();
      await trx('pending_approvals').where({ asset_type: this.opts.assetType, asset_id: id }).delete();
      await trx(this.opts.table).where({ id }).delete();
      return true;
    });
  }

  async bulkHardDelete(ids: number[]) {
    if (!ids.length) return 0;
    return db.transaction(async (trx) => {
      await trx('serial_registry').where({ asset_type: this.opts.assetType }).whereIn('asset_id', ids).delete();
      await trx('asset_assignments').where({ asset_type: this.opts.assetType }).whereIn('asset_id', ids).delete();
      await trx('pending_approvals').where({ asset_type: this.opts.assetType }).whereIn('asset_id', ids).delete();
      const n = await trx(this.opts.table).whereIn('id', ids).delete();
      return n;
    });
  }

  async bulkDelete(ids: number[]) {
    if (!ids.length) return 0;
    return db.transaction(async (trx) => {
      const n = await trx(this.opts.table).whereIn('id', ids).update({ deleted_at: trx.fn.now() });
      await trx('asset_assignments')
        .where({ asset_type: this.opts.assetType })
        .whereIn('asset_id', ids)
        .whereNull('returned_date')
        .update({ returned_date: new Date() });
      return n;
    });
  }

  /**
   * Bulk-update specific fields on many assets at once.
   * - Validates fields against bulkEditableFields whitelist
   * - For each asset: applies update, manages asset_assignments if employee_id changes
   * - Returns per-asset success/error so the UI can show partial results
   */
  async bulkUpdate(
    ids: number[],
    updates: Record<string, any>,
    userId: number | null,
  ): Promise<{ updated: number; errors: { id: number; error: string }[] }> {
    if (!ids.length || !Object.keys(updates).length) return { updated: 0, errors: [] };

    const whitelist = this.opts.bulkEditableFields || [];
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (whitelist.includes(k)) cleanUpdates[k] = v;
    }
    if (!Object.keys(cleanUpdates).length) {
      throw new Error('No valid fields to update');
    }

    let updated = 0;
    const errors: { id: number; error: string }[] = [];

    // Process each asset in its own transaction so one failure doesn't roll back others
    for (const id of ids) {
      try {
        await db.transaction(async (trx) => {
          const before = await trx(this.opts.table).where({ id }).first();
          if (!before) throw new Error('Not found');

          // Employee changed → close prior assignment, open new one
          if ('employee_id' in cleanUpdates && cleanUpdates.employee_id !== before.employee_id) {
            await trx('asset_assignments')
              .where({ asset_type: this.opts.assetType, asset_id: id })
              .whereNull('returned_date')
              .update({ returned_date: new Date() });
            if (cleanUpdates.employee_id) {
              await trx('asset_assignments').insert({
                asset_type: this.opts.assetType,
                asset_id: id,
                employee_id: cleanUpdates.employee_id,
                assigned_date: new Date(),
                assigned_by_user_id: userId,
                notes: 'Bulk reassignment',
              });
            }
          }

          await trx(this.opts.table)
            .where({ id })
            .update({ ...cleanUpdates, updated_at: trx.fn.now() });
        });
        updated++;
      } catch (e: any) {
        errors.push({ id, error: e.message || 'Update failed' });
      }
    }

    // Single audit entry summarising the bulk action (per-asset entries can be added later if needed)
    return { updated, errors };
  }

  async assignmentHistory(id: number) {
    return db('asset_assignments')
      .leftJoin('employees', 'asset_assignments.employee_id', 'employees.id')
      .leftJoin('users', 'asset_assignments.assigned_by_user_id', 'users.id')
      .where({ asset_type: this.opts.assetType, asset_id: id })
      .select(
        'asset_assignments.*',
        'employees.full_name as employee_name',
        'employees.employee_code as employee_code',
        'users.username as assigned_by_username',
      )
      .orderBy('asset_assignments.assigned_date', 'desc');
  }
}

export { COMMON_FIELDS };
