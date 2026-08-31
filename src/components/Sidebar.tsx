import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  PlusCircle,
  FolderKanban,
  ArrowLeftRight,
  ClipboardList,
  Wrench,
  Building2,
  ScrollText,
  KeyRound,
  Sparkles,
  Sliders,
  Database,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { UserRole } from '../types.ts';

export type NavTab =
  | 'dashboard'
  | 'inventory'
  | 'create_item'
  | 'categories_fields'
  | 'transfers'
  | 'requests'
  | 'department_portal'
  | 'repairs_vendors'
  | 'organization'
  | 'logs'
  | 'postgres_config';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentRole, currentUserName, dashboardStats, seedDemoData } = useApp();

  const roleDisplayNames: Record<UserRole, string> = {
    admin: 'System Admin',
    super_manager: 'Super Manager',
    manager: 'Manager',
    department: 'Dept Operator',
  };

  const mainOperations: { id: NavTab; label: string; icon: React.ElementType; badge?: number; roles: UserRole[] }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'super_manager', 'manager'],
    },
    {
      id: 'inventory',
      label: 'Assets & Consumables',
      icon: Boxes,
      badge: dashboardStats?.lowStockCount ? dashboardStats.lowStockCount : undefined,
      roles: ['admin', 'super_manager', 'manager', 'department'],
    },
    {
      id: 'create_item',
      label: 'New Stock Item',
      icon: PlusCircle,
      roles: ['admin', 'super_manager'],
    },
    {
      id: 'department_portal',
      label: 'Employee Kiosk (PIN)',
      icon: KeyRound,
      roles: ['admin', 'super_manager', 'manager', 'department'],
    },
    {
      id: 'requests',
      label: 'Approvals & Issue',
      icon: ClipboardList,
      badge: dashboardStats?.pendingRequestsCount ? dashboardStats.pendingRequestsCount : undefined,
      roles: ['admin', 'super_manager', 'manager'],
    },
    {
      id: 'transfers',
      label: 'Transfers & Logs',
      icon: ArrowLeftRight,
      roles: ['admin', 'super_manager', 'manager'],
    },
    {
      id: 'repairs_vendors',
      label: 'Vendors & Repairs',
      icon: Wrench,
      badge: dashboardStats?.activeRepairsCount ? dashboardStats.activeRepairsCount : undefined,
      roles: ['admin', 'super_manager', 'manager'],
    },
    {
      id: 'organization',
      label: 'Branches & Personnel',
      icon: Building2,
      roles: ['admin', 'super_manager', 'manager'],
    },
  ];

  const configurationItems: { id: NavTab; label: string; icon: React.ElementType; roles: UserRole[] }[] = [
    {
      id: 'categories_fields',
      label: 'Categories & Fields',
      icon: FolderKanban,
      roles: ['admin', 'super_manager'],
    },
    {
      id: 'postgres_config',
      label: 'PostgreSQL Server',
      icon: Database,
      roles: ['admin', 'super_manager'],
    },
    {
      id: 'logs',
      label: 'Audit Trail Logs',
      icon: ScrollText,
      roles: ['admin', 'super_manager'],
    },
  ];

  const visibleMain = mainOperations.filter((item) => item.roles.includes(currentRole));
  const visibleConfig = configurationItems.filter((item) => item.roles.includes(currentRole));

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'AM';
  };

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-700/50">
        <h1 className="text-white font-bold text-lg tracking-tight flex items-center">
          <span className="w-7 h-7 bg-blue-500 rounded mr-2.5 flex items-center justify-center text-xs font-bold text-white shadow-xs">
            AM
          </span>
          ASSETFLOW
        </h1>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1.5 font-semibold">
          Enterprise Stock & Equipment
        </p>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-slate-500 text-[10px] uppercase font-bold px-3 mb-1.5 tracking-wider">Main Operations</p>
        {visibleMain.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'text-white bg-blue-600/15 border-l-4 border-blue-500 rounded-r shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-r'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-blue-500 text-white' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {visibleConfig.length > 0 && (
          <div className="pt-5">
            <p className="text-slate-500 text-[10px] uppercase font-bold px-3 mb-1.5 tracking-wider">Configuration</p>
            {visibleConfig.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white bg-blue-600/15 border-l-4 border-blue-500 rounded-r shadow-xs font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-r'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Database Status & Seed */}
      <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-[11px] text-slate-400 font-medium">PostgreSQL Live</span>
        </div>
        <button
          id="btn-seed-demo-data"
          onClick={seedDemoData}
          title="Reset database to demo dataset"
          className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition"
        >
          <Sparkles className="w-3 h-3" />
          <span>Reset Demo</span>
        </button>
      </div>

      {/* User Profile Footer */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-bold shrink-0">
            {getInitials(currentUserName)}
          </div>
          <div className="ml-3 min-w-0">
            <p className="text-xs font-bold text-white leading-none truncate">{currentUserName}</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
              {roleDisplayNames[currentRole]}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
