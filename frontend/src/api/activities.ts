import { api } from './client';
import type { ListParams, PaginatedResponse } from '../types/api';

export interface Activity {
  id: number;
  date: string;
  sub_category: string | null;
  ip_address: string | null;
  device: string | null;
  sn_call_number: string | null;
  raised_by_employee_id: number | null;
  raised_by_name: string | null;
  description: string | null;
  email_attachment_name: string | null;
  has_attachment: 0 | 1;
  created_by_name: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
}

export const activitiesApi = {
  list: (params: ListParams): Promise<PaginatedResponse<Activity>> =>
    api.get('/activities', { params }).then((r) => r.data),

  create: (fd: FormData): Promise<Activity> =>
    api.post('/activities', fd).then((r) => r.data),

  update: (id: number, fd: FormData): Promise<Activity> =>
    api.put(`/activities/${id}`, fd).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/activities/${id}`).then((r) => r.data),

  bulkDelete: (ids: number[]) =>
    api.post('/activities/bulk-delete', { ids }).then((r) => r.data),

  downloadAttachment: async (id: number, filename: string) => {
    const res = await api.get(`/activities/${id}/attachment`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
