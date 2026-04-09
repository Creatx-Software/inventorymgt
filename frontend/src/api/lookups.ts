import { createCrudApi } from './crud';
import type { Vendor, Location, Department, Employee } from '../types/api';

export const vendorsApi = createCrudApi<Vendor>('vendors');
export const locationsApi = createCrudApi<Location>('locations');
export const departmentsApi = createCrudApi<Department>('departments');
export const employeesApi = createCrudApi<Employee>('employees');
