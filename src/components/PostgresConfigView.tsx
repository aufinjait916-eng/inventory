import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  Layers,
  HardDrive,
  ShieldCheck,
  Zap,
  Terminal,
  Copy,
  Check,
  FileCode,
  Download,
  ExternalLink,
  Sliders,
  HelpCircle,
  Play,
  Clock,
  Sparkles,
  Info,
  KeyRound,
  Network,
  Container,
  RotateCcw,
  Trash2,
  Filter,
  Search,
  AlertTriangle,
  CheckSquare,
  Square,
  Boxes,
  FolderKanban,
  Building2,
  ScrollText,
  Users,
  X,
  ShieldAlert,
  HardDriveDownload,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { PostgresConfigInfo, DbConnectionTestResult, DbTableStat } from '../types.ts';
import { DatabaseBackupRestoreView } from './DatabaseBackupRestoreView.tsx';

export const PostgresConfigView: React.FC = () => {
  const { showToast, currentRole } = useApp();
  const [config, setConfig] = useState<PostgresConfigInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'diagnostics' | 'backup_restore' | 'table_reset' | 'tester' | 'truenas' | 'docker_ci'>('diagnostics');

  // Connection Tester State
  const [testMode, setTestMode] = useState<'params' | 'uri'>('params');
  const [testHost, setTestHost] = useState('');
  const [testPort, setTestPort] = useState('5432');
  const [testUser, setTestUser] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testDb, setTestDb] = useState('');
  const [testSsl, setTestSsl] = useState(false);
  const [testUri, setTestUri] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DbConnectionTestResult | null>(null);

  // Table Reset & Purge State (Admin)
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [reseedDemoOnReset, setReseedDemoOnReset] = useState(false);

  // Maintenance State
  const [vacuuming, setVacuuming] = useState(false);
  const [initializingTables, setInitializingTables] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<PostgresConfigInfo>('/api/postgres-config');
      setConfig(data);
      if (data && !testHost) {
        setTestHost(data.host);
        setTestPort(String(data.port));
        setTestUser(data.user);
        setTestDb(data.databaseName);
        setTestSsl(data.ssl);
      }
    } catch (err: any) {
      console.error('Failed to load database configuration:', err);
      showToast(err.message || 'Failed to load PostgreSQL config', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleInitTables = async () => {
    try {
      setInitializingTables(true);
      const res = await fetchApi<{ success: boolean; message: string; activeTablesCount: number }>('/api/postgres-config/init-tables', {
        method: 'POST',
      });
      showToast(res.message || `All ${res.activeTablesCount} tables initialized & verified!`, 'success');
      await loadConfig();
    } catch (err: any) {
      showToast(err.message || 'Failed to initialize database tables', 'error');
    } finally {
      setInitializingTables(false);
    }
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTesting(true);
      setTestResult(null);
      const payload =
        testMode === 'uri'
          ? { connectionString: testUri, ssl: testSsl }
          : {
              host: testHost,
              port: parseInt(testPort) || 5432,
              user: testUser,
              password: testPassword,
              database: testDb,
              ssl: testSsl,
            };

      const res = await fetchApi<DbConnectionTestResult>('/api/postgres-config/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setTestResult(res);
      if (res.success) {
        showToast(`PostgreSQL connected successfully (${res.latencyMs}ms)!`, 'success');
      } else {
        showToast(res.error || 'Connection failed', 'error');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: err.message || 'Connection test error',
      });
      showToast(err.message || 'Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleRunVacuum = async () => {
    try {
      setVacuuming(true);
      const res = await fetchApi<{ success: boolean; message: string }>('/api/postgres-config/vacuum', {
        method: 'POST',
      });
      showToast(res.message || 'VACUUM ANALYZE completed successfully!', 'success');
      await loadConfig();
    } catch (err: any) {
      showToast(err.message || 'Failed to run VACUUM ANALYZE', 'error');
    } finally {
      setVacuuming(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Table selection and preset helpers (Admin)
  const allTableNames = useMemo(() => config?.tableStats?.map((t) => t.tableName) || [], [config]);

  const selectPreset = (preset: 'operations' | 'catalog' | 'organization' | 'logs' | 'all' | 'none') => {
    if (!config?.tableStats) return;
    if (preset === 'none') {
      setSelectedTables([]);
      return;
    }
    if (preset === 'all') {
      setSelectedTables([...allTableNames]);
      return;
    }
    if (preset === 'operations') {
      const opsTables = ['inventory_items', 'stock_locations', 'inventory_movements', 'employee_requests', 'vendor_repairs'];
      setSelectedTables(opsTables.filter((t) => allTableNames.includes(t)));
      return;
    }
    if (preset === 'catalog') {
      const catTables = ['models', 'field_sets', 'field_set_items', 'custom_fields', 'categories', 'request_reasons'];
      setSelectedTables(catTables.filter((t) => allTableNames.includes(t)));
      return;
    }
    if (preset === 'organization') {
      const orgTables = ['employees', 'employee_departments', 'machines', 'locations', 'departments', 'branches'];
      setSelectedTables(orgTables.filter((t) => allTableNames.includes(t)));
      return;
    }
    if (preset === 'logs') {
      setSelectedTables(['entry_logs']);
      return;
    }
  };

  const toggleTableSelection = (tableName: string) => {
    setSelectedTables((prev) =>
      prev.includes(tableName) ? prev.filter((t) => t !== tableName) : [...prev, tableName]
    );
  };

  const handleQuickResetTable = (tableName: string) => {
    setSelectedTables([tableName]);
    setResetConfirmed(false);
    setReseedDemoOnReset(false);
    setIsResetModalOpen(true);
  };

  const handleOpenResetModal = () => {
    if (selectedTables.length === 0) {
      showToast('Please select at least one datatable to reset', 'error');
      return;
    }
    setResetConfirmed(false);
    setIsResetModalOpen(true);
  };

  const handleExecuteReset = async () => {
    if (selectedTables.length === 0) {
      showToast('Please select at least one table to reset', 'error');
      return;
    }
    try {
      setResetting(true);
      const res = await fetchApi<{
        success: boolean;
        message: string;
        resetTables: string[];
        reseeded?: boolean;
      }>('/api/postgres-config/reset-tables', {
        method: 'POST',
        body: JSON.stringify({
          tables: selectedTables,
          reseedDemo: reseedDemoOnReset,
        }),
      });

      showToast(res.message || `Successfully reset ${selectedTables.length} table(s)!`, 'success');
      setIsResetModalOpen(false);
      setSelectedTables([]);
      setResetConfirmed(false);
      setReseedDemoOnReset(false);
      await loadConfig();
    } catch (err: any) {
      console.error('Reset error:', err);
      showToast(err.message || 'Failed to reset tables', 'error');
    } finally {
      setResetting(false);
    }
  };

  const filteredTableStats = useMemo(() => {
    if (!config?.tableStats) return [];
    return config.tableStats.filter((t) => {
      const q = tableSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.tableName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.impactNote && t.impactNote.toLowerCase().includes(q));
      const matchesGroup = groupFilter === 'all' || t.group === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [config, tableSearchQuery, groupFilter]);

  const selectedRecordsCount = useMemo(() => {
    if (!config?.tableStats) return 0;
    return config.tableStats
      .filter((t) => selectedTables.includes(t.tableName))
      .reduce((acc, curr) => acc + curr.rowCount, 0);
  }, [config, selectedTables]);

  const totalRecords = config?.tableStats?.reduce((acc, curr) => acc + curr.rowCount, 0) || 0;

  // Code templates
  const dockerfileSnippet = `# Multi-stage Build for AssetFlow (React + Express + PostgreSQL + Drizzle)
# Compatible with linux/amd64 and linux/arm64 (Apple Silicon, TrueNAS, Raspberry Pi)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy all source files
COPY . .

# Build Vite client assets and compile backend server to dist/server.cjs
RUN npm run build

# Production Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container health check
RUN apt-get update && \\
    apt-get install -y --no-install-recommends curl && \\
    rm -rf /var/lib/apt/lists/*

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev --no-audit --no-fund; fi && \\
    npm cache clean --force

# Copy built application output from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root system user for secure container execution (Debian format)
RUN groupadd -g 1001 nodejs && \\
    useradd -u 1001 -g nodejs -s /bin/sh -m nodejs && \\
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.cjs"]
`;

  const dockerComposeSnippet = `version: '3.8'

services:
  # ==========================================
  # AssetFlow Enterprise Application Service
  # ==========================================
  app:
    image: ghcr.io/your-github-username/assetflow:latest
    # Or build locally:
    # build:
    #   context: .
    #   dockerfile: Dockerfile
    container_name: assetflow-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      # Connect to PostgreSQL container on internal docker network
      - SQL_HOST=postgres
      - SQL_PORT=5432
      - SQL_USER=assetflow_user
      - SQL_PASSWORD=YourSecurePassword123!
      - SQL_DB_NAME=assetflow_db
      - SQL_SSL=false
      - SQL_POOL_MAX=20
      # Optional: AI Studio Gemini API Key for AI features
      - GEMINI_API_KEY=\${GEMINI_API_KEY:-}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - assetflow-net

  # ==========================================
  # PostgreSQL 16 Database Service
  # ==========================================
  postgres:
    image: postgres:16-alpine
    container_name: assetflow-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=assetflow_user
      - POSTGRES_PASSWORD=YourSecurePassword123!
      - POSTGRES_DB=assetflow_db
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      # TrueNAS Scale Dataset / Host Mount for persistent database storage
      - assetflow-pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432" # Optional: expose to LAN if needed for external management
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U assetflow_user -d assetflow_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - assetflow-net

volumes:
  assetflow-pgdata:
    name: assetflow-pgdata
    # For TrueNAS host path, you can map to a host dataset:
    # driver: local
    # driver_opts:
    #   type: none
    #   o: bind
    #   device: /mnt/tank/appdata/assetflow-db

networks:
  assetflow-net:
    name: assetflow-net
    driver: bridge
`;

  const workflowSnippet = `name: Build & Publish Docker Image to GitHub Packages (GHCR)

on:
  push:
    branches:
      - main
      - master
    tags:
      - 'v*.*.*'
  workflow_dispatch:

env:
  REGISTRY: ghcr.io

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Verify workspace files
        run: |
          echo "Workspace root: $(pwd)"
          ls -la
          if [ ! -f "Dockerfile" ]; then
            echo "::error::Dockerfile not found in root! Check file tracking in git."
          fi

      - name: Set up QEMU (Multi-platform emulation)
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Lowercase image name (GHCR requirement)
        id: image_name
        run: |
          IMAGE_LOWER=$(echo "\${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
          echo "image_name=\${IMAGE_LOWER}" >> "$GITHUB_OUTPUT"

      - name: Extract metadata (tags, labels) for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ steps.image_name.outputs.image_name }}
          tags: |
            type=raw,value=latest,enable=\${{ github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master' }}
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,format=short

      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;

  const envSampleSnippet = `# ==========================================
# AssetFlow Production Environment Variables
# ==========================================

# Server Port & Mode
NODE_ENV=production
PORT=3000

# PostgreSQL Connection Parameters
SQL_HOST=postgres
SQL_PORT=5432
SQL_USER=assetflow_user
SQL_PASSWORD=YourSecurePassword123!
SQL_DB_NAME=assetflow_db
SQL_SSL=false
SQL_POOL_MAX=20

# Or Single Connection String (takes precedence if provided):
# DATABASE_URL=postgres://assetflow_user:YourSecurePassword123!@postgres:5432/assetflow_db

# Optional AI Studio Gemini Integration
GEMINI_API_KEY=
`;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-700 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-800">PostgreSQL Server & TrueNAS SCALE Setup</h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active Database Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Live PostgreSQL database health, connection diagnostics, TrueNAS SCALE hosting configuration, Dockerfile, and GitHub CI/CD workflow.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadConfig}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            title="Refresh database diagnostics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>

          <button
            onClick={handleInitTables}
            disabled={initializingTables}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100/70 text-amber-800 border border-amber-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            title="Initialize and verify all PostgreSQL database tables and default schema"
          >
            <Database className={`w-3.5 h-3.5 ${initializingTables ? 'animate-spin' : ''}`} />
            <span>{initializingTables ? 'Initializing...' : 'Init / Sync DB Tables'}</span>
          </button>

          <button
            onClick={handleRunVacuum}
            disabled={vacuuming}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            title="Run VACUUM ANALYZE to optimize indexes and table performance"
          >
            <Zap className={`w-3.5 h-3.5 ${vacuuming ? 'animate-spin' : ''}`} />
            <span>{vacuuming ? 'Optimizing...' : 'VACUUM ANALYZE'}</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Database Status</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-semibold text-slate-800">
                {config?.connected ? 'Online & Healthy' : 'Disconnected'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {config?.databaseName ? `DB: ${config.databaseName}` : 'assetflow_db'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Host & Port</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-semibold text-slate-800 font-mono">
                {config?.host || 'localhost'}:{config?.port || 5432}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              User: <span className="font-medium text-slate-600">{config?.user || 'postgres'}</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-600">
            <Server className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Storage & Volume</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-semibold text-slate-800">
                {config?.databaseSize || 'Calculated'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Active Connections: <span className="font-medium text-slate-600">{config?.activeConnections || 1}</span> / {config?.poolMax || 10}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-600">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Schema & Tables</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-semibold text-slate-800">
                {config?.tableStats?.length || 14} Tables
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Total Records: <span className="font-medium text-slate-600">{totalRecords.toLocaleString()}</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-700">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('diagnostics')}
          title="Inspect live PostgreSQL schema, table sizes, connections, and system metrics"
          className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'diagnostics'
              ? 'bg-amber-500 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100/70'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Live Schema & Diagnostics</span>
        </button>

        {(currentRole === 'admin' || currentRole === 'super_manager') && (
          <button
            onClick={() => setActiveSubTab('backup_restore')}
            title="Export PostgreSQL SQL dumps, JSON backups, or restore from local files"
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'backup_restore'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100/70'
            }`}
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>Backup & Restore</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
              activeSubTab === 'backup_restore' ? 'bg-amber-600 text-amber-100' : 'bg-amber-50 text-amber-800 border border-amber-200/60'
            }`}>
              SQL / JSON
            </span>
          </button>
        )}

        {currentRole === 'admin' && (
          <button
            onClick={() => setActiveSubTab('table_reset')}
            title="Selectively truncate and reset database tables with CASCADE"
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'table_reset'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-rose-700 bg-rose-50/70 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Datatables</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
              activeSubTab === 'table_reset' ? 'bg-rose-700 text-rose-100' : 'bg-rose-100 text-rose-800'
            }`}>Admin</span>
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('tester')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'tester'
              ? 'bg-amber-500 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100/70'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Connection Tester</span>
        </button>

        <button
          onClick={() => setActiveSubTab('truenas')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'truenas'
              ? 'bg-amber-500 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100/70'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>TrueNAS SCALE Hosting</span>
        </button>

        <button
          onClick={() => setActiveSubTab('docker_ci')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'docker_ci'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Container className="w-4 h-4" />
          <span>Dockerfile & GitHub Actions</span>
        </button>
      </div>

      {/* Sub-Tab 1: Live Diagnostics */}
      {activeSubTab === 'diagnostics' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Server Information & Environment Config */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>PostgreSQL Engine Information</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Engine Version</p>
                  <p className="font-mono text-[11px] text-slate-800 break-words font-semibold">
                    {config?.serverVersion || 'PostgreSQL 16.x'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Database Name</p>
                    <p className="font-bold text-slate-900 mt-0.5 truncate">{config?.databaseName}</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">SSL Mode</p>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {config?.ssl ? 'Encrypted (SSL)' : 'Disabled (Local/LAN)'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Pool Max Size</p>
                    <p className="font-bold text-slate-900 mt-0.5">{config?.poolMax || 10} clients</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Active DB Conns</p>
                    <p className="font-bold text-emerald-600 mt-0.5">{config?.activeConnections || 1} active</p>
                  </div>
                </div>

                {config?.serverStartTime && (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Postmaster Started:</span>
                    </span>
                    <span className="font-bold text-slate-700">
                      {new Date(config.serverStartTime).toLocaleDateString()} {new Date(config.serverStartTime).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Environment Variables Presence */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Environment Configuration Variables</span>
              </h3>

              <div className="space-y-2 text-xs">
                {[
                  { name: 'SQL_HOST / PGHOST', present: config?.environment.hasSqlHost },
                  { name: 'SQL_USER / PGUSER', present: config?.environment.hasSqlUser },
                  { name: 'SQL_PASSWORD / PGPASSWORD', present: config?.environment.hasSqlPassword },
                  { name: 'SQL_DB_NAME / PGDATABASE', present: config?.environment.hasSqlDbName },
                  { name: 'DATABASE_URL (URI Format)', present: config?.environment.hasDatabaseUrl },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-mono text-[11px] text-slate-700">{item.name}</span>
                    {item.present ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Set
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                        Default / Fallback
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Database Table Stats */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Database Schema Table Inventory</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live row counts across all managed enterprise tables and catalogs.
                  </p>
                </div>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-mono">
                  {totalRecords.toLocaleString()} Total Records
                </span>
              </div>

              {/* Automatic Schema Management Banner */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900">Automatic Schema Provisioning Enabled</p>
                  <p className="text-slate-600 leading-relaxed">
                    AssetFlow automatically detects if tables exist on startup and runs all necessary <code className="font-mono bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-[11px]">CREATE TABLE IF NOT EXISTS</code> migrations and relational indexes. If you ever point AssetFlow to a fresh PostgreSQL instance, click <strong>Init / Sync DB Tables</strong> to immediately instantiate the schema.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {config?.tableStats.map((tab) => (
                  <div
                    key={tab.tableName}
                    className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-blue-300 transition flex items-center justify-between text-xs group"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-900 truncate">{tab.description}</p>
                      <p className="font-mono text-[11px] text-slate-400 mt-0.5">{tab.tableName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-slate-800 bg-white border border-slate-200 text-xs shadow-2xs">
                        {tab.rowCount.toLocaleString()}
                      </span>
                      {currentRole === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleQuickResetTable(tab.tableName)}
                          title={`Reset ${tab.tableName}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab: Database Backup & Local Restore */}
      {activeSubTab === 'backup_restore' && (currentRole === 'admin' || currentRole === 'super_manager') && (
        <DatabaseBackupRestoreView />
      )}

      {/* Sub-Tab: Admin Table Reset / Data Purge */}
      {activeSubTab === 'table_reset' && currentRole === 'admin' && (
        <div className="space-y-6">
          {/* Top Control Banner */}
          <div className="bg-white rounded-2xl border border-rose-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                    <RotateCcw className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Selective Database Table Reset</h3>
                    <p className="text-xs text-slate-500">
                      Select one or multiple datatables to clear. Uses PostgreSQL <code className="font-mono bg-rose-50 text-rose-800 px-1 py-0.5 rounded text-[11px]">TRUNCATE ... RESTART IDENTITY CASCADE</code> to reset IDs to 1.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenResetModal}
                  disabled={selectedTables.length === 0}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs ${
                    selectedTables.length > 0
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Reset Selected ({selectedTables.length})</span>
                </button>
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-slate-400" />
                <span>Quick Presets:</span>
              </span>

              <button
                type="button"
                onClick={() => selectPreset('operations')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <span>📦 Operational & Stock</span>
                <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.2 rounded-full font-mono">5 tables</span>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('catalog')}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <span>🏷️ Catalogs & Models</span>
                <span className="text-[10px] bg-blue-200/80 px-1.5 py-0.2 rounded-full font-mono">6 tables</span>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('organization')}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <span>🏢 Org & Personnel</span>
                <span className="text-[10px] bg-purple-200/80 px-1.5 py-0.2 rounded-full font-mono">6 tables</span>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('logs')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <span>📜 Audit Logs Only</span>
                <span className="text-[10px] bg-slate-300/80 px-1.5 py-0.2 rounded-full font-mono">1 table</span>
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

              <button
                type="button"
                onClick={() => selectPreset('all')}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
              >
                <span>Select All ({allTableNames.length})</span>
              </button>

              {selectedTables.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectPreset('none')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Selection</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Group Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                placeholder="Search tables, descriptions, or impact..."
                className="w-full pl-9.5 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs"
              />
              {tableSearchQuery && (
                <button
                  onClick={() => setTableSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Group Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'All Tables' },
                { id: 'inventory', label: 'Inventory' },
                { id: 'operations', label: 'Operations' },
                { id: 'catalog', label: 'Catalog' },
                { id: 'vendors', label: 'Vendors' },
                { id: 'organization', label: 'Organization' },
                { id: 'security', label: 'Security' },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGroupFilter(g.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap cursor-pointer ${
                    groupFilter === g.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTableStats.map((tab) => {
              const isSelected = selectedTables.includes(tab.tableName);
              return (
                <div
                  key={tab.tableName}
                  onClick={() => toggleTableSelection(tab.tableName)}
                  className={`relative p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                            isSelected
                              ? 'bg-rose-600 text-white'
                              : 'border border-slate-300 bg-white text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{tab.description}</p>
                          <code className="font-mono text-[11px] text-slate-500">{tab.tableName}</code>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold shrink-0 ${
                          tab.rowCount > 0
                            ? 'bg-slate-100 text-slate-800 border border-slate-200'
                            : 'bg-slate-50 text-slate-400 border border-slate-100'
                        }`}
                      >
                        {tab.rowCount.toLocaleString()} {tab.rowCount === 1 ? 'row' : 'rows'}
                      </span>
                    </div>

                    {tab.impactNote && (
                      <p className="text-[11px] text-slate-500 leading-relaxed pl-7.5">
                        {tab.impactNote}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {tab.group || 'general'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickResetTable(tab.tableName);
                      }}
                      className="text-rose-600 hover:text-rose-800 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset this table</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTableStats.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No datatables matched your search</p>
              <p className="text-xs text-slate-400">Try clearing the search query or group filter.</p>
            </div>
          )}

          {/* Floating / Sticky Selected Status Bar */}
          {selectedTables.length > 0 && (
            <div className="sticky bottom-4 z-20 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    {selectedTables.length} {selectedTables.length === 1 ? 'table' : 'tables'} selected for reset
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ~{selectedRecordsCount.toLocaleString()} records will be cleared &amp; IDs reset to 1
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTables([])}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel Selection
                </button>
                <button
                  type="button"
                  onClick={handleOpenResetModal}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Review &amp; Reset ({selectedTables.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Interactive Connection Tester */}
      {activeSubTab === 'tester' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <span>Test Custom PostgreSQL Server Connection</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify connectivity, authentication, and network reachability to any local, TrueNAS, or cloud PostgreSQL instance without changing application state.
              </p>
            </div>

            {/* Test Mode Selector */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-xs text-xs">
              <button
                type="button"
                onClick={() => setTestMode('params')}
                className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                  testMode === 'params' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Host & Parameters
              </button>
              <button
                type="button"
                onClick={() => setTestMode('uri')}
                className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                  testMode === 'uri' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Connection URI String
              </button>
            </div>

            <form onSubmit={handleTestConnection} className="space-y-4 text-xs">
              {testMode === 'params' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="font-bold text-slate-700">PostgreSQL Host / IP Address</label>
                      <input
                        type="text"
                        tabIndex={1}
                        value={testHost}
                        onChange={(e) => setTestHost(e.target.value)}
                        placeholder="e.g. 192.168.1.50 or postgres"
                        title="PostgreSQL server hostname or LAN IP address (Press Tab for Port)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Port</label>
                      <input
                        type="number"
                        tabIndex={2}
                        value={testPort}
                        onChange={(e) => setTestPort(e.target.value)}
                        placeholder="5432"
                        title="Port number for database connection (Default: 5432)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Database Name</label>
                      <input
                        type="text"
                        tabIndex={3}
                        value={testDb}
                        onChange={(e) => setTestDb(e.target.value)}
                        placeholder="e.g. assetflow_db"
                        title="Target database name catalog"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Database Username</label>
                      <input
                        type="text"
                        tabIndex={4}
                        value={testUser}
                        onChange={(e) => setTestUser(e.target.value)}
                        placeholder="e.g. assetflow_user or postgres"
                        title="Database role/user account credentials"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Database Password</label>
                    <input
                      type="password"
                      tabIndex={5}
                      value={testPassword}
                      onChange={(e) => setTestPassword(e.target.value)}
                      placeholder="Enter password..."
                      title="Password for the database user account"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">PostgreSQL Connection URI String</label>
                  <input
                    type="text"
                    tabIndex={1}
                    value={testUri}
                    onChange={(e) => setTestUri(e.target.value)}
                    placeholder="postgres://user:password@192.168.1.50:5432/assetflow_db"
                    title="Full PostgreSQL connection string URI"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00]"
                    required
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sslCheck"
                  tabIndex={6}
                  checked={testSsl}
                  onChange={(e) => setTestSsl(e.target.checked)}
                  title="Enable SSL connection parameter"
                  className="w-4 h-4 text-[#FF8C00] focus:ring-[#FF8C00] rounded cursor-pointer"
                />
                <label htmlFor="sslCheck" className="text-slate-700 font-semibold cursor-pointer">
                  Require SSL Connection (rejectUnauthorized: false)
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  tabIndex={7}
                  disabled={testing}
                  title="Run connection handshake and latency probe test"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] hover:from-[#FF8C00] hover:to-[#e03e00] text-white font-bold rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 transition cursor-pointer"
                >
                  <Play className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Testing Connection...' : 'Run Connection Test'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test Results Output Card */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>Diagnostic Results</span>
              </h4>

              {testResult ? (
                <div
                  className={`p-4 rounded-xl border space-y-3 text-xs ${
                    testResult.success
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/80 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <span className="font-bold text-sm">
                      {testResult.success ? 'Connection Established!' : 'Connection Failed'}
                    </span>
                  </div>

                  {testResult.success ? (
                    <div className="space-y-2 pt-2 border-t border-emerald-200/60 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-emerald-700">Round-Trip Latency:</span>
                        <span className="font-bold">{testResult.latencyMs} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-700">Target Database:</span>
                        <span className="font-bold">{testResult.databaseName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-700">Authenticated User:</span>
                        <span className="font-bold">{testResult.currentUser}</span>
                      </div>
                      <div className="pt-1 text-[10px] text-emerald-800 truncate">
                        {testResult.serverVersion}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-rose-200/60 space-y-2">
                      <p className="font-mono text-[11px] text-rose-800 break-words">{testResult.error}</p>
                      <div className="p-2 bg-white/70 rounded-lg text-[10px] text-rose-700">
                        <span className="font-bold">Troubleshooting Tip:</span> Check if PostgreSQL is accepting connections from the host IP, verify user credentials, or ensure the container network is configured.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs">
                  Fill in the connection parameters on the left and click "Run Connection Test" to verify connectivity.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: TrueNAS SCALE Hosting Guide */}
      {activeSubTab === 'truenas' && (
        <div className="space-y-6">
          {/* Quick Steps Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-blue-600" />
                <span>Deploying AssetFlow on TrueNAS SCALE (Step-by-Step)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete guide to hosting AssetFlow on your TrueNAS SCALE server using the Built-in Custom App or Docker Compose.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Create Storage Dataset</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  In TrueNAS SCALE, go to <span className="font-semibold text-slate-800">Datasets</span> and create a dedicated dataset for PostgreSQL persistence, e.g.:
                  <code className="block bg-white p-1 rounded border border-slate-200 font-mono text-[10px] mt-1 text-blue-700">
                    /mnt/tank/appdata/assetflow-db
                  </code>
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Launch Custom App / Compose</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Navigate to <span className="font-semibold text-slate-800">Apps &gt; Discover Apps &gt; Custom App</span> (or use TrueNAS Docker Compose app):
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10px] text-slate-500">
                    <li>Image: <code className="text-slate-800 font-semibold">ghcr.io/your-user/assetflow:latest</code></li>
                    <li>Port Forward: Host <code className="text-slate-800 font-semibold">3000</code> &rarr; Container <code className="text-slate-800 font-semibold">3000</code></li>
                  </ul>
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Set Environment Variables</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Provide your PostgreSQL credentials as environment variables or launch with the included <span className="font-semibold text-slate-800">docker-compose.yml</span> which automatically deploys both app &amp; database.
                </p>
              </div>
            </div>

            {/* TrueNAS SCALE Environment Variables Table */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Recommended TrueNAS SCALE App Configuration Parameters
                </h4>
                <button
                  onClick={() => copyToClipboard(envSampleSnippet, 'env-truenas')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'env-truenas' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'env-truenas' ? 'Copied .env' : 'Copy All .env Vars'}</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-2.5">Variable Name</th>
                      <th className="p-2.5">Recommended Value</th>
                      <th className="p-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-blue-700">PORT</td>
                      <td className="p-2.5 font-mono">3000</td>
                      <td className="p-2.5">Application internal HTTP port</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-blue-700">SQL_HOST</td>
                      <td className="p-2.5 font-mono">postgres (or TrueNAS IP)</td>
                      <td className="p-2.5">PostgreSQL server address</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-blue-700">SQL_PORT</td>
                      <td className="p-2.5 font-mono">5432</td>
                      <td className="p-2.5">PostgreSQL server port</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-blue-700">SQL_USER</td>
                      <td className="p-2.5 font-mono">assetflow_user</td>
                      <td className="p-2.5">Database user account</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-blue-700">SQL_PASSWORD</td>
                      <td className="p-2.5 font-mono">YourSecurePassword123!</td>
                      <td className="p-2.5">Database user password</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-blue-700">SQL_DB_NAME</td>
                      <td className="p-2.5 font-mono">assetflow_db</td>
                      <td className="p-2.5">Target database name</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-blue-700">SQL_SSL</td>
                      <td className="p-2.5 font-mono">false</td>
                      <td className="p-2.5">SSL disabled for internal TrueNAS network</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Docker Compose File */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Complete TrueNAS docker-compose.yml</h4>
                  <p className="text-xs text-slate-500">Includes both PostgreSQL 16 &amp; AssetFlow App container definitions.</p>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(dockerComposeSnippet, 'compose-code')}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedKey === 'compose-code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'compose-code' ? 'Copied!' : 'Copy docker-compose.yml'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
              <code>{dockerComposeSnippet}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Dockerfile & GitHub Workflow Artifacts */}
      {activeSubTab === 'docker_ci' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dockerfile Artifact */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Container className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Dockerfile (Production Alpine Multi-Stage)</h4>
                    <p className="text-[11px] text-slate-500">High-performance production container build.</p>
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(dockerfileSnippet, 'dockerfile-code')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedKey === 'dockerfile-code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'dockerfile-code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
                <code>{dockerfileSnippet}</code>
              </pre>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] mt-3">
              <span className="font-bold">Build Command:</span> <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200">docker build -t assetflow:latest .</code>
            </div>
          </div>

          {/* GitHub Actions Workflow Artifact */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">.github/workflows/docker-publish.yml</h4>
                    <p className="text-[11px] text-slate-500">Auto-builds &amp; publishes images to GHCR on git push.</p>
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(workflowSnippet, 'workflow-code')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedKey === 'workflow-code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'workflow-code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
                <code>{workflowSnippet}</code>
              </pre>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-[11px] mt-3">
              <span className="font-bold">GitHub Publishing:</span> Pushing to GitHub triggers this action to publish multi-arch images directly to <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-purple-200">ghcr.io</code> automatically.
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Safety Modal Dialog */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 my-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Confirm Selective Table Reset</h3>
                  <p className="text-xs text-slate-500">
                    Administrator authorization required for data purge
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsResetModalOpen(false)}
                disabled={resetting}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Callout */}
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Permanent Data Deletion Notice</span>
              </div>
              <p className="text-rose-700 leading-relaxed">
                You are about to permanently wipe all records in <strong>{selectedTables.length} table(s)</strong> (~{selectedRecordsCount.toLocaleString()} total rows).
                PostgreSQL will execute <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">TRUNCATE TABLE ... RESTART IDENTITY CASCADE</code>, which safely clears related dependent records and resets auto-increment ID counters to 1.
              </p>
            </div>

            {/* List of Selected Tables */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Affected Tables ({selectedTables.length}):</span>
                <span className="text-slate-500 font-mono">~{selectedRecordsCount.toLocaleString()} records</span>
              </div>

              <div className="max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {selectedTables.map((tName) => {
                  const stat = config?.tableStats.find((s) => s.tableName === tName);
                  return (
                    <div key={tName} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{stat?.description || tName}</span>
                        <code className="text-[11px] text-slate-400 font-mono ml-2">({tName})</code>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {(stat?.rowCount ?? 0).toLocaleString()} rows
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Admin safety note if users table is wiped */}
            {selectedTables.includes('users') && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Admin Account Preserved:</strong> Your active Administrator account and session will automatically be preserved to ensure continuous login access.
                </span>
              </div>
            )}

            {/* Optional Reseed Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={reseedDemoOnReset}
                onChange={(e) => setReseedDemoOnReset(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-slate-800">Re-seed clean demo dataset after reset</span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Populate standard initial sample assets, categories, models, locations, and departments for a clean restart.
                </p>
              </div>
            </label>

            {/* Safety Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200 hover:bg-rose-50 transition cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={resetConfirmed}
                onChange={(e) => setResetConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="font-bold text-rose-900">
                I understand that this action is irreversible and permanently erases all records in the {selectedTables.length} selected table(s).
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={resetting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={!resetConfirmed || resetting}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md ${
                  resetConfirmed && !resetting
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                }`}
              >
                {resetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Truncate...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Reset {selectedTables.length} Table(s)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
