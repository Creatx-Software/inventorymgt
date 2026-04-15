# Inventory Management System

A full-stack IT asset inventory management web application for tracking hardware assets across UK and Germany offices. Built to replace Excel-based tracking with a faster, more efficient interface.

---

## Project Goal

Replace the existing Excel-based asset tracking (`UK & Germany Asset Inventory 2024 New(1).xlsx`) with a web app that is **more efficient than Excel** for adding, editing, searching, filtering, and reporting on IT assets.

---

## Tech Stack

### Frontend
- **Vite + React 18 + TypeScript**
- **TanStack Table v8** — main data grid (Excel-like tables)
- **TailwindCSS** — styling
- **React Router v6** — routing
- **Axios** — HTTP client
- **React Hook Form + Zod** — form handling and validation
- **Recharts** — dashboard charts

### Backend
- **Node.js + Express + TypeScript**
- **mysql2** + **Knex.js** — database access and migrations
- **bcryptjs** — password hashing
- **jsonwebtoken** — auth tokens
- **xlsx** (SheetJS) — Excel import/export
- **multer** — file uploads (later phase)

### Database
- **MySQL 8+**
- Database name: `inventory_mgt`

---

## Project Structure

```
inventory-mgt/
├── frontend/                 # Vite + React + TS
│   ├── src/
│   │   ├── api/              # Axios API clients (assets.ts, lookups.ts, rbac.ts, etc.)
│   │   ├── components/
│   │   │   ├── layout/       # Sidebar, Header, AppLayout
│   │   │   ├── table/        # DataTable, filters, column toggles
│   │   │   ├── forms/        # Reusable form fields
│   │   │   └── ui/           # Buttons, modals, drawers
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Endpoints.tsx
│   │   │   ├── Monitors.tsx
│   │   │   ├── MobileDevices.tsx
│   │   │   ├── IpPhones.tsx
│   │   │   ├── Servers.tsx
│   │   │   ├── Printers.tsx
│   │   │   ├── NetworkDevices.tsx
│   │   │   ├── OtherAssets.tsx
│   │   │   ├── Incidents.tsx
│   │   │   ├── Employees.tsx
│   │   │   ├── Locations.tsx
│   │   │   ├── Departments.tsx
│   │   │   ├── Vendors.tsx
│   │   │   ├── AuditLogs.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── UsersPage.tsx     # user management (superadmin/admin)
│   │   │   ├── RolesPage.tsx     # role & permission management
│   │   │   └── ApprovalsPage.tsx # pending approval review (superadmin only)
│   │   ├── contexts/         # AuthContext (includes role + permissions)
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   │   ├── IBN_BIG.svg       # company logo (used in header + login)
│   │   └── favicon.svg
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                  # Express + TS
│   ├── src/
│   │   ├── config/           # db, env
│   │   ├── controllers/      # asset.controller, auth, roles, users, incidents, etc.
│   │   ├── routes/
│   │   ├── middleware/       # auth (with requirePermission factory), error
│   │   ├── services/         # business logic, excel import/export
│   │   ├── models/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tsconfig.json
│   └── package.json
│
├── database/
│   ├── migrations/
│   │   ├── 20240101000000_init_schema.ts   # all base tables
│   │   ├── 20240102000000_rbac.ts          # roles, role_permissions, users.role_id
│   │   └── 20240103000000_pending_approvals.ts  # pending_approvals table
│   ├── seeds/
│   │   ├── 01_asset_statuses.ts   # idempotent (skips existing rows)
│   │   ├── 02_admin_user.ts       # seeds default admin
│   │   └── 03_roles.ts            # seeds superadmin/admin/user roles + permissions
│   ├── schema.sql
│   └── import-excel.ts
│
├── UK & Germany Asset Inventory 2024 New(1).xlsx
└── CLAUDE.md
```

---

## Database Schema

