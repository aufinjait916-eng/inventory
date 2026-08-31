# 🚀 TrueNAS SCALE & Docker Self-Hosting Guide for AssetFlow

This guide provides instructions to publish AssetFlow to GitHub, build the container image, and host it on **TrueNAS SCALE** (Dragonfish, Cobia, or Electric Eel) with PostgreSQL persistence.

---

## 📦 1. Repository Publishing & Automated Docker Build

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete AssetFlow with PostgreSQL & TrueNAS deployment"
   git push origin main
   ```
2. The included GitHub Actions workflow (`.github/workflows/docker-publish.yml`) will automatically build and publish a multi-architecture (`linux/amd64`, `linux/arm64`) Docker container to GitHub Container Registry:
   ```
   ghcr.io/<your-github-username>/assetflow:latest
   ```
3. Make sure the container package visibility on GitHub is set to **Public** (or configure a TrueNAS Container Registry secret with your GitHub Personal Access Token).

---

## 🛠️ 2. TrueNAS SCALE Setup

### Option A: Deploy via Docker Compose (Recommended)

1. SSH into your TrueNAS SCALE server or open the TrueNAS Web Shell.
2. Create a folder for the application:
   ```bash
   mkdir -p /mnt/tank/appdata/assetflow
   cd /mnt/tank/appdata/assetflow
   ```
3. Copy the `docker-compose.yml` from this repository into `/mnt/tank/appdata/assetflow/docker-compose.yml`.
4. Update the environment variables in `docker-compose.yml` (e.g., replace `YourSecurePassword123!` with a strong password).
5. Start the stack:
   ```bash
   docker compose up -d
   ```
6. Access AssetFlow in your web browser:
   ```
   http://<truenas-ip>:3000
   ```

---

### Option B: Deploy via TrueNAS SCALE "Custom App" UI

1. Open the TrueNAS SCALE Web UI.
2. Go to **Apps** &rarr; **Discover Apps** &rarr; click **Custom App** (top right).
3. Fill in the parameters:
   - **Application Name**: `assetflow`
   - **Image repository**: `ghcr.io/<your-github-username>/assetflow`
   - **Image tag**: `latest`
   - **Port Forwarding**:
     - Container Port: `3000`
     - Node Port / Host Port: `3000` (or `30080`)
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `PORT`: `3000`
     - `SQL_HOST`: IP of your PostgreSQL container or TrueNAS host IP
     - `SQL_PORT`: `5432`
     - `SQL_USER`: `assetflow_user`
     - `SQL_PASSWORD`: `<your-db-password>`
     - `SQL_DB_NAME`: `assetflow_db`
     - `SQL_SSL`: `false`
     - `SQL_POOL_MAX`: `20`
4. Click **Save** / **Install**.

---

## 🔄 3. Automatic Database Schema & Table Initialization

When AssetFlow boots up on TrueNAS:
- It automatically connects to the configured PostgreSQL instance.
- It executes `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` across all enterprise tables (assets, categories, requests, transfers, users, audit logs, etc.).
- If the database is blank, it seeds default administrative and structural records.
- You can also manually trigger schema verification at any time from the **Configuration** &rarr; **PostgreSQL Server** screen using the **"Init / Sync DB Tables"** button.

---

## 🛡️ 4. Recommended PostgreSQL Data Backup Strategy on TrueNAS

TrueNAS uses **ZFS**, making database backups simple and safe:

1. **ZFS Periodic Snapshot**: Under **Data Protection** &rarr; **Periodic Snapshot Tasks**, schedule automated snapshots of your `appdata/assetflow-db` dataset (e.g., hourly / daily with 30-day retention).
2. **Automated SQL Dump Cron Job** (Optional):
   ```bash
   docker exec -t assetflow-postgres pg_dump -U assetflow_user assetflow_db > /mnt/tank/backups/assetflow_$(date +\%F).sql
   ```

---

## ⚙️ 4. In-App PostgreSQL Configuration Screen

Log in as **System Administrator** and navigate to **Configuration &rarr; PostgreSQL Server** to:
- Test custom database connections in real-time.
- View live database size, active pool connections, and table record counts.
- Run `VACUUM ANALYZE` for performance optimization.
- View copy-ready `.env`, `Dockerfile`, and `docker-compose.yml` templates.
