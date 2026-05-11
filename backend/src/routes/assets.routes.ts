import { buildAssetRouter } from '../controllers/asset.controller';

const commonSearch = ['serial_number', 'sap_asset_code', 'asset_name', 'model', 'po_number', 'invoice_number'];
const commonSort = [
  'id', 'serial_number', 'sap_asset_code', 'asset_name', 'model', 'created_at', 'updated_at',
  'vendor_id', 'location_id', 'department_id', 'employee_id', 'status_id',
];
const commonFilter = [
  'serial_number', 'sap_asset_code', 'asset_name', 'model', 'vendor_id',
  'location_id', 'department_id', 'employee_id', 'status_id', 'po_number', 'invoice_number',
];

// Fields that may be bulk-edited on every asset type. Excludes per-row unique values
// like serial_number, sap_asset_code, asset_name, host_name, etc.
const commonBulkEditable = [
  'vendor_id', 'model', 'location_id', 'department_id', 'employee_id',
  'status_id', 'po_number', 'invoice_number', 'remarks',
];

export const endpointsRouter = buildAssetRouter({
  table: 'endpoints',
  assetType: 'endpoint',
  searchableColumns: [...commonSearch, 'host_name', 'asset_code', 'mac_address', 'ip_address', 'os_name_version'],
  allowedSortColumns: [...commonSort, 'endpoint_type', 'host_name', 'warranty_expiry_date', 'eol_date', 'status_name'],
  allowedFilterColumns: [...commonFilter, 'endpoint_type', 'host_name', 'asset_code', 'ip_address'],
  bulkEditableFields: [...commonBulkEditable, 'endpoint_type', 'is_under_warranty', 'warranty_expiry_date', 'eol_date'],
  defaultSort: { column: 'host_name', dir: 'asc' },
});

export const monitorsRouter = buildAssetRouter({
  table: 'monitors',
  assetType: 'monitor',
  searchableColumns: [...commonSearch, 'host_name'],
  allowedSortColumns: [...commonSort, 'host_name'],
  allowedFilterColumns: [...commonFilter, 'host_name'],
  bulkEditableFields: [...commonBulkEditable],
  defaultSort: { column: 'created_at', dir: 'desc' },
});

export const mobileDevicesRouter = buildAssetRouter({
  table: 'mobile_devices',
  assetType: 'mobile_device',
  searchableColumns: [...commonSearch, 'eid', 'mobile_number', 'sim_number', 'imei_number'],
  allowedSortColumns: [...commonSort, 'production_year'],
  allowedFilterColumns: [...commonFilter, 'mobile_number', 'imei_number'],
  bulkEditableFields: [...commonBulkEditable],
  defaultSort: { column: 'created_at', dir: 'desc' },
});

export const ipPhonesRouter = buildAssetRouter({
  table: 'ip_phones',
  assetType: 'ip_phone',
  searchableColumns: [...commonSearch, 'mac_address'],
  allowedSortColumns: [...commonSort, 'mac_address'],
  allowedFilterColumns: [...commonFilter, 'mac_address'],
  bulkEditableFields: [...commonBulkEditable],
  defaultSort: { column: 'created_at', dir: 'desc' },
});

export const serversRouter = buildAssetRouter({
  table: 'servers',
  assetType: 'server',
  searchableColumns: [...commonSearch, 'application_name', 'host_name', 'ip_address', 'can_id', 'os_name_version'],
  allowedSortColumns: [...commonSort, 'application_name', 'environment', 'application_tier', 'warranty_expiry_date', 'eol_date'],
  allowedFilterColumns: [...commonFilter, 'application_name', 'environment', 'server_type', 'server_class', 'application_tier', 'managed_by', 'dc_location'],
  bulkEditableFields: [
    ...commonBulkEditable,
    'application_tier', 'server_class', 'server_type', 'environment',
    'managed_by', 'dc_location', 'is_under_warranty', 'warranty_expiry_date', 'eol_date',
    'hardening_status', 'patching_status',
  ],
  defaultSort: { column: 'created_at', dir: 'desc' },
});

export const printersRouter = buildAssetRouter({
  table: 'printers',
  assetType: 'printer',
  searchableColumns: [...commonSearch, 'device_name', 'host_name', 'ip_address'],
  allowedSortColumns: [...commonSort, 'device_name', 'eol_date'],
  allowedFilterColumns: [...commonFilter, 'device_name', 'host_name', 'managed_by'],
  bulkEditableFields: [...commonBulkEditable, 'managed_by', 'eol_date'],
  defaultSort: { column: 'created_at', dir: 'desc' },
});

export const networkDevicesRouter = buildAssetRouter({
  table: 'network_devices',
  assetType: 'network_device',
  searchableColumns: [...commonSearch, 'device_name', 'host_name', 'ip_address', 'asset_code'],
  allowedSortColumns: [...commonSort, 'device_name', 'warranty_expiry_date', 'eol_date'],
  allowedFilterColumns: [...commonFilter, 'device_name', 'host_name', 'managed_by'],
  bulkEditableFields: [...commonBulkEditable, 'managed_by', 'warranty_expiry_date', 'eol_date'],
  defaultSort: { column: 'created_at', dir: 'desc' },
});

export const otherAssetsRouter = buildAssetRouter({
  table: 'other_assets',
  assetType: 'other_asset',
  searchableColumns: [...commonSearch, 'host_name'],
  allowedSortColumns: [...commonSort, 'host_name'],
  allowedFilterColumns: [...commonFilter, 'host_name'],
  bulkEditableFields: [...commonBulkEditable],
  defaultSort: { column: 'created_at', dir: 'desc' },
});
