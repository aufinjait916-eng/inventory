import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { PostgresConfigInfo, DbConnectionTestResult } from '../types.ts';

export const PostgresConfigView: React.FC = () => {
  const { showToast, currentRole } = useApp();
  const [config, setConfig] = useState<PostgresConfigInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'diagnostics' | 'tester' | 'truenas' | 'docker_ci'>('diagnostics');

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

  // Maintenance State
  const [vacuuming, setVacuuming] = useState(false);
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

  const totalRecords = config?.tableStats?.reduce((acc, curr) => acc + curr.rowCount, 0) || 0;

  // Code templates
  const dockerfileSnippet = `# Multi-stage Build for AssetFlow (React + Express + PostgreSQL + Drizzle)
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build Vite client assets and compile backend server to dist/server.cjs
RUN npm run build

# Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container health check
RUN apk add --no-cache curl

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application output from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root system user for secure container execution
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001 && \\
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">PostgreSQL Server & TrueNAS SCALE Setup</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
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
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            title="Refresh database diagnostics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>

          <button
            onClick={handleRunVacuum}
            disabled={vacuuming}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
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
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Database Status</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-bold text-slate-900">
                {config?.connected ? 'Online & Healthy' : 'Disconnected'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {config?.databaseName ? `DB: ${config.databaseName}` : 'assetflow_db'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Host & Port</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-bold text-slate-900 font-mono">
                {config?.host || 'localhost'}:{config?.port || 5432}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              User: <span className="font-semibold text-slate-700">{config?.user || 'postgres'}</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Server className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Storage & Volume</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-bold text-slate-900">
                {config?.databaseSize || 'Calculated'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Active Connections: <span className="font-semibold text-slate-700">{config?.activeConnections || 1}</span> / {config?.poolMax || 10}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <HardDrive className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Schema & Tables</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-bold text-slate-900">
                {config?.tableStats?.length || 14} Tables
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Total Records: <span className="font-semibold text-slate-700">{totalRecords.toLocaleString()}</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('diagnostics')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'diagnostics'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Schema & Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tester')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'tester'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Connection Tester</span>
        </button>

        <button
          onClick={() => setActiveSubTab('truenas')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'truenas'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="w-4 h-4" />
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {config?.tableStats.map((tab) => (
                  <div
                    key={tab.tableName}
                    className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-blue-300 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{tab.description}</p>
                      <p className="font-mono text-[11px] text-slate-400 mt-0.5">{tab.tableName}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-slate-800 bg-white border border-slate-200 text-xs shadow-2xs">
                        {tab.rowCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                        value={testHost}
                        onChange={(e) => setTestHost(e.target.value)}
                        placeholder="e.g. 192.168.1.50 or postgres"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Port</label>
                      <input
                        type="number"
                        value={testPort}
                        onChange={(e) => setTestPort(e.target.value)}
                        placeholder="5432"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Database Name</label>
                      <input
                        type="text"
                        value={testDb}
                        onChange={(e) => setTestDb(e.target.value)}
                        placeholder="e.g. assetflow_db"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Database Username</label>
                      <input
                        type="text"
                        value={testUser}
                        onChange={(e) => setTestUser(e.target.value)}
                        placeholder="e.g. assetflow_user or postgres"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Database Password</label>
                    <input
                      type="password"
                      value={testPassword}
                      onChange={(e) => setTestPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">PostgreSQL Connection URI String</label>
                  <input
                    type="text"
                    value={testUri}
                    onChange={(e) => setTestUri(e.target.value)}
                    placeholder="postgres://user:password@192.168.1.50:5432/assetflow_db"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sslCheck"
                  checked={testSsl}
                  onChange={(e) => setTestSsl(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="sslCheck" className="text-slate-700 font-semibold cursor-pointer">
                  Require SSL Connection (rejectUnauthorized: false)
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={testing}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 transition cursor-pointer"
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
    </div>
  );
};
