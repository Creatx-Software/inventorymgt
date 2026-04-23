# Production Setup — LAN Deployment & CI/CD

Run the inventory system in production on a local Windows machine, accessible from any computer on the same network.

---

## Architecture

| Service | Port | Description |
|---|---|---|
| Frontend (static) | 3000 | Vite build served via `serve` |
| Backend (API) | 5000 | Express, binds to `0.0.0.0` |
| Database | 3306 | MySQL 8+ (local) |

---

## Step 1 — Find Your LAN IP

```powershell
ipconfig
# Look for: IPv4 Address under your active network adapter
# Example: 192.168.1.50
```

Note this IP — you will use it in every step below.

---

## Step 2 — Configure Environment Files

### `backend/.env`

```env
NODE_ENV=production
PORT=5000
API_PREFIX=/api

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=inventory_mgt

JWT_SECRET=use_a_long_random_string_here
JWT_EXPIRES_IN=12h

DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=ChangeMe123!

CORS_ORIGIN=*
```

> Set `CORS_ORIGIN=*` to allow all LAN clients. If you want to restrict it, list each client IP separated by a comma, or set it to `http://192.168.1.50:3000`.

### `frontend/.env.production`

```env
VITE_API_BASE_URL=http://192.168.1.50:5000/api
```

Replace `192.168.1.50` with your actual LAN IP from Step 1.

---

## Step 3 — Install Global Tools

Run once in any terminal:

```bash
npm install -g pm2
npm install -g serve
```

---

## Step 4 — Build Both Apps

```bash
# Backend
cd backend
npm install
npm run build

# Frontend
cd ../frontend
npm install
npm run build
# Output: frontend/dist/
```

---

## Step 5 — PM2 Ecosystem File

Create `ecosystem.config.js` in the **project root**:

```js
module.exports = {
  apps: [
    {
      name: 'inventory-backend',
      script: './backend/dist/server.js',
      cwd: './backend',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'inventory-frontend',
      script: 'serve',
      args: '-s dist -l 3000',
      cwd: './frontend',
      interpreter: 'none',
    },
  ],
};
```

---

## Step 6 — Start with PM2

```bash
cd C:\Users\ICICI\Documents\GitHub\inventorymgt

pm2 start ecosystem.config.js
pm2 save                    # persist process list across reboots
pm2 startup                 # generates a startup command — run the output it gives you
```

Check everything is running:

```bash
pm2 status
pm2 logs
```

Access the app from any machine on the network: **`http://192.168.1.50:3000`**

---

## Step 7 — Open Windows Firewall Ports

Run in PowerShell **as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "Inventory Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "Inventory Backend"  -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

---

## Step 8 — Database Setup (first time only)

```bash
cd backend
npm run migrate    # creates all tables
npm run seed       # seeds statuses, admin user, roles
```

---

## CI/CD — Auto-deploy on Git Push

Every push to `master` automatically pulls, builds, migrates, and restarts PM2 on this machine.

### Step 1 — Register a Self-Hosted GitHub Actions Runner

1. Go to your GitHub repo
2. **Settings → Actions → Runners → New self-hosted runner**
3. Select **Windows**
4. Follow the commands shown (takes ~5 minutes)

The runner service starts automatically and listens for jobs.

### Step 2 — Create the Workflow File

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Local

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - name: Pull latest code
        run: git pull origin master

      - name: Install & build backend
        working-directory: backend
        run: |
          npm install
          npm run build

      - name: Install & build frontend
        working-directory: frontend
        run: |
          npm install
          npm run build

      - name: Run DB migrations
        working-directory: backend
        run: npm run migrate

      - name: Restart PM2
        run: pm2 restart ecosystem.config.js --update-env
```

### How it works

```
git push origin master
        │
        ▼
GitHub Actions triggers workflow
        │
        ▼
Self-hosted runner on this Windows machine
  1. git pull
  2. npm install + build (backend & frontend)
  3. npm run migrate
  4. pm2 restart
        │
        ▼
New version live at http://192.168.1.50:3000
```

---

## Common PM2 Commands

```bash
pm2 status                          # show all running processes
pm2 logs                            # stream all logs
pm2 logs inventory-backend          # backend logs only
pm2 logs inventory-frontend         # frontend logs only
pm2 restart all                     # restart everything
pm2 restart inventory-backend       # restart backend only
pm2 stop all                        # stop everything
pm2 delete all                      # remove from PM2
pm2 reload ecosystem.config.js      # zero-downtime reload
```

---

## Manual Re-deploy (without CI/CD)

```bash
git pull origin master

cd backend && npm install && npm run build && npm run migrate
cd ../frontend && npm install && npm run build

pm2 restart ecosystem.config.js --update-env
```

---

## Quick Reference

| What | Value |
|---|---|
| App URL (LAN) | `http://192.168.1.50:3000` |
| API URL (LAN) | `http://192.168.1.50:5000/api` |
| Health check | `http://192.168.1.50:5000/health` |
| Default login | `admin` / `ChangeMe123!` |
| PM2 status | `pm2 status` |
| PM2 logs | `pm2 logs` |

> Replace `192.168.1.50` with your actual LAN IP throughout.