### Conventions
- All tables use `id INT PRIMARY KEY AUTO_INCREMENT`
- Soft delete: every asset table has `deleted_at TIMESTAMP NULL`
- Timestamps: `created_at`, `updated_at` on every table
- All foreign keys use `ON DELETE RESTRICT` (use soft delete instead)
- Serial numbers are **globally unique** across all asset tables (enforced via app logic + a `serial_registry` table)

### Lookup / Master Tables

#### `users` (web app login users)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| username | VARCHAR(100) UNIQUE | |
| email | VARCHAR(150) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| full_name | VARCHAR(150) | |
| role_id | INT FK → roles.id NULL | NULL = treated as basic user |
| is_active | BOOLEAN | default true |
| last_login_at | TIMESTAMP NULL | |
| created_at, updated_at | TIMESTAMP | |

#### `roles`
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| name | VARCHAR(100) UNIQUE | superadmin, admin, user, or custom |
| description | TEXT NULL | |
| is_system | BOOLEAN | true = cannot be edited/deleted |
| created_at, updated_at | TIMESTAMP | |

System roles seeded: **superadmin** (all permissions), **admin** (all except `roles_manage`), **user** (view-only).

#### `role_permissions`
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| role_id | INT FK → roles.id CASCADE | |
| permission | VARCHAR(100) | e.g. `endpoints_edit` |
| UNIQUE(role_id, permission) | | |

Permission key format: `{resource}_{action}` where action is `view`, `create`, `edit`, or `delete`.
Resources: `dashboard`, `endpoints`, `monitors`, `mobile_devices`, `ip_phones`, `servers`, `printers`, `network_devices`, `other_assets`, `incidents`, `employees`, `departments`, `locations`, `vendors`, `audit_logs`.
Special: `users_manage`, `roles_manage`.

#### `employees` (asset owners — NOT login users)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| employee_code | VARCHAR(50) NULL UNIQUE | Displayed as "Employee ID" in the UI |
| full_name | VARCHAR(150) | |
| email | VARCHAR(150) NULL | |
| department_id | INT FK → departments.id NULL | |
| location_id | INT FK → locations.id NULL | |
| is_active | BOOLEAN | default true |
| needs_review | BOOLEAN | flag for dupes/missing employee_code |
| created_at, updated_at | TIMESTAMP | |

#### `departments`
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| name | VARCHAR(150) UNIQUE | e.g., Stores, IT, Trading |
| description | TEXT NULL | |
| created_at, updated_at | TIMESTAMP | |

#### `locations` (offices + data centers, unified)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| name | VARCHAR(150) UNIQUE | e.g., Tower Hill - 2nd Flr, Germany Office, IBG, HYD DC, JPR DC |
| type | ENUM('office','datacenter','other') | |
| country | VARCHAR(100) | UK / Germany / India |
| address | TEXT NULL | |
| created_at, updated_at | TIMESTAMP | |

#### `vendors` (Make + Vendor merged)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| name | VARCHAR(150) UNIQUE | Dell, HP, Cisco, Apple, etc. |
| website | VARCHAR(255) NULL | |
| support_contact | VARCHAR(255) NULL | |
| created_at, updated_at | TIMESTAMP | |

#### `asset_statuses`
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| name | VARCHAR(50) UNIQUE | In Use, In Stores, Under Repair, Disposed, Lost, Returned |
| color | VARCHAR(20) | hex for UI badge |

Seeded (idempotent — skips rows that already exist).

#### `serial_registry` (enforces global serial uniqueness)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| serial_number | VARCHAR(255) UNIQUE | |
| asset_type | ENUM(...) | endpoint, monitor, mobile, ip_phone, server, printer, network_device, other |
| asset_id | INT | FK to relevant asset table |
| created_at | TIMESTAMP | |

---

### Asset Tables

All asset tables share these **common columns**:

