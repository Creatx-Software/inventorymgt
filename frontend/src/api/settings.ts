import { api } from './client';

export interface AppSettings {
  firewall_it_department_id: string | null;
}

export const settingsApi = {
  get: () => api.get<AppSettings>('/settings').then((r) => r.data),
  update: (data: Partial<AppSettings>) => api.put('/settings', data).then((r) => r.data),
};
