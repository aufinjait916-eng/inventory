import React from 'react';
import {
  LogOut,
  AlertTriangle,
  User,
  Shield,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { UserRole } from '../types.ts';

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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 sticky top-0 z-30 shadow-xs">
      {/* Left: Breadcrumbs & Branch Selector */}
      <div className="flex items-center gap-2">
        <div className="flex items-center text-sm">
          <span className="text-slate-400 mr-2 font-medium">Branches /</span>
          {currentRole === 'admin' || currentRole === 'super_manager' ? (
            <select
              id="header-branch-select"
              value={currentBranchId}
              onChange={(e) => setCurrentBranchId(parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="font-semibold text-slate-900 text-sm">
              {currentBranch ? `${currentBranch.name} (${currentBranch.code})` : 'Central Plant (HQ)'}
            </span>
          )}
        </div>

        {/* Department Selector for Department terminal */}
        {currentRole === 'department' && (
          <div className="flex items-center gap-1.5 ml-3 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 text-xs">
            <span className="text-emerald-700 font-semibold">Dept:</span>
            <select
              id="header-department-select"
              value={currentDepartmentId}
              onChange={(e) => setCurrentDepartmentId(parseInt(e.target.value))}
              className="bg-transparent font-bold text-emerald-900 focus:outline-none cursor-pointer text-xs"
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

      {/* Right: Low Stock Alert & Authenticated User Profile + Logout */}
      <div className="flex items-center gap-4">
        {/* Low Stock Alert Pill */}
        {dashboardStats?.lowStockCount ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{dashboardStats.lowStockCount} Low Stock</span>
          </div>
        ) : null}

        {/* User Profile Info & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {currentUserName ? currentUserName[0].toUpperCase() : 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[160px]">
                {currentUserName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border ${roleLabels[currentRole]?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {roleLabels[currentRole]?.title || currentRole}
                </span>
                {(currentRole === 'admin' || currentRole === 'super_manager') && (
                  <span className="text-[10px] text-slate-400 font-medium">· Global</span>
                )}
              </div>
            </div>
          </div>

          <button
            id="btn-header-logout"
            onClick={logout}
            title="Log out of session"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer shadow-xs ml-1"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
