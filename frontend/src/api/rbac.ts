import { api } from './client';

export const rolesApi = {
  list: () => api.get('/roles').then(r => r.data),
  get: (id: number) => api.get(`/roles/${id}`).then(r => r.data),
  create: (data: any) => api.post('/roles', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/roles/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/roles/${id}`).then(r => r.data),
  setPermissions: (id: number, permissions: string[]) =>
    api.put(`/roles/${id}/permissions`, { permissions }).then(r => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then(r => r.data),
  get: (id: number) => api.get(`/users/${id}`).then(r => r.data),
  create: (data: any) => api.post('/users', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data).then(r => r.data),
  toggleActive: (id: number) => api.put(`/users/${id}/toggle-active`).then(r => r.data),
};
