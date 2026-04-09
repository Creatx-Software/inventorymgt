import { api } from './client';
import type { ListParams, PaginatedResponse } from '../types/api';

export interface Incident {
  id: number;
  incident_code: string | null;
  start_datetime: string;
  end_datetime: string | null;
  application_impacted: string | null;
  can_id: string | null;
  problem_statement: string | null;
  impact_assessment: string | null;
  business_impact: string | null;
  observations: string | null;
  teams_involved: string | null;
  ips_impacted: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentWithLinks extends Incident {
  servers: { id: number; serial_number: string; application_name: string | null; host_name: string | null }[];
  network_devices: { id: number; serial_number: string; device_name: string | null; host_name: string | null }[];
}

export const incidentsApi = {
  list: async (p: ListParams = {}): Promise<PaginatedResponse<Incident>> => {
    const q: any = { page: p.page || 1, pageSize: p.pageSize || 100 };
    if (p.search) q.search = p.search;
    if (p.sortBy) { q.sortBy = p.sortBy; q.sortDir = p.sortDir || 'desc'; }
    const r = await api.get('/incidents', { params: q });
    return r.data;
  },
  get: async (id: number): Promise<IncidentWithLinks> => (await api.get(`/incidents/${id}`)).data,
  create: async (data: any): Promise<Incident> => (await api.post('/incidents', data)).data,
  update: async (id: number, data: any): Promise<Incident> => (await api.put(`/incidents/${id}`, data)).data,
  remove: async (id: number): Promise<void> => { await api.delete(`/incidents/${id}`); },
  bulkDelete: async (ids: number[]): Promise<{ deleted: number }> =>
    (await api.post('/incidents/bulk-delete', { ids })).data,
};

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  user_full_name: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'LOGIN' | 'IMPORT' | 'EXPORT';
  entity_type: string;
  entity_id: number | null;
  changes: any;
  ip_address: string | null;
  created_at: string;
}

export const auditLogsApi = {
  list: async (params: ListParams & { action?: string; entity_type?: string; from?: string; to?: string } = {}): Promise<PaginatedResponse<AuditLog>> => {
    const q: any = { page: params.page || 1, pageSize: params.pageSize || 100 };
    if (params.search) q.search = params.search;
    if (params.action) q.action = params.action;
    if (params.entity_type) q.entity_type = params.entity_type;
    if (params.from) q.from = params.from;
    if (params.to) q.to = params.to;
    const r = await api.get('/audit-logs', { params: q });
    return r.data;
  },
};
