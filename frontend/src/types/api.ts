export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, string>;
  includeDeleted?: boolean;
}

export interface Vendor {
  id: number;
  name: string;
  website: string | null;
  support_contact: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  name: string;
  type: 'office' | 'datacenter' | 'other';
  country: string | null;
  address: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  description: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: number;
  employee_code: string | null;
  full_name: string;
  email: string | null;
  department_id: number | null;
  location_id: number | null;
  is_active: boolean;
  needs_review: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