```
id              INT PK
serial_number   VARCHAR(255) NOT NULL    -- "N/A-{type}-{n}" if missing
asset_name      VARCHAR(255)
vendor_id       INT FK → vendors.id NULL
model           VARCHAR(255) NULL
location_id     INT FK → locations.id NULL
department_id   INT FK → departments.id NULL
employee_id     INT FK → employees.id NULL  -- nullable (unassigned)
status_id       INT FK → asset_statuses.id NOT NULL
po_number       VARCHAR(100) NULL
invoice_number  VARCHAR(100) NULL
remarks         TEXT NULL
deleted_at      TIMESTAMP NULL
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### `endpoints` (Laptops/Desktops)
+ `endpoint_type` ENUM('Laptop','Desktop','Other') — **Scanner removed from UI dropdown**
+ `host_name` VARCHAR(255) — **first column in table, sticky, default sort ASC**
+ `asset_code` VARCHAR(100)
+ `mac_address` VARCHAR(50)
+ `os_name_version` VARCHAR(255)
+ `ip_address` VARCHAR(50)
+ `is_under_warranty` BOOLEAN
+ `warranty_expiry_date` DATE NULL
+ `eol_date` DATE NULL

#### `monitors`
+ `host_name` VARCHAR(255) NULL  *(for the linked PC)*

#### `mobile_devices`
+ `eid` VARCHAR(100) NULL
+ `mobile_number` VARCHAR(50) NULL
+ `sim_number` VARCHAR(100) NULL
+ `imei_number` VARCHAR(100) NULL
+ `production_year` INT NULL

#### `ip_phones`
*(only common columns needed)*

#### `servers` (most complex)
+ `application_name` VARCHAR(255)
+ `can_id` VARCHAR(100)
+ `application_tier` ENUM('0','1','2','3','4')
+ `server_class` ENUM('Physical','Virtual')
+ `os_name_version` VARCHAR(255)
+ `server_type` ENUM('Web','App','DB','Other')
+ `server_software` VARCHAR(255)
+ `managed_by` VARCHAR(100)
+ `ip_address` VARCHAR(50)
+ `host_name` VARCHAR(255)
+ `asset_code` VARCHAR(100)
+ `dc_location` VARCHAR(100)
+ `environment` ENUM('Prod','FB','DR')
+ `is_under_warranty` BOOLEAN
+ `warranty_expiry_date` DATE NULL
+ `eol_date` DATE NULL
+ `hardening_status` BOOLEAN
+ `patching_status` BOOLEAN
+ `exception_memo_no` VARCHAR(100) NULL

#### `printers`
+ `device_name` VARCHAR(255)
+ `host_name` VARCHAR(255)
+ `ip_address` VARCHAR(50)
+ `managed_by` VARCHAR(100)
+ `eol_date` DATE NULL

#### `network_devices`
+ `device_name` VARCHAR(255)
+ `host_name` VARCHAR(255)
+ `ip_address` VARCHAR(50)
+ `asset_code` VARCHAR(100)
+ `managed_by` VARCHAR(100)
+ `warranty_expiry_date` DATE NULL
+ `eol_date` DATE NULL

#### `other_assets`
+ `host_name` VARCHAR(255) NULL

---

### Supporting Tables

#### `asset_assignments` (assignment history)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| asset_type | ENUM(...) | endpoint, monitor, etc. |
| asset_id | INT | FK to asset table |
| employee_id | INT FK → employees.id | |
| assigned_date | DATE | |
| returned_date | DATE NULL | NULL = currently assigned |
| assigned_by_user_id | INT FK → users.id | |
| notes | TEXT NULL | |
| created_at | TIMESTAMP | |

#### `network_incidents`
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| incident_code | VARCHAR(100) | |
| start_datetime | DATETIME | |
| end_datetime | DATETIME NULL | |
| application_impacted | VARCHAR(255) | |
| can_id | VARCHAR(100) NULL | |
| problem_statement | TEXT | |
| impact_assessment | TEXT | |
| business_impact | TEXT | |
| observations | TEXT | |
| teams_involved | TEXT | |
| ips_impacted | TEXT | |
| created_at, updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP NULL | |

#### `incident_servers` / `incident_network_devices` (junction tables)

#### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| user_id | INT FK → users.id | |
| action | ENUM('CREATE','UPDATE','DELETE','RESTORE','LOGIN','IMPORT','EXPORT') | |
| entity_type | VARCHAR(50) | |
| entity_id | INT NULL | |
| changes | JSON | |
| ip_address | VARCHAR(50) | |
| created_at | TIMESTAMP | |

#### `pending_approvals` (admin-edit approval workflow)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| asset_type | ENUM(...) | endpoint, monitor, mobile_device, etc. |
| asset_id | INT | FK to relevant asset table |
| changed_by_user_id | INT FK → users.id | who submitted the change |
| before_data | JSON | snapshot of asset row before edit |
| after_data | JSON | snapshot of asset row after edit |
| status | ENUM('pending','approved','rejected') | default 'pending' |
| reviewed_by_user_id | INT FK → users.id NULL | superadmin who acted |
| reviewed_at | TIMESTAMP NULL | |
| notes | TEXT NULL | rejection reason |
| created_at | TIMESTAMP | |

One record per asset — if admin edits again while pending, `after_data` is updated but `before_data` is preserved.

---

## API Endpoints

All endpoints prefixed with `/api`. All routes (except `/auth/login`) require JWT.

### Auth
```
POST   /api/auth/login              # → JWT + user (includes role + permissions)
POST   /api/auth/logout
GET    /api/auth/me                 # current user with role + permissions
POST   /api/auth/change-password
```

### RBAC
```
GET    /api/roles                   # list all roles
GET    /api/roles/:id               # role + permissions array
POST   /api/roles                   # create custom role (roles_manage)
PUT    /api/roles/:id               # update role (roles_manage, non-system only)
DELETE /api/roles/:id               # delete role (roles_manage, non-system only)
PUT    /api/roles/:id/permissions   # replace full permission set

