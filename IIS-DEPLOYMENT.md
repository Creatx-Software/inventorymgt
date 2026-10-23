# IIS Deployment Guide

Host the Inventory Management System on Windows IIS with Node.js backend running via PM2.

## Architecture

```
Browser → IIS (port 80)
              ├── /api/*  → reverse proxy → Node.js (port 5000)
              └── /*      → static files (React build in frontend/dist)
```

---

## Prerequisites

- Windows Server / Windows 10/11 Pro
- Node.js installed
- MySQL 8+ running with `inventory_mgt` database

---

## Step 1 — Enable IIS

Open PowerShell as Administrator:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-StaticContent, IIS-DefaultDocument, IIS-HttpErrors, IIS-ApplicationDevelopment, IIS-HealthAndDiagnostics, IIS-HttpLogging, IIS-Security, IIS-RequestFiltering, IIS-Performance, IIS-WebServerManagementTools, IIS-ManagementConsole -All
```

---

## Step 2 — Install IIS Modules

Download and install both:

- **URL Rewrite**: https://www.iis.net/downloads/microsoft/url-rewrite
- **Application Request Routing (ARR)**: https://www.iis.net/downloads/microsoft/application-request-routing

---

## Step 3 — Enable Reverse Proxy in ARR

1. Open **IIS Manager**
2. Click the **server name** (top level) in the left panel
3. Double-click **Application Request Routing Cache**
4. Click **Server Proxy Settings** on the right
5. Check **Enable proxy**
6. Click **Apply**

---

## Step 4 — Build the Frontend

Edit `frontend/.env.production`:

```env
VITE_API_BASE_URL=http://172.24.40.48/api
```

Then build:

```powershell
cd C:\Users\ICICI\Documents\inventorymgt\frontend
npm install
npm run build
```

Output will be in `frontend/dist/`.

---

## Step 5 — Add web.config to Frontend Build

Create `frontend/dist/web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Proxy /api/* to Node.js backend -->
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:5000/api/{R:1}" />
        </rule>
        <!-- SPA fallback — all React routes serve index.html -->
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

> **Note:** Every time you run `npm run build`, the `dist/` folder is recreated. You must re-copy `web.config` into `dist/` after each build.

---

## Step 6 — Create IIS Website

1. Open **IIS Manager**
2. Right-click **Sites** → **Add Website**
   - **Site name**: `InventoryMgt`
   - **Physical path**: `C:\Users\ICICI\Documents\inventorymgt\frontend\dist`
   - **Port**: `80`
3. Click **OK**

---

## Step 7 — Build and Start Backend with PM2

Install PM2:

```powershell
npm install -g pm2
```

Build and start the backend:

```powershell
cd C:\Users\ICICI\Documents\inventorymgt\backend
npm install
npm run build
pm2 start dist/server.js --name inventory-backend
pm2 save
pm2 startup
```

> Run the command output by `pm2 startup` to make the backend auto-start on Windows boot.

---

## Step 8 — Update Backend Environment

Edit `backend/.env`:

```env
NODE_ENV=production
PORT=5000
CORS_ORIGIN=http://172.24.40.48
```

After editing `.env`, restart the backend:

```powershell
pm2 restart inventory-backend
```

---

## Step 9 — Windows Firewall

Allow port 80 through Windows Firewall so other devices can access the app.

In PowerShell (as Administrator):

```powershell
New-NetFirewallRule -DisplayName "InventoryMgt-IIS" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

---

## Accessing the App

| Network | URL |
|---|---|
| LAN (172.24.40.x) | http://172.24.40.48 |
| Corporate WiFi (172.24.44.x) | http://172.24.40.48 |

---

## Redeployment (after code changes)

```powershell
# 1. Rebuild frontend
cd C:\Users\ICICI\Documents\inventorymgt\frontend
npm run build

# 2. Re-copy web.config (build wipes dist/)
copy C:\Users\ICICI\Documents\inventorymgt\web.config.bak C:\Users\ICICI\Documents\inventorymgt\frontend\dist\web.config

# 3. Rebuild and restart backend
cd C:\Users\ICICI\Documents\inventorymgt\backend
npm run build
pm2 restart inventory-backend
```

> **Tip:** Save a copy of `web.config` outside `dist/` (e.g. as `web.config.bak` in the project root) so you can quickly re-copy it after each frontend build.

---

## Useful PM2 Commands

```powershell
pm2 list                        # show running processes
pm2 logs inventory-backend      # view backend logs
pm2 restart inventory-backend   # restart after changes
pm2 stop inventory-backend      # stop backend
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| White screen / 404 on page refresh | Missing SPA fallback | Check `web.config` is in `dist/` |
| `/api` calls return 404 | ARR proxy not enabled | Repeat Step 3 |
| `/api` calls return 502 | Backend not running | Run `pm2 list` and check status |
| Can't access from WiFi | Firewall blocking port 80 | Repeat Step 9 |
| CORS error in browser | Wrong `CORS_ORIGIN` in `.env` | Update to match the access URL |
