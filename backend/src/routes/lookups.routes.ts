import { buildCrudRouter } from '../controllers/crud.controller';

export const vendorsRouter = buildCrudRouter({
  table: 'vendors',
  entityType: 'vendor',
  searchableColumns: ['name', 'website', 'support_contact'],
  allowedSortColumns: ['id', 'name', 'created_at', 'updated_at'],
  allowedFilterColumns: ['name', 'website'],
  hasSoftDelete: true,
  defaultSort: { column: 'name', dir: 'asc' },
});

export const locationsRouter = buildCrudRouter({
  table: 'locations',
  entityType: 'location',
  searchableColumns: ['name', 'country', 'address'],
  allowedSortColumns: ['id', 'name', 'type', 'country', 'created_at'],
  allowedFilterColumns: ['name', 'type', 'country'],
  hasSoftDelete: true,
  defaultSort: { column: 'name', dir: 'asc' },
});

export const departmentsRouter = buildCrudRouter({
  table: 'departments',
  entityType: 'department',
  searchableColumns: ['name', 'description'],
  allowedSortColumns: ['id', 'name', 'created_at'],
  allowedFilterColumns: ['name'],
  hasSoftDelete: true,
  defaultSort: { column: 'name', dir: 'asc' },
});

export const employeesRouter = buildCrudRouter({
  table: 'employees',
  entityType: 'employee',
  searchableColumns: ['full_name', 'employee_code', 'email'],
  joinedSearchColumns: [
    { table: 'locations',   localKey: 'location_id',   searchColumn: 'name' },
    { table: 'departments', localKey: 'department_id', searchColumn: 'name' },
  ],
  allowedSortColumns: ['id', 'full_name', 'employee_code', 'created_at'],
  allowedFilterColumns: ['full_name', 'employee_code', 'email', 'department_id', 'location_id', 'is_active'],
  hasSoftDelete: true,
  defaultSort: { column: 'full_name', dir: 'asc' },
});

export const assetStatusesRouter = buildCrudRouter({
  table: 'asset_statuses',
  entityType: 'asset_status',
  searchableColumns: ['name'],
  allowedSortColumns: ['id', 'name'],
  allowedFilterColumns: ['name'],
  hasSoftDelete: false,
  defaultSort: { column: 'id', dir: 'asc' },
});
