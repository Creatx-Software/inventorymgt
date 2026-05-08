/**
 * Field-kind metadata used by the BulkEditModal to render the correct input.
 */
export type BulkFieldKind =
  | 'text'
  | 'textarea'
  | 'date'
  | 'bool'
  | 'enum'
  | 'fk-vendor'
  | 'fk-location'
  | 'fk-department'
  | 'fk-employee'
  | 'fk-status';

export interface BulkField {
  key: string;
  label: string;
  kind: BulkFieldKind;
  /** Options for `kind: 'enum'` — { value, label } */
  options?: { value: string; label: string }[];
  /** Helper text shown beneath the input */
  hint?: string;
}

/** Fields shared across every asset type. */
export const COMMON_BULK_FIELDS: BulkField[] = [
  { key: 'status_id',      label: 'Status',          kind: 'fk-status' },
  { key: 'employee_id',    label: 'Assigned Employee', kind: 'fk-employee', hint: 'Set to "(unassign)" to remove the assignment' },
  { key: 'location_id',    label: 'Location',        kind: 'fk-location' },
  { key: 'department_id',  label: 'Department',      kind: 'fk-department' },
  { key: 'vendor_id',      label: 'Vendor / Make',   kind: 'fk-vendor' },
  { key: 'model',          label: 'Model',           kind: 'text' },
  { key: 'po_number',      label: 'PO Number',       kind: 'text' },
  { key: 'invoice_number', label: 'Invoice Number',  kind: 'text' },
  { key: 'remarks',        label: 'Remarks',         kind: 'textarea' },
];

/** Endpoints-only extras */
export const ENDPOINT_EXTRA_BULK_FIELDS: BulkField[] = [
  {
    key: 'endpoint_type', label: 'Type', kind: 'enum',
    options: [
      { value: 'Laptop', label: 'Laptop' },
      { value: 'Desktop', label: 'Desktop' },
      { value: 'Other', label: 'Other' },
    ],
  },
  { key: 'is_under_warranty',    label: 'Under Warranty',  kind: 'bool' },
  { key: 'warranty_expiry_date', label: 'Warranty Expiry', kind: 'date' },
  { key: 'eol_date',             label: 'EOL Date',        kind: 'date' },
];

/** Servers-only extras */
export const SERVER_EXTRA_BULK_FIELDS: BulkField[] = [
  {
    key: 'application_tier', label: 'Application Tier', kind: 'enum',
    options: ['0', '1', '2', '3', '4'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'server_class', label: 'Server Class', kind: 'enum',
    options: [{ value: 'Physical', label: 'Physical' }, { value: 'Virtual', label: 'Virtual' }],
  },
  {
    key: 'server_type', label: 'Server Type', kind: 'enum',
    options: ['Web', 'App', 'DB', 'Other'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'environment', label: 'Environment', kind: 'enum',
    options: [
      { value: 'Prod', label: 'Prod' },
      { value: 'FB', label: 'FB' },
      { value: 'DR', label: 'DR' },
    ],
  },
  { key: 'managed_by',           label: 'Managed By',      kind: 'text' },
  { key: 'dc_location',          label: 'DC Location',     kind: 'text' },
  { key: 'is_under_warranty',    label: 'Under Warranty',  kind: 'bool' },
  { key: 'warranty_expiry_date', label: 'Warranty Expiry', kind: 'date' },
  { key: 'eol_date',             label: 'EOL Date',        kind: 'date' },
  { key: 'hardening_status',     label: 'Hardened',        kind: 'bool' },
  { key: 'patching_status',      label: 'Patched',         kind: 'bool' },
];

export const PRINTER_EXTRA_BULK_FIELDS: BulkField[] = [
  { key: 'managed_by', label: 'Managed By', kind: 'text' },
  { key: 'eol_date',   label: 'EOL Date',    kind: 'date' },
];

export const NETWORK_DEVICE_EXTRA_BULK_FIELDS: BulkField[] = [
  { key: 'managed_by',           label: 'Managed By',      kind: 'text' },
  { key: 'warranty_expiry_date', label: 'Warranty Expiry', kind: 'date' },
  { key: 'eol_date',             label: 'EOL Date',        kind: 'date' },
];

/** Returns the list of bulk-editable fields for a given asset type. */
export function getBulkFieldsForType(assetType: string): BulkField[] {
  switch (assetType) {
    case 'endpoint':       return [...COMMON_BULK_FIELDS, ...ENDPOINT_EXTRA_BULK_FIELDS];
    case 'server':         return [...COMMON_BULK_FIELDS, ...SERVER_EXTRA_BULK_FIELDS];
    case 'printer':        return [...COMMON_BULK_FIELDS, ...PRINTER_EXTRA_BULK_FIELDS];
    case 'network_device': return [...COMMON_BULK_FIELDS, ...NETWORK_DEVICE_EXTRA_BULK_FIELDS];
    default:               return [...COMMON_BULK_FIELDS];
  }
}
