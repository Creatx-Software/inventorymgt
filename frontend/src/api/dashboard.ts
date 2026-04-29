import { api } from './client';

export interface DashboardSummary {
  byType: Record<string, number>;
  total: number;
  unassigned: number;
  vendors: number;
  employees: number;
  locations: number;
  incidents: number;
}

export interface WarrantyAlert {
  asset_type: string;
  asset_table: string;
  asset_label: string;
  id: number;
  serial_number: string;
  asset_name: string | null;
  model: string | null;
  vendor_name: string | null;
  location_name: string | null;
  department_name: string | null;
  employee_name: string | null;
  employee_code: string | null;
  expiry_date: string;
  days_remaining: number;
}

export interface AlertBuckets {
  expired: WarrantyAlert[];
  within30: WarrantyAlert[];
  within60: WarrantyAlert[];
  within90: WarrantyAlert[];
}

export interface RecentActivity {
  id: number;
  action: string;
  entity_type: string;
  entity_type_display: string;
  entity_id: number | null;
  entity_label: string | null;
  entity_secondary: string | null;
  entity_link: string | null;
  created_at: string;
  username: string | null;
  user_full_name: string | null;
}

export interface ChartsData {
  byLocation: { name: string; value: number }[];
  byStatus: { name: string; value: number; color: string }[];
  byDepartment: { name: string; value: number }[];
  byVendor: { name: string; value: number }[];
}

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> => (await api.get('/dashboard/summary')).data,
  warranty: async (): Promise<AlertBuckets> => (await api.get('/dashboard/warranty')).data,
  eol: async (): Promise<AlertBuckets> => (await api.get('/dashboard/eol')).data,
  recentActivity: async (): Promise<RecentActivity[]> => (await api.get('/dashboard/recent-activity')).data,
  charts: async (): Promise<ChartsData> => (await api.get('/dashboard/charts')).data,
};
