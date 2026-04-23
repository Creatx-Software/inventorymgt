import { api } from './client';
import type { ListParams, PaginatedResponse } from '../types/api';

export function createCrudApi<T extends { id: number }>(resource: string) {
  return {
    list: async (params: ListParams = {}): Promise<PaginatedResponse<T>> => {
      const query: Record<string, any> = {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 100,
      };
      if (params.search) query.search = params.search;
      if (params.sortBy) query.sortBy = params.sortBy;
      if (params.sortDir) query.sortDir = params.sortDir;
      if (params.includeDeleted) query.includeDeleted = 'true';
      if (params.filters) Object.assign(query, params.filters);
      const r = await api.get(`/${resource}`, { params: query });
      return r.data;
    },
    get: async (id: number): Promise<T> => (await api.get(`/${resource}/${id}`)).data,
    create: async (data: Partial<T>): Promise<T> => (await api.post(`/${resource}`, data)).data,
    update: async (id: number, data: Partial<T>): Promise<T> =>
      (await api.put(`/${resource}/${id}`, data)).data,
    remove: async (id: number): Promise<void> => {
      await api.delete(`/${resource}/${id}`);
    },
    bulkDelete: async (ids: number[]): Promise<{ deleted: number }> =>
      (await api.post(`/${resource}/bulk-delete`, { ids })).data,
    restore: async (id: number): Promise<void> => {
      await api.post(`/${resource}/${id}/restore`);
    },
    hardDelete: async (id: number): Promise<void> => {
      await api.delete(`/${resource}/${id}/permanent`);
    },
    bulkHardDelete: async (ids: number[]): Promise<{ deleted: number }> =>
      (await api.post(`/${resource}/bulk-permanent-delete`, { ids })).data,
  };
}
