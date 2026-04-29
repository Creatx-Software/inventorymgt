export interface AssetCommon {
  id: number;
  serial_number: string;
  asset_name: string | null;
  vendor_id: number | null;
  vendor_name?: string | null;
  model: string | null;
  location_id: number | null;
  location_name?: string | null;
  department_id: number | null;
  department_name?: string | null;
  employee_id: number | null;
  employee_name?: string | null;
  employee_code?: string | null;
  status_id: number;
  status_name?: string;
  status_color?: string;
  po_number: string | null;
  invoice_number: string | null;
  remarks: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  has_pending_approval?: number | boolean;
}

export interface Endpoint extends AssetCommon {
  endpoint_type: 'Laptop' | 'Desktop' | 'Scanner' | 'Other';
  host_name: string | null;
  asset_code: string | null;
  mac_address: string | null;
  os_name_version: string | null;
  ip_address: string | null;
  is_under_warranty: boolean;
  warranty_expiry_date: string | null;
  eol_date: string | null;
}

export interface Monitor extends AssetCommon {
  host_name: string | null;
}

export interface MobileDevice extends AssetCommon {
  eid: string | null;
  mobile_number: string | null;
  sim_number: string | null;
  imei_number: string | null;
  production_year: number | null;
}

export interface IpPhone extends AssetCommon {
  mac_address: string | null;
}

export interface Server extends AssetCommon {
  application_name: string | null;
  can_id: string | null;
  application_tier: '0' | '1' | '2' | '3' | '4' | null;
  server_class: 'Physical' | 'Virtual' | null;
  os_name_version: string | null;
  server_type: 'Web' | 'App' | 'DB' | 'Other' | null;
  server_software: string | null;
  managed_by: string | null;
  ip_address: string | null;
  host_name: string | null;
  asset_code: string | null;
  dc_location: string | null;
  environment: 'Prod' | 'FB' | 'DR' | null;
  is_under_warranty: boolean;
  warranty_expiry_date: string | null;
  eol_date: string | null;
  hardening_status: boolean;
  patching_status: boolean;
  exception_memo_no: string | null;
}

export interface Printer extends AssetCommon {
  device_name: string | null;
  host_name: string | null;
  ip_address: string | null;
  managed_by: string | null;
  eol_date: string | null;
}

export interface NetworkDevice extends AssetCommon {
  device_name: string | null;
  host_name: string | null;
  ip_address: string | null;
  asset_code: string | null;
  managed_by: string | null;
  warranty_expiry_date: string | null;
  eol_date: string | null;
}

export interface OtherAsset extends AssetCommon {
  host_name: string | null;
}

export interface AssetStatus {
  id: number;
  name: string;
  color: string;
}

export interface AssignmentHistory {
  id: number;
  asset_type: string;
  asset_id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string | null;
  assigned_date: string;
  returned_date: string | null;
  assigned_by_username: string | null;
  notes: string | null;
}
