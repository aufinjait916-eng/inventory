import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  Activity,
  User,
  Building,
  Clock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { EntryLog } from '../types.ts';

export const AuditLogsView: React.FC = () => {
  const { currentBranchId, branches } = useApp();

  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<EntryLog[]>(`/api/logs?branchId=${currentBranchId}`);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [currentBranchId]);

  const filtered = logs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (
      search &&
      !log.details.toLowerCase().includes(search.toLowerCase()) &&
      !log.userName.toLowerCase().includes(search.toLowerCase()) &&
      !log.action.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-extrabold text-slate-900">Organization Audit & Activity Trail</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {filtered.length} Recorded Entries
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete cryptographic audit log capturing every stock movement, employee request fulfillment, role action, and vendor repair.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Actions</option>
            <option value="STOCK_CREATED">Stock Created</option>
            <option value="STOCK_MOVEMENT">Stock Movement</option>
            <option value="REQUEST_CREATED">Request Created</option>
            <option value="REQUEST_STATUS_UPDATED">Request Issued/Rejected</option>
            <option value="SENT_TO_VENDOR">Sent to Vendor</option>
            <option value="RETURNED_FROM_VENDOR">Returned from Vendor</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Authorized User / Terminal</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Entity & Reference</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Querying PostgreSQL audit tables...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <ScrollText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No log entries found for this criteria.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          {log.userName[0] || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{log.userName}</p>
                          <span className="text-[10px] uppercase font-bold text-blue-600">
                            {log.userRole.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {log.entityType} #{log.entityId || '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-800 max-w-md">
                      <p className="line-clamp-2">{log.details}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
