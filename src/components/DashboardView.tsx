import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Package,
  AlertTriangle,
  Clock,
  Wrench,
  ClipboardList,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  TrendingDown,
  Activity,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { InventoryItem, EmployeeRequest, VendorRepair, Movement } from '../types.ts';
import { NavTab } from './Sidebar.tsx';

interface DashboardViewProps {
  setActiveTab: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const { currentRole, currentBranchId, branches, dashboardStats, showToast } = useApp();
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<EmployeeRequest[]>([]);
  const [activeRepairs, setActiveRepairs] = useState<VendorRepair[]>([]);
  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const currentBranch = branches.find((b) => b.id === currentBranchId);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [inv, reqs, reps, movs] = await Promise.all([
          fetchApi<InventoryItem[]>(`/api/inventory?branchId=${currentBranchId}`),
          fetchApi<EmployeeRequest[]>(`/api/requests?branchId=${currentBranchId}&status=pending`),
          fetchApi<VendorRepair[]>(`/api/repairs?branchId=${currentBranchId}&status=sent_to_vendor`),
          fetchApi<Movement[]>(`/api/movements?branchId=${currentBranchId}`),
        ]);

        const lows = (inv || []).filter((i) => i.availableQuantity <= i.minThreshold);
        setLowStockItems(lows);
        setPendingRequests(reqs || []);
        setActiveRepairs(reps || []);
        setRecentMovements((movs || []).slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentBranchId, currentRole]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Branch & Scope info */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30 mb-2">
            <Activity className="w-3.5 h-3.5" />
            <span>Organization Stock Control</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {currentRole === 'admin' || currentRole === 'super_manager'
              ? `Overview: ${currentBranch ? currentBranch.name : 'All Group Branches'}`
              : `Branch Portal: ${currentBranch ? currentBranch.name : 'Central Plant'}`}
          </h2>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl">
            Real-time multi-branch asset tracking, consumable levels, employee requests with 4-digit security punch, machine allocation, and vendor repair logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="dash-btn-kiosk"
            onClick={() => setActiveTab('department_portal')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-600/30 flex items-center gap-2"
          >
            <span>Employee Request Kiosk</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          {(currentRole === 'admin' || currentRole === 'super_manager') && (
            <button
              id="dash-btn-new-item"
              onClick={() => setActiveTab('create_item')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700"
            >
              + New Stock Item
            </button>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('inventory')}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-blue-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Assets</span>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:scale-110 transition">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{dashboardStats?.totalAssets ?? 0}</span>
            <span className="text-xs font-medium text-slate-500">Tracked Units</span>
          </div>
          <p className="mt-1 text-xs text-blue-600 font-medium flex items-center gap-1">
            <span>Machinery, Tools & Fleet</span>
          </p>
        </div>

        <div
          onClick={() => setActiveTab('inventory')}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-emerald-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Consumables</span>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:scale-110 transition">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{dashboardStats?.totalConsumables ?? 0}</span>
            <span className="text-xs font-medium text-slate-500">SKUs by UOM</span>
          </div>
          <p className="mt-1 text-xs text-emerald-600 font-medium">Lubricants, PPE, Fasteners</p>
        </div>

        <div
          onClick={() => setActiveTab('inventory')}
          className={`bg-white p-5 rounded-xl border shadow-xs transition cursor-pointer group ${
            (dashboardStats?.lowStockCount || 0) > 0
              ? 'border-amber-300 bg-amber-50/20'
              : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Warnings</span>
            <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700 group-hover:scale-110 transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-700">{dashboardStats?.lowStockCount ?? 0}</span>
            <span className="text-xs font-medium text-amber-600">Below Reorder Level</span>
          </div>
          <p className="mt-1 text-xs text-amber-700 font-medium">Automatic reorder alerts</p>
        </div>

        <div
          onClick={() => setActiveTab('requests')}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-purple-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Requests</span>
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 group-hover:scale-110 transition">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{pendingRequests.length}</span>
            <span className="text-xs font-medium text-slate-500">Awaiting Manager Issue</span>
          </div>
          <p className="mt-1 text-xs text-purple-600 font-medium">Verified by 4-digit PIN</p>
        </div>
      </div>

      {/* Low Stock Urgent Warning Banner */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900">
                Low Stock Threshold Alerts ({lowStockItems.length} items require replenishment)
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                The following consumable supplies or assets have dropped to or below their safe minimum reorder quantity.
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {lowStockItems.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800 truncate max-w-[180px]">{item.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Code: <span className="font-mono">{item.code}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-700">
                        {item.availableQuantity} {item.uom}
                      </span>
                      <p className="text-[10px] text-slate-600">Min: {item.minThreshold}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shrink-0"
            >
              View All Stock
            </button>
          </div>
        </div>
      )}

      {/* Two Column Grid: Pending Requests & Active Repairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Employee Requests for Manager */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Pending Employee Requisitions</h3>
              </div>
              <button
                onClick={() => setActiveTab('requests')}
                className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
              >
                <span>Manager Queue</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {pendingRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-600 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 mb-1" />
                  <p className="font-medium">No pending requisitions for this branch.</p>
                </div>
              ) : (
                pendingRequests.slice(0, 4).map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-slate-50 hover:bg-blue-50/50 rounded-lg border border-slate-200/80 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700">{req.requestId}</span>
                        <span className="text-slate-600">by {req.employee?.name || 'Employee'}</span>
                      </div>
                      <p className="text-slate-700 font-medium mt-0.5">
                        {req.requestedQty} {req.uom} • {req.item?.name || 'Item'}
                      </p>
                      <p className="text-[11px] text-slate-600 italic">"{req.reasonText}"</p>
                    </div>

                    <button
                      onClick={() => setActiveTab('requests')}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-[11px] font-bold hover:bg-blue-700 transition"
                    >
                      Issue
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Punch validation requires 4-digit employee usercode</span>
            <span className="font-mono font-semibold text-slate-600">PIN Secured</span>
          </div>
        </div>

        {/* Vendor Repairs & Asset Engagement Durations */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Active Vendor Repairs & Engagement</h3>
              </div>
              <button
                onClick={() => setActiveTab('repairs_vendors')}
                className="text-xs text-indigo-600 hover:underline font-semibold flex items-center gap-1"
              >
                <span>Repairs Hub</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {activeRepairs.length === 0 ? (
                <div className="py-8 text-center text-slate-600 text-xs">
                  <Wrench className="w-8 h-8 mx-auto text-slate-400 mb-1" />
                  <p className="font-medium">No assets currently dispatched for vendor repair.</p>
                </div>
              ) : (
                activeRepairs.slice(0, 4).map((rep) => {
                  const hoursEngaged = Math.floor((rep.engagedDurationMinutes || 0) / 60);
                  const daysEngaged = Math.floor(hoursEngaged / 24);
                  return (
                    <div
                      key={rep.id}
                      className="p-3 bg-slate-50 hover:bg-indigo-50/40 rounded-lg border border-slate-200/80 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{rep.item?.name || 'Asset Item'}</p>
                        <p className="text-[11px] text-slate-500">
                          Vendor: <span className="font-semibold text-slate-700">{rep.vendor?.name}</span>
                        </p>
                        <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
                          Engaged prior to repair:{' '}
                          <span className="font-bold">
                            {daysEngaged > 0 ? `${daysEngaged}d ` : ''}
                            {hoursEngaged % 24}h
                          </span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold text-[10px]">
                          At Vendor
                        </span>
                        <p className="text-[10px] text-slate-600 mt-1">Est: {rep.expectedReturnDate || 'TBD'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Engagement duration calculated before repair or decommissioning</span>
            <span className="font-mono font-semibold text-slate-600">Lifetime Metric</span>
          </div>
        </div>
      </div>

      {/* Recent Activity / Movements Feed */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">Recent Stock Movements & Allocations</h3>
          </div>
          <button
            onClick={() => setActiveTab('transfers')}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1"
          >
            <span>All Movements</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">Quantity & UOM</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Route / Destination</th>
                <th className="py-2.5 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    No movement records recorded yet.
                  </td>
                </tr>
              ) : (
                recentMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono">
                      {new Date(mov.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{mov.item?.name || `Item #${mov.itemId}`}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                      {mov.quantity} {mov.uom}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {mov.movementType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {mov.toDepartment?.name || mov.toBranch?.name || 'Department / Machine'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate">{mov.notes || '—'}</td>
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
