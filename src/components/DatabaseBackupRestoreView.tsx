import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  FileJson,
  FileCode,
  Clock,
  ArrowDownToLine,
  Check,
  X,
  Layers,
  Search,
  Filter,
  Info,
  Sliders,
  ShieldCheck,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import {
  ServerBackupSnapshotFile,
  DatabaseRestoreValidationResult,
  DatabaseRestoreResult,
  DatabaseBackupPayload,
} from '../types.ts';

export const DatabaseBackupRestoreView: React.FC = () => {
  const { showToast, currentRole, currentUserName } = useApp();

  // Backup Generation State
  const [backupFormat, setBackupFormat] = useState<'sql' | 'json'>('sql');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupDescription, setBackupDescription] = useState('');

  // Server Snapshots List
  const [snapshots, setSnapshots] = useState<ServerBackupSnapshotFile[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [snapshotSearch, setSnapshotSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'sql' | 'json'>('all');

  // Local File Upload & Restore State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedSqlDump, setUploadedSqlDump] = useState<string | null>(null);
  const [parsedBackupPayload, setParsedBackupPayload] = useState<DatabaseBackupPayload | null>(null);
  const [selectedSnapshotFilename, setSelectedSnapshotFilename] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<DatabaseRestoreValidationResult | null>(null);

  // Restore Execution & Confirmation
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccessResult, setRestoreSuccessResult] = useState<DatabaseRestoreResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load available server snapshots
  const loadSnapshots = async () => {
    try {
      setLoadingSnapshots(true);
      const data = await fetchApi<ServerBackupSnapshotFile[]>('/api/database/snapshots');
      setSnapshots(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load database snapshots:', err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  // 1. Create and Save Local Backup (.sql or .json)
  const handleCreateAndDownloadBackup = async () => {
    try {
      setCreatingBackup(true);
      const params = new URLSearchParams();
      params.append('format', backupFormat);
      if (backupDescription.trim()) {
        params.append('description', backupDescription.trim());
      }

      if (backupFormat === 'sql') {
        const res = await fetchApi<{
          success: boolean;
          filename: string;
          format: string;
          metadata: any;
          sqlDump: string;
        }>(`/api/database/backup?${params.toString()}`);

        if (res && res.sqlDump) {
          const blob = new Blob([res.sqlDump], { type: 'application/sql' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.filename || `assetflow_db_backup_${Date.now()}.sql`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToast(
            `PostgreSQL SQL backup downloaded! (${res.metadata.totalRecords.toLocaleString()} records across ${res.metadata.totalTables} tables)`,
            'success'
          );
          setBackupDescription('');
          await loadSnapshots();
        }
      } else {
        const res = await fetchApi<{
          success: boolean;
          filename: string;
          metadata: any;
          backup: DatabaseBackupPayload;
        }>(`/api/database/backup?${params.toString()}`);

        if (res && res.backup) {
          const blob = new Blob([JSON.stringify(res.backup, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.filename || `assetflow_db_backup_${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToast(
            `JSON backup downloaded! (${res.metadata.totalRecords.toLocaleString()} records across ${res.metadata.totalTables} tables)`,
            'success'
          );
          setBackupDescription('');
          await loadSnapshots();
        }
      }
    } catch (err: any) {
      console.error('Failed to create backup:', err);
      showToast(err.message || 'Failed to generate database backup', 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  // 2. Handle File Selection from Local Disk (.sql or .json)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isSql = file.name.endsWith('.sql');
    const isJson = file.name.endsWith('.json');

    if (!isSql && !isJson) {
      showToast('Please select a valid PostgreSQL SQL script (.sql) or JSON backup (.json)', 'error');
      return;
    }

    setSelectedFile(file);
    setSelectedSnapshotFilename(null);
    setValidationResult(null);
    setRestoreSuccessResult(null);
    setUploadedSqlDump(null);
    setParsedBackupPayload(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setValidating(true);
        const content = event.target?.result as string;

        if (isSql) {
          setUploadedSqlDump(content);
          const valRes = await fetchApi<DatabaseRestoreValidationResult>('/api/database/restore/validate', {
            method: 'POST',
            body: JSON.stringify({ sqlDump: content }),
          });

          setValidationResult(valRes);
          if (valRes.valid) {
            showToast(`PostgreSQL SQL script verified! ${valRes.totalRecordsToRestore} records ready to inspect.`, 'success');
          } else {
            showToast(valRes.error || 'SQL backup script failed validation check.', 'error');
          }
        } else {
          const parsed: DatabaseBackupPayload = JSON.parse(content);

          if (!parsed.tables || typeof parsed.tables !== 'object') {
            throw new Error('Invalid backup file: Missing "tables" data object.');
          }

          setParsedBackupPayload(parsed);

          // Validate with server
          const valRes = await fetchApi<DatabaseRestoreValidationResult>('/api/database/restore/validate', {
            method: 'POST',
            body: JSON.stringify({ backup: parsed }),
          });

          setValidationResult(valRes);
          if (valRes.valid) {
            showToast(`JSON backup verified! ${valRes.totalRecordsToRestore} records ready to inspect.`, 'success');
          } else {
            showToast(valRes.error || 'Backup file failed validation check.', 'error');
          }
        }
      } catch (parseErr: any) {
        console.error('Failed to parse backup file:', parseErr);
        showToast(parseErr.message || 'Invalid backup file', 'error');
        setValidationResult(null);
        setParsedBackupPayload(null);
        setUploadedSqlDump(null);
      } finally {
        setValidating(false);
      }
    };

    reader.readAsText(file);
  };

  // 3. Select existing server snapshot for inspection & restore (.sql or .json)
  const handleSelectServerSnapshot = async (snapshot: ServerBackupSnapshotFile) => {
    try {
      setValidating(true);
      setSelectedFile(null);
      setSelectedSnapshotFilename(snapshot.filename);
      setParsedBackupPayload(null);
      setUploadedSqlDump(null);
      setRestoreSuccessResult(null);

      const valRes = await fetchApi<DatabaseRestoreValidationResult>('/api/database/restore/validate', {
        method: 'POST',
        body: JSON.stringify({ snapshotFilename: snapshot.filename }),
      });

      setValidationResult(valRes);
      if (valRes.valid) {
        showToast(
          `Snapshot verified (${snapshot.format.toUpperCase()})! ${valRes.totalRecordsToRestore} records ready for inspection.`,
          'success'
        );
      } else {
        showToast(valRes.error || 'Snapshot validation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to inspect server snapshot', 'error');
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  // 4. Download an existing server snapshot to client's local disk
  const handleDownloadServerSnapshot = (filename: string) => {
    window.location.href = `/api/database/snapshots/${encodeURIComponent(filename)}/download`;
    showToast(`Downloading snapshot ${filename}...`, 'info');
  };

  // 5. Delete an existing server snapshot
  const handleDeleteServerSnapshot = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete server snapshot "${filename}"?`)) {
      return;
    }

    try {
      await fetchApi<{ success: boolean }>(`/api/database/snapshots/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      showToast(`Snapshot ${filename} deleted`, 'success');
      if (selectedSnapshotFilename === filename) {
        setSelectedSnapshotFilename(null);
        setValidationResult(null);
      }
      await loadSnapshots();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete snapshot', 'error');
    }
  };

  // 6. Execute Restore Action
  const handleExecuteRestore = async () => {
    if (confirmationInput.trim().toUpperCase() !== 'RESTORE') {
      showToast('You must type "RESTORE" exactly to confirm.', 'error');
      return;
    }

    try {
      setRestoring(true);

      const payload: any = {
        confirmationKeyword: confirmationInput.trim().toUpperCase(),
      };

      if (uploadedSqlDump) {
        payload.sqlDump = uploadedSqlDump;
      } else if (parsedBackupPayload) {
        payload.backup = parsedBackupPayload;
      } else if (selectedSnapshotFilename) {
        payload.snapshotFilename = selectedSnapshotFilename;
      } else {
        showToast('No backup source selected for restore.', 'error');
        return;
      }

      const res = await fetchApi<DatabaseRestoreResult>('/api/database/restore', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setRestoreSuccessResult(res);
      setIsRestoreModalOpen(false);
      setConfirmationInput('');
      showToast(res.message || 'Database successfully restored!', 'success');

      // Re-run validation to update current database counts
      if (uploadedSqlDump) {
        const valRes = await fetchApi<DatabaseRestoreValidationResult>('/api/database/restore/validate', {
          method: 'POST',
          body: JSON.stringify({ sqlDump: uploadedSqlDump }),
        });
        setValidationResult(valRes);
      } else if (parsedBackupPayload || selectedSnapshotFilename) {
        const valRes = await fetchApi<DatabaseRestoreValidationResult>('/api/database/restore/validate', {
          method: 'POST',
          body: JSON.stringify(
            parsedBackupPayload
              ? { backup: parsedBackupPayload }
              : { snapshotFilename: selectedSnapshotFilename }
          ),
        });
        setValidationResult(valRes);
      }
    } catch (err: any) {
      console.error('Restoration failed:', err);
      showToast(err.message || 'Database restoration failed', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const filteredSnapshots = snapshots.filter((s) => {
    if (formatFilter !== 'all' && s.format !== formatFilter) return false;
    if (!snapshotSearch.trim()) return true;
    const q = snapshotSearch.toLowerCase();
    return (
      s.filename.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      s.creatorName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Database Backup & Local Restore</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF8C00]" />
                AU Assetflow Administrator
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate verified PostgreSQL (.sql) dumps or JSON snapshots to store securely on disk, or restore tables from previous archives.
            </p>
          </div>
        </div>

        <button
          onClick={loadSnapshots}
          disabled={loadingSnapshots}
          title="Reload snapshot list from server repository"
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingSnapshots ? 'animate-spin' : ''}`} />
          <span>Refresh Snapshots</span>
        </button>
      </div>

      {/* Success Banner if Just Restored */}
      {restoreSuccessResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900">Database Successfully Restored!</h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                Restored <span className="font-bold">{restoreSuccessResult.totalRecordsRestored.toLocaleString()}</span> records across{' '}
                <span className="font-bold">{restoreSuccessResult.tablesRestored.length}</span> tables in{' '}
                <span className="font-mono">{restoreSuccessResult.durationMs}ms</span>. All serial primary key sequences were synchronized.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRestoreSuccessResult(null)}
            className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition self-end sm:self-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Panels: Backup (Save Locally) & Restore (Upload Locally) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Create & Save Local Backup */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Save Backup to Local Computer</h3>
                  <p className="text-xs text-slate-500">Download complete database dump directly to disk</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Full Database Dump
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {/* Backup Format Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Backup Format
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    tabIndex={1}
                    onClick={() => setBackupFormat('sql')}
                    title="Generate PostgreSQL SQL format with DDL and COPY data statements"
                    className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      backupFormat === 'sql'
                        ? 'bg-gradient-to-r from-[#FF8C00] to-[#FF4500] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileCode className="w-4 h-4" />
                    <span>PostgreSQL (.sql)</span>
                  </button>
                  <button
                    type="button"
                    tabIndex={2}
                    onClick={() => setBackupFormat('json')}
                    title="Generate standard JSON snapshot format"
                    className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      backupFormat === 'json'
                        ? 'bg-gradient-to-r from-[#FF8C00] to-[#FF4500] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileJson className="w-4 h-4" />
                    <span>JSON Snapshot (.json)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Backup Note / Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  tabIndex={3}
                  value={backupDescription}
                  onChange={(e) => setBackupDescription(e.target.value)}
                  placeholder="e.g., Pre-maintenance snapshot, Production export, Migration dump"
                  title="Enter an optional label or reference description for this backup"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FF8C00]/30 focus:border-[#FF8C00] transition"
                />
              </div>

              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tables Included:</span>
                  <span className="font-bold text-slate-800">All 25 Database Tables</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Output Format:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800">
                    {backupFormat === 'sql' ? '.sql (Native PostgreSQL Dump)' : '.json (JSON Snapshot Document)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Compatibility:</span>
                  <span className="text-slate-800 font-semibold flex items-center gap-1 text-emerald-600">
                    <Check className="w-3.5 h-3.5" />
                    {backupFormat === 'sql'
                      ? 'psql, pgAdmin, CLI & In-App Restore'
                      : 'AU Assetflow In-App Restore & API'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              Saves a copy directly to your computer's Downloads folder.
            </p>
            <button
              onClick={handleCreateAndDownloadBackup}
              disabled={creatingBackup}
              tabIndex={4}
              title="Compile and download the database archive to your browser downloads folder"
              className="px-4 py-2.5 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] hover:from-[#FF8C00] hover:to-[#e03e00] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${creatingBackup ? 'animate-bounce' : ''}`} />
              <span>
                {creatingBackup
                  ? 'Generating Dump...'
                  : backupFormat === 'sql'
                  ? 'Download PostgreSQL .sql'
                  : 'Download JSON Backup'}
              </span>
            </button>
          </div>
        </div>

        {/* Panel 2: Restore from Local File */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Restore from Local Backup File</h3>
                  <p className="text-xs text-slate-500">Upload a previously saved .sql or .json backup from disk</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Local Upload
              </span>
            </div>

            {/* Drag & Drop / File Input Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 border-2 border-dashed border-slate-300 hover:border-purple-400 bg-slate-50/60 hover:bg-purple-50/30 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.json,application/sql,application/json,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center gap-2 mb-2 text-slate-400 group-hover:text-purple-600 transition">
                <FileCode className="w-7 h-7" />
                <span className="text-xs font-bold text-slate-300">/</span>
                <FileJson className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                {selectedFile ? selectedFile.name : 'Click to select or drag & drop backup file (.sql or .json)'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB • ${selectedFile.name.endsWith('.sql') ? 'PostgreSQL SQL Dump' : 'JSON Document'} ready for inspection`
                  : 'Accepts PostgreSQL SQL dumps (.sql) or JSON snapshots (.json)'}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              Inspect contents and compare changes before applying.
            </p>
            {selectedFile && (
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setParsedBackupPayload(null);
                  setUploadedSqlDump(null);
                  setValidationResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition"
              >
                Clear File
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Validation & Pre-Restore Comparison View (Active when a file or snapshot is selected) */}
      {validating && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Validating Backup Integrity...</p>
          <p className="text-xs text-slate-500 mt-1">Reading schema structures and checking table dependencies</p>
        </div>
      )}

      {validationResult && validationResult.valid && (
        <div className="bg-white rounded-2xl border border-blue-200/80 p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-base font-bold text-slate-900">Pre-Restore Inspection & Comparison</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Source: <span className="font-semibold text-slate-800">{selectedFile ? selectedFile.name : selectedSnapshotFilename}</span>
                {validationResult.metadata?.createdAt && (
                  <> • Created on <span className="font-semibold text-slate-800">{new Date(validationResult.metadata.createdAt).toLocaleString()}</span></>
                )}
                {validationResult.metadata?.exportedBy?.name && (
                  <> by <span className="font-semibold text-slate-800">{validationResult.metadata.exportedBy.name}</span></>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] text-slate-400">Total Records to Restore</p>
                <p className="text-base font-bold text-blue-600">{validationResult.totalRecordsToRestore.toLocaleString()}</p>
              </div>
              <button
                onClick={() => setIsRestoreModalOpen(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Proceed to Restore</span>
              </button>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Important Restoration Safeguard:</p>
              <p className="mt-0.5 text-amber-800">
                Restoring this backup will replace current operational data with the contents of this snapshot.
                Your current administrator login will be preserved automatically so you won't be locked out.
              </p>
            </div>
          </div>

          {/* Table Breakdown Comparison */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Table Records Comparison ({validationResult.tableDiscrepancies.length} Tables)
              </h4>
              <span className="text-xs text-slate-400">Live Database vs Backup File</span>
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Table Name</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-right">Current Live Rows</th>
                    <th className="py-2.5 px-4 text-right">Backup File Rows</th>
                    <th className="py-2.5 px-4 text-right">Net Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validationResult.tableDiscrepancies.map((item) => {
                    const diff = item.backupRows - item.currentRows;
                    return (
                      <tr key={item.tableName} className="hover:bg-slate-50/60 transition">
                        <td className="py-2 px-4 font-mono font-medium text-slate-800">{item.tableName}</td>
                        <td className="py-2 px-4 text-slate-500">{item.description}</td>
                        <td className="py-2 px-4 text-right font-medium text-slate-600">
                          {item.currentRows.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right font-bold text-slate-900">
                          {item.backupRows.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right font-mono">
                          {diff > 0 ? (
                            <span className="text-emerald-600 font-semibold">+{diff}</span>
                          ) : diff < 0 ? (
                            <span className="text-rose-600 font-semibold">{diff}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Local Server Snapshots History Archive */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Saved Snapshots on Server</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant snapshots stored in the local server archive (<span className="font-mono">./backups/</span>). You can download any snapshot to your computer or restore it directly.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Format Filter Tabs */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-semibold self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setFormatFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  formatFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({snapshots.length})
              </button>
              <button
                type="button"
                onClick={() => setFormatFilter('sql')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                  formatFilter === 'sql' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCode className="w-3 h-3 text-indigo-600" />
                <span>.SQL ({snapshots.filter((s) => s.format === 'sql').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFormatFilter('json')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                  formatFilter === 'json' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileJson className="w-3 h-3 text-blue-600" />
                <span>.JSON ({snapshots.filter((s) => s.format === 'json').length})</span>
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={snapshotSearch}
                onChange={(e) => setSnapshotSearch(e.target.value)}
                placeholder="Search snapshots..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {loadingSnapshots ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
            Loading backup snapshots...
          </div>
        ) : filteredSnapshots.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl py-10 px-4 text-center">
            <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No Backup Snapshots Found</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              {formatFilter !== 'all'
                ? `No ${formatFilter.toUpperCase()} backup snapshots match your current filter.`
                : 'Click "Save Backup to Local Computer" above to create and download your first full database dump.'}
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Filename & Format</th>
                  <th className="py-2.5 px-4">Created Date</th>
                  <th className="py-2.5 px-4">Size</th>
                  <th className="py-2.5 px-4">Total Records</th>
                  <th className="py-2.5 px-4">Created By</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSnapshots.map((snapshot) => (
                  <tr
                    key={snapshot.filename}
                    className={`hover:bg-slate-50/70 transition ${
                      selectedSnapshotFilename === snapshot.filename ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {snapshot.format === 'sql' ? (
                          <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <FileJson className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-mono font-medium text-slate-900">{snapshot.filename}</p>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                snapshot.format === 'sql'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {snapshot.format === 'sql' ? 'Postgres SQL' : 'JSON'}
                            </span>
                          </div>
                          {snapshot.description && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{snapshot.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{snapshot.sizeFormatted}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {snapshot.totalRecords.toLocaleString()} rows
                    </td>
                    <td className="py-3 px-4 text-slate-600">{snapshot.creatorName}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadServerSnapshot(snapshot.filename)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Download copy to your computer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSelectServerSnapshot(snapshot)}
                          className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
                          title="Inspect and restore this snapshot"
                        >
                          Inspect & Restore
                        </button>
                        <button
                          onClick={() => handleDeleteServerSnapshot(snapshot.filename)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete snapshot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Restoring Database */}
      {isRestoreModalOpen && validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Confirm Database Restoration</h3>
                  <p className="text-xs text-slate-500">
                    Mode: {validationResult.fileFormat === 'sql' || uploadedSqlDump || selectedSnapshotFilename?.endsWith('.sql') ? 'PostgreSQL SQL Script' : 'JSON Snapshot'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsRestoreModalOpen(false);
                  setConfirmationInput('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 space-y-2">
              <p className="font-bold">You are about to overwrite current database records:</p>
              <ul className="list-disc list-inside space-y-1 text-rose-800">
                <li>
                  <span className="font-bold">{validationResult.totalRecordsToRestore.toLocaleString()}</span> records will be imported across all 25 tables.
                </li>
                <li>
                  {validationResult.fileFormat === 'sql' || uploadedSqlDump || selectedSnapshotFilename?.endsWith('.sql') ? (
                    <span>Executed as an <strong>atomic SQL transaction</strong> (<code className="font-mono">BEGIN; ... COMMIT;</code>) with safe sequence synchronization.</span>
                  ) : (
                    <span>Restored via relational dependency ordered batch insertions.</span>
                  )}
                </li>
                <li>Your current administrator account will be safely preserved automatically.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                To proceed, type <span className="font-mono text-rose-600 font-extrabold">RESTORE</span> below:
              </label>
              <input
                type="text"
                tabIndex={1}
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="Type RESTORE to confirm"
                title="Type RESTORE in capital letters (Press Tab to move to Cancel or Confirm)"
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                tabIndex={2}
                onClick={() => {
                  setIsRestoreModalOpen(false);
                  setConfirmationInput('');
                }}
                disabled={restoring}
                title="Cancel database restore"
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                tabIndex={3}
                onClick={handleExecuteRestore}
                disabled={restoring || confirmationInput.trim().toUpperCase() !== 'RESTORE'}
                title="Execute database overwrite and sequence sync"
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${restoring ? 'animate-spin' : ''}`} />
                <span>{restoring ? 'Restoring Database...' : 'Confirm Full Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
