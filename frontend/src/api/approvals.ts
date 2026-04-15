import { api } from './client';

export const approvalsApi = {
  list: (assetType?: string) =>
    api.get('/approvals', { params: assetType ? { assetType } : {} }).then(r => r.data),
  get: (id: number) => api.get(`/approvals/${id}`).then(r => r.data),
  approve: (id: number) => api.post(`/approvals/${id}/approve`).then(r => r.data),
  reject: (id: number, notes?: string) =>
    api.post(`/approvals/${id}/reject`, { notes }).then(r => r.data),
};
