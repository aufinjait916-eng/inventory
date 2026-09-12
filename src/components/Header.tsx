import React, { useState, useEffect } from 'react';
import {
  LogOut,
  AlertTriangle,
  User,
  Shield,
  CalendarClock,
  Wrench,
  CheckCircle2,
  Bell,
  Building2,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { UserRole } from '../types.ts';
import { fetchApi } from '../lib/api.ts';

export const Header: React.FC = () => {
  const {
    currentRole,
    currentBranchId,
    setCurrentBranchId,
    currentDepartmentId,
    setCurrentDepartmentId,
    currentUserName,
    authenticatedUser,
    branches,
    departments,
    dashboardStats,
    logout,
  } = useApp();

  const [pmBadges, setPmBadges] = useState<{
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    totalPending: number;
  } | null>(null);

  const loadPMBadges = async () => {
    try {
      const data = await fetchApi<any>(`/api/pm/summary-badges?branchId=${currentBranchId}`);
      if (data) {
        setPmBadges(data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadPMBadges();
    const interval = setInterval(loadPMBadges, 30000);
    return () => clearInterval(interval);
  }, [currentBranchId]);

  const roleLabels: Record<UserRole, { title: string; badgeColor: string }> = {
    admin: {
      title: 'System Administrator',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    super_manager: {
      title: 'Super Manager',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    manager: {
      title: 'Manager',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    department: {
      title: 'Department Kiosk',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  };

  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const branchDepartments = departments.filter((d) => d.branchId === currentBranchId);

  return (
    <header className="h-14 bg-white border-b border-slate-200/70 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
      {/* Left: Branch Selector & Active Badge */}
      <div className="flex items-center gap-3">
        {/* Branch Card */}
        <div
          title="Active operating branch. All inventory levels, tool allocations, and operations reflect this location."
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-amber-300 transition"
        >
          {/* Branch Icon with soft Amber tint */}
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>

          <div className="flex flex-col text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                Active Branch:
              </span>
              {currentBranch && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded">
                  {currentBranch.code}
                </span>
              )}
            </div>

            {currentRole === 'admin' || currentRole === 'super_manager' ? (
              <div className="relative flex items-center mt-0.5">
                <select
                  id="header-branch-select"
                  value={currentBranchId}
                  onChange={(e) => setCurrentBranchId(parseInt(e.target.value))}
                  title="Switch active operating branch location"
                  tabIndex={1}
                  className="appearance-none font-semibold text-slate-900 text-xs sm:text-sm pr-6 bg-transparent focus:outline-hidden cursor-pointer tracking-normal"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) - {b.city || 'Main Site'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-0 pointer-events-none" />
              </div>
            ) : (
              <span className="font-semibold text-slate-900 text-xs sm:text-sm truncate max-w-[180px]">
                {currentBranch ? currentBranch.name : 'Central Plant (HQ)'}
              </span>
            )}
          </div>
        </div>

        {/* Department Selector for Department terminal */}
        {currentRole === 'department' && (
          <div
            title="Operating department within this branch"
            className="flex items-center gap-1.5 ml-1 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-300 text-xs"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-emerald-900 font-semibold">Dept:</span>
            <select
              id="header-department-select"
              value={currentDepartmentId}
              onChange={(e) => setCurrentDepartmentId(parseInt(e.target.value))}
              title="Select your operating department"
              tabIndex={2}
              className="bg-transparent font-semibold text-emerald-950 focus:outline-hidden cursor-pointer text-xs"
            >
              {branchDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Low Stock Alert & PM Notifications & User Profile & Small Logout Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* PM Notification Pill */}
        {pmBadges && pmBadges.overdue > 0 ? (
          <div
            title={`${pmBadges.overdue} scheduled maintenance services are currently overdue!`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-300 text-xs font-semibold cursor-default"
          >
            <CalendarClock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{pmBadges.overdue} PM Overdue</span>
          </div>
        ) : pmBadges && pmBadges.dueToday > 0 ? (
          <div
            title={`${pmBadges.dueToday} preventative maintenance service tasks due today`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-xs font-semibold cursor-default"
          >
            <CalendarClock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>{pmBadges.dueToday} PM Today</span>
          </div>
        ) : null}

        {/* Low Stock Alert Pill */}
        {dashboardStats?.lowStockCount ? (
          <div
            title={`${dashboardStats.lowStockCount} items are below designated minimum threshold`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-900 border border-orange-300 text-xs font-semibold cursor-default"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>{dashboardStats.lowStockCount} Low Stock</span>
          </div>
        ) : null}

        {/* User Profile Info & Compact Logout */}
        <div className="flex items-center gap-2.5 pl-2.5 sm:pl-3 border-l border-slate-300/80">
          <div
            title={`Current Operator: ${currentUserName} (${roleLabels[currentRole]?.title || currentRole})`}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center text-xs font-bold shrink-0">
              {currentUserName ? currentUserName[0].toUpperCase() : 'U'}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[140px]">
                {currentUserName}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold border ${roleLabels[currentRole]?.badgeColor || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
                  {roleLabels[currentRole]?.title || currentRole}
                </span>
              </div>
            </div>
          </div>

          {/* Small Logout Button - Icon Only */}
          <button
            id="btn-header-logout"
            onClick={logout}
            title="Sign out of AU Assetflow"
            aria-label="Sign out"
            tabIndex={100}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-300/80 hover:border-rose-200 rounded-lg transition cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
