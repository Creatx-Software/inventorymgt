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

export interface JoinedSearchColumn {
  /** Joined table, e.g. 'locations' */
  table: string;
  /** Local FK column, e.g. 'location_id' */
  localKey: string;
  /** Column to search on the joined table, e.g. 'name' */
  searchColumn: string;
}

export interface CrudOptions {
  table: string;
  searchableColumns: string[];
  /** Optional joined columns to also include in the global search (e.g. employees → locations.name) */
  joinedSearchColumns?: JoinedSearchColumn[];
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

    const T = this.opts.table;
    const joins = this.opts.joinedSearchColumns || [];

    const applyJoins = (q: Knex.QueryBuilder) => {
      for (const j of joins) {
        q.leftJoin(j.table, `${T}.${j.localKey}`, `${j.table}.id`);
      }
      return q;
    };

    const buildWhere = (q: Knex.QueryBuilder) => {
      if (this.opts.hasSoftDelete && !params.includeDeleted) {
        q.whereNull(`${T}.deleted_at`);
      }
      if (params.search && (this.opts.searchableColumns.length > 0 || joins.length > 0)) {
        const term = `%${params.search}%`;
        q.where((sub) => {
          let first = true;
          for (const col of this.opts.searchableColumns) {
            const qualified = col.includes('.') ? col : `${T}.${col}`;
            if (first) { sub.where(qualified, 'like', term); first = false; }
            else sub.orWhere(qualified, 'like', term);
          }
          for (const j of joins) {
            const qualified = `${j.table}.${j.searchColumn}`;
            if (first) { sub.where(qualified, 'like', term); first = false; }
            else sub.orWhere(qualified, 'like', term);
          }
        });
      }
      if (params.filters) {
        for (const [k, v] of Object.entries(params.filters)) {
          if (v === '' || v == null) continue;
          if (!this.opts.allowedFilterColumns.includes(k)) continue;
          // FK and boolean columns: exact match; text columns: substring match
          if (k.endsWith('_id') || k.startsWith('is_')) q.where(`${T}.${k}`, v);
          else q.where(`${T}.${k}`, 'like', `%${v}%`);
        }
      }
      return q;
    };

    const dataQ = buildWhere(applyJoins(db(T).select(`${T}.*`)));
    const countQ = buildWhere(applyJoins(db(T)));

    const sortByRaw =
      params.sortBy && this.opts.allowedSortColumns.includes(params.sortBy)
        ? params.sortBy
        : this.opts.defaultSort?.column || 'id';
    const sortBy = sortByRaw.includes('.') ? sortByRaw : `${T}.${sortByRaw}`;
    const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, [{ total }]] = await Promise.all([
      dataQ.orderBy(sortBy, sortDir).limit(pageSize).offset(offset),
      countQ.countDistinct<{ total: number }[]>(`${T}.id as total`),
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
