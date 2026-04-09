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
│   │   ├── api/              # Axios API clients
│   │   ├── components/
│   │   │   ├── layout/       # Sidebar, Header, etc.
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
│   │   │   ├── NetworkIncidents.tsx
│   │   │   ├── Employees.tsx
│   │   │   ├── Locations.tsx
│   │   │   ├── Departments.tsx
│   │   │   ├── Vendors.tsx
│   │   │   └── Settings.tsx
│   │   ├── contexts/         # AuthContext
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                  # Express + TS
│   ├── src/
│   │   ├── config/           # db, env
│   │   ├── controllers/      # one per asset type + auth, etc.
│   │   ├── routes/
│   │   ├── middleware/       # auth, error, audit
│   │   ├── services/         # business logic, excel import/export
│   │   ├── models/           # Knex queries (or repos)
│   │   ├── utils/
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tsconfig.json
│   └── package.json
│
├── database/
│   ├── migrations/           # Knex migration files
│   ├── seeds/                # Seed data (admin user, statuses, etc.)
│   ├── schema.sql            # Reference SQL schema
│   └── import-excel.ts       # One-time migration script for the original .xlsx
│
├── UK & Germany Asset Inventory 2024 New(1).xlsx   # Source data
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

#### `users` (web app login users — admin)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| username | VARCHAR(100) UNIQUE | |
| email | VARCHAR(150) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| full_name | VARCHAR(150) | |
| is_active | BOOLEAN | default true |
| last_login_at | TIMESTAMP NULL | |
| created_at, updated_at | TIMESTAMP | |

Seeded with one default admin (credentials in `.env`, hashed on first run).

#### `employees` (asset owners — NOT login users)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| employee_code | VARCHAR(50) NULL UNIQUE | The "Employee ID" from Excel |
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

Seeded.

#### `serial_registry` (enforces global serial uniqueness)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| serial_number | VARCHAR(255) UNIQUE | |
| asset_type | ENUM(...) | endpoint, monitor, mobile, ip_phone, server, printer, network_device, other |
| asset_id | INT | FK to relevant asset table |
| created_at | TIMESTAMP | |

When an asset is created/updated/soft-deleted, this table is kept in sync. Provides O(1) global uniqueness check and reverse lookup.

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

Then each asset type adds its own specific columns:

#### `endpoints` (Laptops/Desktops/Scanners)
+ `endpoint_type` ENUM('Laptop','Desktop','Scanner','Other')
+ `host_name` VARCHAR(255)
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
+ `server_software` VARCHAR(255)             -- e.g. IIS / WebLogic / Oracle
+ `managed_by` VARCHAR(100)                  -- IBG / India
+ `ip_address` VARCHAR(50)
+ `host_name` VARCHAR(255)
+ `asset_code` VARCHAR(100)
+ `dc_location` VARCHAR(100)                 -- IBG / HYD DC / JPR DC (also FK to locations)
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
| assigned_by_user_id | INT FK → users.id | which admin made the change |
| notes | TEXT NULL | |
| created_at | TIMESTAMP | |

When an asset's `employee_id` changes, the system auto-closes the previous assignment row (sets `returned_date`) and inserts a new one.

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

#### `incident_servers` (junction)
| incident_id INT FK | server_id INT FK | PK(incident_id, server_id) |

#### `incident_network_devices` (junction)
| incident_id INT FK | network_device_id INT FK | PK(incident_id, network_device_id) |

#### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| user_id | INT FK → users.id | who did it |
| action | ENUM('CREATE','UPDATE','DELETE','RESTORE','LOGIN','IMPORT','EXPORT') | |
| entity_type | VARCHAR(50) | endpoint, server, employee, etc. |
| entity_id | INT NULL | |
| changes | JSON | `{ field: { old, new }, ... }` |
| ip_address | VARCHAR(50) | |
| created_at | TIMESTAMP | |

Logged via Express middleware on every mutating request.

---

## API Endpoints

All endpoints prefixed with `/api`. All routes (except `/auth/login`) require JWT.

### Auth
```
POST   /api/auth/login              # username + password → JWT
POST   /api/auth/logout
GET    /api/auth/me                 # current user
POST   /api/auth/change-password
```

