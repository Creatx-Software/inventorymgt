import { api } from './client';
import type { PaginatedResponse, ListParams } from '../types/api';

export type FirewallProtocol = 'TCP' | 'UDP' | 'TCP/UDP';
export type FirewallDirection = 'Bi-Directional' | 'Uni-Directional';
export type FirewallRuleType = 'Temp' | 'Permanent';

export interface FirewallRule {
  id: number;
  application_name: string;
  sources: string[];
  source_nats: string[];
  destinations: string[];
  destination_nats: string[];
  ports: string | null;
  protocol: FirewallProtocol;
  direction: FirewallDirection;
  rule_type: FirewallRuleType;
  expire_date: string | null;
  days_window: string | null;
  time_window: string | null;
  sn_call_number: string | null;
  engineer_requested_employee_id: number | null;
  engineer_name?: string | null;
  engineer_code?: string | null;
  request_date: string | null;
  description: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpireBucket = '1d' | '1w' | '2w' | '1m' | '3m' | 'expired';

export const firewallsApi = {
  list: async (params: ListParams & { expire_within?: ExpireBucket | '' } = {}): Promise<PaginatedResponse<FirewallRule>> => {
    const q: any = { page: params.page || 1, pageSize: params.pageSize || 100 };
    if (params.search)        q.search = params.search;
    if (params.sortBy)        { q.sortBy = params.sortBy; q.sortDir = params.sortDir || 'desc'; }
    if (params.expire_within) q.expire_within = params.expire_within;
    const r = await api.get('/firewalls', { params: q });
    return r.data;
  },
  get:    async (id: number): Promise<FirewallRule> => (await api.get(`/firewalls/${id}`)).data,
  create: async (data: Partial<FirewallRule>) => (await api.post('/firewalls', data)).data,
  update: async (id: number, data: Partial<FirewallRule>) => (await api.put(`/firewalls/${id}`, data)).data,
  remove: async (id: number) => { await api.delete(`/firewalls/${id}`); },
  bulkDelete: async (ids: number[]): Promise<{ deleted: number }> => (await api.post('/firewalls/bulk-delete', { ids })).data,
  restore: async (id: number) => { await api.post(`/firewalls/${id}/restore`); },
};
