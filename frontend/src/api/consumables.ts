import { api } from './client';
import { createCrudApi } from './crud';
import type {
  ConsumableItem, ConsumableTransaction, ConsumableAssignment, EmployeeConsumable,
} from '../types/api';
import type { ListParams, PaginatedResponse } from '../types/api';

export const consumablesApi = {
  ...createCrudApi<ConsumableItem>('consumables'),

  list: async (params: ListParams & { category?: string } = {}): Promise<PaginatedResponse<ConsumableItem>> => {
    const query: Record<string, any> = {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 100,
    };
    if (params.search) query.search = params.search;
    if (params.sortBy) query.sortBy = params.sortBy;
    if (params.sortDir) query.sortDir = params.sortDir;
    if (params.includeDeleted) query.includeDeleted = 'true';
    if (params.category) query.category = params.category;
    const r = await api.get('/consumables', { params: query });
    return r.data;
  },

  stockIn: async (id: number, data: {
    quantity: number;
    transaction_date: string;
    reference_number?: string;
    notes?: string;
  }): Promise<ConsumableItem> => {
    const r = await api.post(`/consumables/${id}/stock-in`, data);
    return r.data;
  },

  assign: async (id: number, data: {
    quantity: number;
    employee_id: number;
    transaction_date: string;
    notes?: string;
  }): Promise<ConsumableItem> => {
    const r = await api.post(`/consumables/${id}/assign`, data);
    return r.data;
  },

  returnItem: async (id: number, data: {
    quantity: number;
    employee_id: number;
    transaction_date: string;
    notes?: string;
  }): Promise<ConsumableItem> => {
    const r = await api.post(`/consumables/${id}/return`, data);
    return r.data;
  },

  getTransactions: async (id: number): Promise<ConsumableTransaction[]> => {
    const r = await api.get(`/consumables/${id}/transactions`);
    return r.data;
  },

  getAssignments: async (id: number): Promise<ConsumableAssignment[]> => {
    const r = await api.get(`/consumables/${id}/assignments`);
    return r.data;
  },

  getCategories: async (): Promise<string[]> => {
    const r = await api.get('/consumables/meta/categories');
    return r.data;
  },

  getByEmployee: async (employeeId: number): Promise<EmployeeConsumable[]> => {
    const r = await api.get(`/consumables/employee/${employeeId}`);
    return r.data;
  },
};