GET    /api/users                   # list all users with roles (users_manage)
GET    /api/users/:id
POST   /api/users                   # create user (users_manage)
PUT    /api/users/:id               # update user (users_manage)
PUT    /api/users/:id/toggle-active
```

### Dashboard
```
GET    /api/dashboard/summary
GET    /api/dashboard/warranty
GET    /api/dashboard/recent-activity
GET    /api/dashboard/charts
```

### Asset Endpoints (one set per asset type)
For each of: `endpoints`, `monitors`, `mobile-devices`, `ip-phones`, `servers`, `printers`, `network-devices`, `other-assets`:
```
GET    /api/{type}
GET    /api/{type}/:id
POST   /api/{type}
PUT    /api/{type}/:id
DELETE /api/{type}/:id
POST   /api/{type}/:id/restore
POST   /api/{type}/bulk-delete
GET    /api/{type}/export
POST   /api/{type}/import
GET    /api/{type}/template
GET    /api/{type}/:id/history
```

**List query params:** `?page=1&pageSize=100&search=&sortBy=&sortDir=&filters[field]=value&includeDeleted=false`

### Lookups
```
GET/POST/PUT/DELETE  /api/employees
GET/POST/PUT/DELETE  /api/departments
GET/POST/PUT/DELETE  /api/locations
GET/POST/PUT/DELETE  /api/vendors
GET                  /api/asset-statuses
```

### Network Incidents
```
GET/POST/PUT/DELETE  /api/incidents
GET                  /api/incidents/:id
```

### Audit
```
GET    /api/audit-logs
```

### Approvals
```
GET    /api/approvals              # list pending approvals (superadmin only); ?assetType= filter
GET    /api/approvals/:id          # single approval with parsed JSON
POST   /api/approvals/:id/approve  # approve — marks record approved (superadmin only)
POST   /api/approvals/:id/reject   # reject — restores before_data to asset (superadmin only)
```

---

## Frontend Pages

| Route | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/` | Dashboard | `dashboard_view` |
| `/endpoints` | Endpoints | `endpoints_view` |
| `/monitors` | Monitors | `monitors_view` |
| `/mobile-devices` | Mobile Devices | `mobile_devices_view` |
| `/ip-phones` | IP Phones | `ip_phones_view` |
| `/servers` | Servers | `servers_view` |
| `/printers` | Printers | `printers_view` |
| `/network-devices` | Network Devices | `network_devices_view` |
| `/other-assets` | Other Assets | `other_assets_view` |
| `/incidents` | Network Incidents | `incidents_view` |
| `/employees` | Employees | `employees_view` |
| `/departments` | Departments | `departments_view` |
| `/locations` | Locations | `locations_view` |
| `/vendors` | Vendors | `vendors_view` |
| `/audit-logs` | Audit Trail | `audit_logs_view` |
| `/settings` | Settings | All users |
| `/users` | User Management | `users_manage` or superadmin |
| `/roles` | Roles & Permissions | `roles_manage` or superadmin |
| `/approvals` | Pending Approvals | superadmin only |

