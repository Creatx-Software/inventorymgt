import { api } from './client';
import type { ListParams, PaginatedResponse } from '../types/api';

export interface Incident {
  id: number;
  date: string | null;
  incident_code: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  application_impacted: string | null;
  problem_statement: string | null;
  sn_call_number: string | null;
  raised_by_employee_id: number | null;
  raised_by_name: string | null;
  email_attachment_name: string | null;
  has_attachment: 0 | 1;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export const incidentsApi = {
  list: (p: ListParams = {}): Promise<PaginatedResponse<Incident>> =>
    api.get('/incidents', { params: p }).then((r) => r.data),
  get: (id: number): Promise<Incident> => api.get(`/incidents/${id}`).then((r) => r.data),
  create: (fd: FormData): Promise<Incident> => api.post('/incidents', fd).then((r) => r.data),
  update: (id: number, fd: FormData): Promise<Incident> => api.put(`/incidents/${id}`, fd).then((r) => r.data),
  remove: (id: number): Promise<void> => api.delete(`/incidents/${id}`).then(() => {}),
  bulkDelete: (ids: number[]): Promise<{ deleted: number }> =>
    api.post('/incidents/bulk-delete', { ids }).then((r) => r.data),
  downloadAttachment: async (id: number, filename: string) => {
    const res = await api.get(`/incidents/${id}/attachment`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  },
};

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  user_full_name: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'LOGIN' | 'IMPORT' | 'EXPORT';
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

export interface AuditEntityType {
  key: string;
  displayName: string;
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
  entityTypes: async (): Promise<AuditEntityType[]> => (await api.get('/audit-logs/entity-types')).data,
};
