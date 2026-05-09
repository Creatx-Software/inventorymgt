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

export interface ConsumableItem {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  vendor_id: number | null;
  vendor_name?: string | null;
  location_id: number | null;
  location_name?: string | null;
  unit: string;
  current_stock: number;
  minimum_stock: number | null;
  remarks: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsumableTransaction {
  id: number;
  consumable_item_id: number;
  transaction_type: 'stock_in' | 'assigned' | 'returned';
  quantity: number;
  employee_id: number | null;
  employee_name?: string | null;
  employee_code?: string | null;
  performed_by_user_id: number;
  performed_by_username?: string | null;
  transaction_date: string;
  reference_number: string | null;
  po_number: string | null;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface ConsumableAssignment {
  employee_id: number;
  employee_name: string;
  employee_code: string | null;
  total_assigned: number;
  total_returned: number;
  net_quantity: number;
}

export interface EmployeeConsumable {
  consumable_item_id: number;
  name: string;
  category: string | null;
  unit: string;
  total_assigned: number;
  total_returned: number;
  net_quantity: number;
}
