import React from 'react';
import {
  Building,
  LogIn,
  LogOut,
  AlertTriangle,
  Layers,
  Search,
  Bell,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { UserRole } from '../types.ts';

export const Header: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    currentBranchId,
    setCurrentBranchId,
    currentDepartmentId,
    setCurrentDepartmentId,
    currentUserName,
    branches,
    departments,
    dashboardStats,
    currentUser,
    loginWithGoogle,
    logout,
  } = useApp();

  const roleLabels: Record<UserRole, { title: string; badgeColor: string; desc: string }> = {
    admin: {
      title: 'Admin',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      desc: 'All branches, category builder & permissions',
    },
    super_manager: {
      title: 'Super Manager',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      desc: 'Dynamic fields, field sets, models & item catalog',
    },
    manager: {
      title: 'Manager',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      desc: 'Assigned categories, stock control, approvals, transfers, repairs',
    },
    department: {
      title: 'Department Kiosk',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      desc: 'Employee 4-digit PIN punch & machine assignment',
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
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 font-semibold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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

      {/* Center/Right: Role Switcher & Context Controls */}
      <div className="flex items-center gap-4">
        {/* Role Switcher Pill */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            Role:
          </span>
          <div className="flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
            {(['admin', 'super_manager', 'manager', 'department'] as UserRole[]).map((r) => {
              const isSelected = currentRole === r;
              return (
                <button
                  key={r}
                  id={`role-switch-${r}`}
                  onClick={() => setCurrentRole(r)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {roleLabels[r].title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Low Stock Alert Pill */}
        {dashboardStats?.lowStockCount ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{dashboardStats.lowStockCount} Low Stock</span>
          </div>
        ) : null}

        {/* User Profile / Google Sign-in */}
        {currentUser ? (
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {currentUser.displayName ? currentUser.displayName[0] : 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-slate-800 leading-none">{currentUser.displayName || currentUser.email}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{roleLabels[currentRole].title}</p>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            id="btn-google-login"
            onClick={loginWithGoogle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Google Auth</span>
          </button>
        )}
      </div>
    </header>
  );
};