Sidebar items are filtered automatically based on the logged-in user's permissions.

---

## RBAC System

### User Types
| Role | Description |
|---|---|
| **superadmin** | Full access. Can manage roles, users, and all assets. Cannot be deleted or edited. |
| **admin** | All permissions except `roles_manage`. Can manage users. |
| **user** | View-only access to all resources. |
| **custom** | Any role created by superadmin/admin with a specific permission set. |

### AuthContext
`useAuth()` exposes:
- `user` — includes `role` and `permissions[]`
- `hasPermission(key: string)` — returns true if superadmin or permission is in list
- `isSuperAdmin()` — returns true if role === 'superadmin'

### Backend Permission Guard
`requirePermission('key')` middleware factory. Superadmins bypass all checks.

---

## Authentication & Session

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens — **12-hour expiry** stored in `localStorage`
- **Auto-logout** after 12 hours: `loginAt` timestamp stored on login; `setTimeout` fires logout at the 12-hour mark; expired sessions cleared on page reload
- Auth middleware loads user's role + permissions from DB on every request
- Login/me responses include `role` and `permissions[]`
- One default admin seeded on first run (promoted to superadmin by seed `03_roles`):
  ```
  DEFAULT_ADMIN_USERNAME=admin
  DEFAULT_ADMIN_EMAIL=admin@example.com
  DEFAULT_ADMIN_PASSWORD=ChangeMe123!
  ```

---

## Soft Delete

- All asset and lookup tables have `deleted_at TIMESTAMP NULL`
- Default list queries exclude soft-deleted rows
- "Show deleted" toggle in UI allows viewing them
- Hard delete is **never** exposed via the API

---

## Endpoints Table — Special Behaviour

- **Host** is the **first column** and the **sticky column** (fixed when scrolling horizontally)
- Default sort: **Host name A → Z**
- Status column is **sortable** (sorts by status name via `asset_statuses.name`)
- `endpoint_type` options: Laptop, Desktop, Other — **Scanner is not offered in the UI** (DB ENUM still includes it for existing records)

---

## UI Conventions

- **IBN_BIG.svg** (from `/public`) is displayed in the Header (left side) and on the Login screen
- Login screen footer: "Design & Developed by: creatxsoftware.com" (opens in new tab)
- `employee_code` column is labelled **"Employee ID"** everywhere in the UI (field name unchanged in DB/API)

---

## Dashboard

### Summary cards
- Total Endpoints, Monitors, Mobile Devices, IP Phones, Servers, Printers, Network Devices, Other Assets

### Warranty alerts (with color coding)
- Expired, expiring in 30 / 60 / 90 days — same logic for `eol_date`

