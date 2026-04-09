import db from '../config/db';
import { Knex } from 'knex';

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, string>;
  includeDeleted?: boolean;
}

export interface CrudOptions {
  table: string;
  searchableColumns: string[];
  allowedSortColumns: string[];
  allowedFilterColumns: string[];
  hasSoftDelete?: boolean;
  defaultSort?: { column: string; dir: 'asc' | 'desc' };
}

export class CrudService<T extends Record<string, any>> {
  constructor(private opts: CrudOptions) {}

  private base(): Knex.QueryBuilder {
    let q = db(this.opts.table);
    if (this.opts.hasSoftDelete) q = q.whereNull('deleted_at');
    return q;
  }

  async list(params: ListParams) {
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(500, Math.max(1, Number(params.pageSize || 100)));
    const offset = (page - 1) * pageSize;

    const buildWhere = (q: Knex.QueryBuilder) => {
      if (this.opts.hasSoftDelete && !params.includeDeleted) {
        q.whereNull(`${this.opts.table}.deleted_at`);
      }
      if (params.search && this.opts.searchableColumns.length > 0) {
        const term = `%${params.search}%`;
        q.where((sub) => {
          this.opts.searchableColumns.forEach((col, i) => {
            if (i === 0) sub.where(col, 'like', term);
            else sub.orWhere(col, 'like', term);
          });
        });
      }
      if (params.filters) {
        for (const [k, v] of Object.entries(params.filters)) {
          if (!v) continue;
          if (!this.opts.allowedFilterColumns.includes(k)) continue;
          q.where(k, 'like', `%${v}%`);
        }
      }
      return q;
    };

    const dataQ = buildWhere(db(this.opts.table).select('*'));
    const countQ = buildWhere(db(this.opts.table));

    const sortBy =
      params.sortBy && this.opts.allowedSortColumns.includes(params.sortBy)
        ? params.sortBy
        : this.opts.defaultSort?.column || 'id';
    const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, [{ total }]] = await Promise.all([
      dataQ.orderBy(sortBy, sortDir).limit(pageSize).offset(offset),
      countQ.count<{ total: number }[]>('* as total'),
    ]);

    return {
      data: rows as T[],
      pagination: { page, pageSize, total: Number(total), totalPages: Math.ceil(Number(total) / pageSize) },
    };
  }

  async get(id: number): Promise<T | null> {
    const row = await this.base().where(`${this.opts.table}.id`, id).first();
    return row || null;
  }

  async create(data: Partial<T>): Promise<T> {
    const [id] = await db(this.opts.table).insert(data as any);
    return (await db(this.opts.table).where({ id }).first()) as T;
  }

  async update(id: number, data: Partial<T>): Promise<T | null> {
    await db(this.opts.table).where({ id }).update({ ...data, updated_at: db.fn.now() } as any);
    return this.get(id);
  }

  async softDelete(id: number): Promise<boolean> {
    if (!this.opts.hasSoftDelete) {
      await db(this.opts.table).where({ id }).delete();
      return true;
    }
    const n = await db(this.opts.table).where({ id }).update({ deleted_at: db.fn.now() } as any);
    return n > 0;
  }

  async restore(id: number): Promise<boolean> {
    const n = await db(this.opts.table).where({ id }).update({ deleted_at: null } as any);
    return n > 0;
  }

  async bulkDelete(ids: number[]): Promise<number> {
    if (!ids.length) return 0;
    if (!this.opts.hasSoftDelete) {
      return await db(this.opts.table).whereIn('id', ids).delete();
    }
    return await db(this.opts.table).whereIn('id', ids).update({ deleted_at: db.fn.now() } as any);
  }
}