### Dashboard
```
GET    /api/dashboard/summary       # counts per asset type
GET    /api/dashboard/warranty      # expired + expiring 30/60/90
GET    /api/dashboard/recent-activity
GET    /api/dashboard/charts        # by location, by status
```

### Asset Endpoints (one set per asset type)
For each of: `endpoints`, `monitors`, `mobile-devices`, `ip-phones`, `servers`, `printers`, `network-devices`, `other-assets`:

```
GET    /api/{type}                  # list with pagination, filters, sort
GET    /api/{type}/:id               # single
POST   /api/{type}                   # create
PUT    /api/{type}/:id               # update
DELETE /api/{type}/:id               # soft delete
POST   /api/{type}/:id/restore       # undelete
POST   /api/{type}/bulk-delete       # multiple ids
GET    /api/{type}/export            # CSV / XLSX of current filter
POST   /api/{type}/import            # smart Excel import (column mapping)
GET    /api/{type}/template          # download Excel template
GET    /api/{type}/:id/history       # assignment history
```

**List query params:**
`?page=1&pageSize=100&search=&sortBy=&sortDir=&filters[field]=value&includeDeleted=false`

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
GET    /api/incidents
POST   /api/incidents
PUT    /api/incidents/:id
DELETE /api/incidents/:id
GET    /api/incidents/:id           # includes linked servers + network devices
```

### Audit
```
GET    /api/audit-logs              # paginated, filter by user/entity/date
```

---

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | username + password |
| `/` | Dashboard | summary cards, warranty alerts, charts |
| `/endpoints` | Endpoints | data table |
| `/monitors` | Monitors | data table |
| `/mobile-devices` | Mobile Devices | data table |
| `/ip-phones` | IP Phones | data table |
| `/servers` | Servers | data table |
| `/printers` | Printers | data table |
| `/network-devices` | Network Devices | data table |
| `/other-assets` | Other Assets | data table |
| `/incidents` | Network Incidents | list + create/edit |
| `/employees` | Employees | master list |
| `/departments` | Departments | master list |
| `/locations` | Locations | master list |
| `/vendors` | Vendors | master list |
| `/audit-logs` | Audit Trail | filterable log |
| `/settings` | Settings | change password, app config |

---

## Data Table Standard (the core UX)

Every asset page uses the **same** data table component with these features:

- **All columns visible** with horizontal scroll
- **Sticky header row** + **sticky first 2 columns** (Serial + Asset Name)
- **Compact rows** (~30px high) — Excel-like density
- **Default page size: 100**, options: 25 / 50 / 100 / 200 / All
- **Inline editing** — double-click any cell to edit, Enter to save, Esc to cancel
- **Quick add row** at the top of the table
- **Per-column filters** in headers (text search, dropdown for FKs, date range for dates)
- **Global search bar** across all columns
- **Multi-column sort**
- **Column show/hide toggle** with **saved views** per asset type
- **Bulk select** → bulk delete / bulk export
- **Right-side detail drawer** — click row to see all fields + edit form
- **Keyboard shortcuts:** Tab/Shift+Tab navigate cells, Enter save, Esc cancel, Ctrl+S save row, `/` focus search
- **Export:** CSV + XLSX of current filtered view
- **Import:** Smart Excel import with column-mapping UI

Built with **TanStack Table v8**.

---

## Excel Import (Smart Mapping)

The Excel import is **smart**, not strict:

1. User uploads `.xlsx` file
2. App reads first sheet, shows preview of first 10 rows
3. App displays a **mapping screen**: each Excel column → dropdown of target DB column
4. App auto-suggests mappings based on header similarity (e.g., "Make" → `vendor`, "Branch" → `location`)
5. User confirms / adjusts mapping
6. App validates rows:
   - Missing serial → auto-fill `N/A-{type}-{auto#}`
   - Unknown vendor/location/department/employee → **auto-create** lookup row
   - Employee without ID → match by name; if multiple matches, flag for review
7. Import runs in a transaction with a **dry-run preview** first (X to insert, Y to update, Z errors)
8. User confirms → import executes, results logged in `audit_logs` and shown in summary

The same engine powers `database/import-excel.ts` (the one-time migration script).

---

## Authentication

- Single admin role for now (room to expand later)
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens (7-day expiry) stored in `localStorage`
- Auth middleware validates JWT on every protected route
- One default admin seeded on first run from `.env`:
  ```
  DEFAULT_ADMIN_USERNAME=admin
  DEFAULT_ADMIN_EMAIL=admin@example.com
  DEFAULT_ADMIN_PASSWORD=ChangeMe123!
  ```
- Login screen at `/login`; password change in `/settings`

---

## Soft Delete

- All asset and lookup tables have `deleted_at TIMESTAMP NULL`
- Default list queries exclude rows where `deleted_at IS NOT NULL`
- "Show deleted" toggle in UI (admin only) allows viewing soft-deleted rows
- Restore endpoint sets `deleted_at = NULL`
- Hard delete is **never** exposed via the API

---

## Dashboard

### Summary cards
- Total Endpoints, Monitors, Mobile Devices, IP Phones, Servers, Printers, Network Devices, Other Assets

### Warranty alerts (with color coding)
- 🔴 **Expired** (warranty_expiry_date < today)
- 🟠 **Expiring in 30 days**
- 🟡 **Expiring in 60 days**
- 🟢 **Expiring in 90 days**

Same logic for `eol_date` (EOS/EOL alerts).

### Recent Activity
- Last 10 entries from `audit_logs`

### Unassigned Assets
- Count of assets where `employee_id IS NULL` and `status = 'In Use'`

### Charts
- Assets by location (bar)
- Assets by status (pie)
- Assets by department (bar)
- Assets by vendor (bar, top 10)

---

## Environment Variables

### Backend `.env`
```
NODE_ENV=development
PORT=5000
API_PREFIX=/api

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=inventory_mgt

# JWT
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=7d

# Default admin (seeded on first run)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=ChangeMe123!

# CORS
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
npm run migrate           # knex migrate:latest
npm run migrate:rollback
npm run seed              # seed lookups + admin user
npm run import-excel      # one-time migration of the source xlsx

# Frontend
cd frontend
npm install
npm run dev               # vite, port 5173
npm run build
npm run preview
```

---

## Build Phases

### Phase 1 — Foundation
1. Initialize `frontend/`, `backend/`, `database/` with TypeScript and dependencies
2. MySQL connection + Knex setup
3. Migrations for **all** tables (lookups + assets + supporting)
4. Seed asset_statuses, default admin
5. Auth: login endpoint, JWT middleware, login page, AuthContext

### Phase 2 — Lookups
6. CRUD APIs and pages for: vendors, locations, departments, employees
7. Reusable `DataTable` component (TanStack Table) with all features

### Phase 3 — Asset Tables (one type at a time)
8. Endpoints (CRUD + table page + detail drawer + assignment history)
9. Repeat for: Monitors, Mobile Devices, IP Phones, Printers, Network Devices, Other Assets, Servers

### Phase 4 — Excel Migration & Import
10. `database/import-excel.ts` — one-time migration script for the source xlsx
11. Smart Excel import UI (column mapping, dry-run preview)
12. Excel/CSV export per asset type

### Phase 5 — Incidents & Audit
13. Network Incidents CRUD + linking to servers/devices
14. Audit log middleware + audit log page

### Phase 6 — Dashboard
15. Summary cards, warranty alerts, charts, recent activity

### Phase 7 — Polish
16. Keyboard shortcuts, saved views, column toggles
17. Soft-delete restore UI, bulk operations
18. Settings page (change password)

---

## Notes & Constraints

- **Local only** — runs on developer machine. CORS limited to `localhost:5173`.
- **English only**, **GBP (£)** currency.
- **Date format:** DD/MM/YYYY in UI; ISO `YYYY-MM-DD` in API/DB.
- **Serial numbers**: globally unique. Missing serials auto-filled as `N/A-{type}-{n}`.
- **Soft delete only** — no hard deletes via API.
- **No file uploads** in v1 (planned for later: warranty PDFs, invoice scans, asset photos).
- **No email notifications** in v1 (warranty alerts shown on dashboard only).
- **No barcode/QR scanning** in v1.
- **No multi-tenancy** — single company.
- **Mobile Devices Old** sheet from the source xlsx is ignored (not migrated).
- **"Department 1"** column from the Endpoints sheet is ignored.

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