### Charts
- Assets by location (bar), by status (pie), by department (bar), by vendor (bar, top 10)

---

## Environment Variables

### Backend `.env`
```
NODE_ENV=development
PORT=5000
API_PREFIX=/api

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=inventory_mgt

JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=12h

DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=ChangeMe123!

CORS_ORIGIN=http://localhost:5173
```

### Frontend `.env`
```
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Commands

```bash
# Backend
cd backend
npm install
npm run dev               # nodemon + ts-node, port 5000
npm run build
npm start
npm run migrate           # knex migrate:latest (run after pulling new migrations)
npm run migrate:rollback
npm run seed              # idempotent — safe to re-run
npm run import-excel      # one-time migration of the source xlsx

# Frontend
cd frontend
npm install
npm run dev               # vite, port 5173
npm run build
npm run preview
```

### First-time setup order
```bash
cd backend
npm run migrate    # creates all tables including roles/role_permissions
npm run seed       # seeds statuses + admin user + roles
npm run dev
```

---

## Build Phases

### Phase 1 — Foundation ✅
- DB, migrations, seeds, auth (JWT), login page, AuthContext

### Phase 2 — Lookups ✅
- CRUD for vendors, locations, departments, employees
- Reusable DataTable component

### Phase 3 — Asset Tables ✅
- All 8 asset types with CRUD, table pages, detail drawers, assignment history

### Phase 4 — Excel Migration & Import ✅
- One-time import script
- Smart Excel import UI (column mapping, dry-run)

### Phase 5 — Incidents & Audit ✅
- Network Incidents CRUD
- Audit log middleware + page

### Phase 6 — Dashboard ✅
- Summary cards, warranty alerts, charts, recent activity

### Phase 7 — RBAC ✅
- Roles table, role_permissions, users.role_id migration
- Superadmin / admin / user system roles seeded
- Permission-gated sidebar, API guards, Users page, Roles & Permissions page

### Phase 8 — Approval Workflow ✅
- Non-superadmin edits create a `pending_approvals` record with before/after JSON snapshots
- Asset rows with pending approvals show an amber clock icon on the serial number column
- `/approvals` page (superadmin only): asset type filter bar, pending items list
- Review drawer: shows all fields, changed fields highlighted red/green at top
- Approve action: marks record approved, asset retains the edit
- Reject action: restores `before_data` to the asset table, marks record rejected

### Phase 9 — Polish (in progress)
- Keyboard shortcuts, saved views, column toggles
- Soft-delete restore UI, bulk operations

---

## Notes & Constraints

- **Local only** — CORS limited to `localhost:5173`
- **English only**, **GBP (£)** currency
- **Date format:** DD/MM/YYYY in UI; ISO `YYYY-MM-DD` in API/DB
- **Serial numbers**: globally unique; missing serials auto-filled as `N/A-{type}-{n}`
- **Soft delete only** — no hard deletes via API
- **No file uploads** in v1
- **No email notifications** in v1
- **No barcode/QR scanning** in v1
- **No multi-tenancy** — single company
- **Mobile Devices Old** sheet from source xlsx is ignored
- **"Department 1"** column from Endpoints sheet is ignored

---

## Source Data Reference

Original Excel file: `UK & Germany Asset Inventory 2024 New(1).xlsx`

| Sheet | Rows | Maps to |
|---|---|---|
| Endpoints | 702 | `endpoints` |
| IP Phones Germany | 26 | `ip_phones` |
| Mobile Devices | 146 | `mobile_devices` |
| Monitors | 291 | `monitors` |
| Other Assets | 992 | `other_assets` |
| Servers | 71 | `servers` |
| Printers | 62 | `printers` |
| Network Devices | 212 | `network_devices` |
| Network Down Incidents | 8 | `network_incidents` |
| Mobile Devices Old | 121 | **ignored** |
| DataFields, Public IP, Sheet1 | — | **ignored** |
