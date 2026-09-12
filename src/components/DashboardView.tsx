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
  CalendarClock,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { InventoryItem, EmployeeRequest, VendorRepair, Movement, PMWorkOrder } from '../types.ts';
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
  const [duePMWorkOrders, setDuePMWorkOrders] = useState<PMWorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const currentBranch = branches.find((b) => b.id === currentBranchId);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [inv, reqs, reps, movs, pms] = await Promise.all([
          fetchApi<InventoryItem[]>(`/api/inventory?branchId=${currentBranchId}`),
          fetchApi<EmployeeRequest[]>(`/api/requests?branchId=${currentBranchId}&status=pending`),
          fetchApi<VendorRepair[]>(`/api/repairs?branchId=${currentBranchId}&status=sent_to_vendor`),
          fetchApi<Movement[]>(`/api/movements?branchId=${currentBranchId}`),
          fetchApi<PMWorkOrder[]>(`/api/pm/work-orders?branchId=${currentBranchId}`),
        ]);

        const lows = (inv || []).filter((i) => i.availableQuantity <= i.minThreshold);
        setLowStockItems(lows);
        setPendingRequests(reqs || []);
        setActiveRepairs(reps || []);
        setRecentMovements((movs || []).slice(0, 5));
        setDuePMWorkOrders((pms || []).filter((wo) => wo.status !== 'completed' && wo.status !== 'skipped'));
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
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200/60 mb-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-600" />
            <span>Stock Control & Machine Maintenance</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
            {currentRole === 'admin' || currentRole === 'super_manager'
              ? `Overview: ${currentBranch ? currentBranch.name : 'All Group Branches'}`
              : `Branch Portal: ${currentBranch ? currentBranch.name : 'Central Plant'}`}
          </h2>
          <p className="text-slate-500 text-xs mt-1 max-w-2xl leading-relaxed">
            Real-time multi-branch asset tracking, consumable levels, preventive maintenance schedules, employee PIN requisitions, and machine servicing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="dash-btn-pm"
            onClick={() => setActiveTab('preventive_maintenance')}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-medium transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Preventive Maintenance</span>
          </button>
          <button
            id="dash-btn-kiosk"
            onClick={() => setActiveTab('department_portal')}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition border border-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Operator PIN Kiosk</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('inventory')}
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-amber-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Total Assets</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 group-hover:bg-amber-50 group-hover:text-amber-800 group-hover:border-amber-300 transition">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{dashboardStats?.totalAssets ?? 0}</span>
            <span className="text-xs font-medium text-slate-600">Tracked Units</span>
          </div>
          <p className="mt-1 text-xs text-slate-600 font-medium">
            Machinery, Tools & Fleet
          </p>
        </div>

        <div
          onClick={() => setActiveTab('preventive_maintenance')}
          className={`bg-white p-5 rounded-xl border shadow-2xs transition cursor-pointer group ${
            (dashboardStats?.pmOverdueCount || 0) > 0
              ? 'border-rose-300 bg-rose-50/20 hover:border-rose-400'
              : 'border-slate-200/90 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">PM Maintenance</span>
            <div className={`p-2 rounded-lg border transition ${
              (dashboardStats?.pmOverdueCount || 0) > 0
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-slate-100 text-slate-700 border-slate-300 group-hover:bg-amber-50 group-hover:text-amber-800 group-hover:border-amber-300'
            }`}>
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${
              (dashboardStats?.pmOverdueCount || 0) > 0 ? 'text-rose-700' : 'text-slate-900'
            }`}>
              {dashboardStats?.pmDueCount ?? duePMWorkOrders.length}
            </span>
            <span className="text-xs font-medium text-slate-600">Orders Active</span>
          </div>
          <p className="mt-1 text-xs text-slate-600 font-medium flex items-center gap-1">
            <span>Compliance: <span className="font-semibold text-slate-800">{dashboardStats?.pmComplianceRate ?? 100}%</span></span>
            {(dashboardStats?.pmOverdueCount || 0) > 0 && (
              <span className="text-rose-700 font-bold ml-1">({dashboardStats?.pmOverdueCount} Overdue)</span>
            )}
          </p>
        </div>

        <div
          onClick={() => setActiveTab('inventory')}
          className={`bg-white p-5 rounded-xl border shadow-2xs transition cursor-pointer group ${
            (dashboardStats?.lowStockCount || 0) > 0
              ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
              : 'border-slate-200/90 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Low Stock Warnings</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 group-hover:scale-105 transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-900">{dashboardStats?.lowStockCount ?? 0}</span>
            <span className="text-xs font-semibold text-amber-800">Below Reorder Level</span>
          </div>
          <p className="mt-1 text-xs text-slate-600 font-medium">Automatic reorder alerts</p>
        </div>

        <div
          onClick={() => setActiveTab('requests')}
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-amber-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Pending Requests</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 group-hover:bg-amber-50 group-hover:text-amber-800 group-hover:border-amber-300 transition">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pendingRequests.length}</span>
            <span className="text-xs font-medium text-slate-600">Awaiting Issue</span>
          </div>
          <p className="mt-1 text-xs text-slate-600 font-medium">Verified by 4-digit PIN</p>
        </div>
      </div>

      {/* Low Stock Urgent Warning Banner */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-xs font-bold text-amber-950">
                Low Stock Threshold Alerts ({lowStockItems.length} items require replenishment)
              </h3>
              <p className="text-[11px] text-amber-900 mt-0.5 font-medium">
                The following consumable supplies or assets have dropped to or below their safe minimum reorder quantity.
              </p>
              <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {lowStockItems.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-300 text-xs shadow-2xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 truncate max-w-[180px]">{item.name}</p>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Code: <span className="font-mono text-slate-800 font-semibold">{item.code}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-900">
                        {item.availableQuantity} {item.uom}
                      </span>
                      <p className="text-[10px] text-slate-600 font-semibold">Min: {item.minThreshold}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer shadow-2xs"
            >
              View All Stock
            </button>
          </div>
        </div>
      )}

      {/* Two Column Grid: Pending Requests & Active Repairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Employee Requests for Manager */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900">Pending Employee Requisitions</h3>
              </div>
              <button
                onClick={() => setActiveTab('requests')}
                className="text-xs text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Manager Queue</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {pendingRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-600 text-xs">
                  <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-600 mb-1" />
                  <p className="font-medium">No pending requisitions for this branch.</p>
                </div>
              ) : (
                pendingRequests.slice(0, 4).map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{req.requestId}</span>
                        <span className="text-slate-700 font-medium">by {req.employee?.name || 'Employee'}</span>
                      </div>
                      <p className="text-slate-800 font-medium mt-0.5">
                        {req.requestedQty} {req.uom} • {req.item?.name || 'Item'}
                      </p>
                      <p className="text-[11px] text-slate-600 italic">"{req.reasonText}"</p>
                    </div>

                    <button
                      onClick={() => setActiveTab('requests')}
                      className="px-2.5 py-1 bg-amber-600 text-white rounded-md text-[11px] font-semibold hover:bg-amber-700 transition cursor-pointer shadow-2xs"
                    >
                      Issue
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
            <span>Punch validation requires 4-digit employee usercode</span>
            <span className="font-mono text-slate-700 font-semibold">PIN Secured</span>
          </div>
        </div>

        {/* Vendor Repairs & Asset Engagement Durations */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900">Active Vendor Repairs & Engagement</h3>
              </div>
              <button
                onClick={() => setActiveTab('repairs_vendors')}
                className="text-xs text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Repairs Hub</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {activeRepairs.length === 0 ? (
                <div className="py-8 text-center text-slate-600 text-xs">
                  <Wrench className="w-7 h-7 mx-auto text-slate-400 mb-1" />
                  <p className="font-medium">No assets currently dispatched for vendor repair.</p>
                </div>
              ) : (
                activeRepairs.slice(0, 4).map((rep) => {
                  const hoursEngaged = Math.floor((rep.engagedDurationMinutes || 0) / 60);
                  const daysEngaged = Math.floor(hoursEngaged / 24);
                  return (
                    <div
                      key={rep.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{rep.item?.name || 'Asset Item'}</p>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Vendor: <span className="text-slate-800 font-semibold">{rep.vendor?.name}</span>
                        </p>
                        <p className="text-[11px] text-amber-900 font-medium mt-0.5">
                          Engaged prior to repair:{' '}
                          <span className="font-bold">
                            {daysEngaged > 0 ? `${daysEngaged}d ` : ''}
                            {hoursEngaged % 24}h
                          </span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-semibold text-[10px]">
                          At Vendor
                        </span>
                        <p className="text-[10px] text-slate-600 font-medium mt-1">Est: {rep.expectedReturnDate || 'TBD'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
            <span>Engagement duration calculated before repair or decommissioning</span>
            <span className="font-mono text-slate-700 font-semibold">Lifetime Metric</span>
          </div>
        </div>
      </div>

      {/* Preventive Maintenance Overview Widget */}
      <div className="bg-white rounded-xl border border-slate-200/70 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900">Preventive Maintenance Schedule & Due Tasks</h3>
          </div>
          <button
            onClick={() => setActiveTab('preventive_maintenance')}
            className="text-xs text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Open PM Manager</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="mt-3">
          {duePMWorkOrders.length === 0 ? (
            <div className="py-6 text-center text-slate-600 text-xs">
              <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-600 mb-1" />
              <p className="font-medium">All machinery & asset preventive maintenance is currently up to date.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {duePMWorkOrders.slice(0, 6).map((wo) => {
                const isOverdue = wo.isOverdue;
                return (
                  <div
                    key={wo.id}
                    onClick={() => setActiveTab('preventive_maintenance')}
                    className={`p-3 rounded-lg border transition flex flex-col justify-between cursor-pointer ${
                      isOverdue ? 'border-rose-300 bg-rose-50/40 hover:bg-rose-50/70' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-[10px] text-slate-700 font-semibold">{wo.workOrderNumber}</span>
                        {isOverdue ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-300 px-1.5 py-0.2 rounded">
                            OVERDUE
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-200/80 text-slate-800 border border-slate-300 px-1.5 py-0.2 rounded">
                            {wo.status}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 text-xs truncate">{wo.title}</p>
                      <p className="text-[11px] text-slate-700 font-medium mt-0.5">Machine: {wo.machine?.name || 'Machine'}</p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">Due: <strong className={isOverdue ? 'text-rose-700 font-bold' : 'text-slate-900 font-bold'}>{wo.dueDate}</strong></span>
                      <span className="text-amber-800 font-bold hover:underline">Execute &rarr;</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity / Movements Feed */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900">Recent Stock Movements & Allocations</h3>
          </div>
          <button
            onClick={() => setActiveTab('transfers')}
            className="text-xs text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>All Movements</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200 tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">Quantity & UOM</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Route / Destination</th>
                <th className="py-2.5 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-600 font-medium">
                    No movement records recorded yet.
                  </td>
                </tr>
              ) : (
                recentMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 font-mono font-medium">
                      {new Date(mov.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{mov.item?.name || `Item #${mov.itemId}`}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-900">
                      {mov.quantity} {mov.uom}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-800 border border-slate-300">
                        {mov.movementType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {mov.toDepartment?.name || mov.toBranch?.name || 'Department / Machine'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 italic max-w-xs truncate">{mov.notes || '—'}</td>
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
