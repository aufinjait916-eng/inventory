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
  Sliders,
  Database,
  LogOut,
  CalendarClock,
  HardDriveDownload,
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
  | 'preventive_maintenance'
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
  const { currentRole, currentUserName, dashboardStats, logout } = useApp();

  const roleDisplayNames: Record<UserRole, string> = {
    admin: 'System Admin',
    super_manager: 'Super Manager',
    manager: 'Manager',
    department: 'Dept Operator',
  };

  const mainOperations: { id: NavTab; label: string; icon: React.ElementType; badge?: number; roles: UserRole[]; tooltip: string }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'super_manager', 'manager'],
      tooltip: 'Executive KPIs, equipment overview, and recent activity',
    },
    {
      id: 'inventory',
      label: 'Assets & Consumables',
      icon: Boxes,
      badge: dashboardStats?.lowStockCount ? dashboardStats.lowStockCount : undefined,
      roles: ['admin', 'super_manager', 'manager', 'department'],
      tooltip: 'Catalog of tools, machines, equipment, and consumables',
    },
    {
      id: 'preventive_maintenance',
      label: 'Preventive Maintenance',
      icon: CalendarClock,
      badge: dashboardStats?.pmDueCount ? dashboardStats.pmDueCount : undefined,
      roles: ['admin', 'super_manager', 'manager', 'department'],
      tooltip: 'Scheduled service runs, meter logs, and PM triggers',
    },
    {
      id: 'create_item',
      label: 'New Stock Item',
      icon: PlusCircle,
      roles: ['admin', 'super_manager'],
      tooltip: 'Create new asset or consumable item record',
    },
    {
      id: 'requests',
      label: 'Approvals & Issue',
      icon: ClipboardList,
      badge: dashboardStats?.pendingRequestsCount ? dashboardStats.pendingRequestsCount : undefined,
      roles: ['admin', 'super_manager', 'manager'],
      tooltip: 'Department checkout requests and issue approvals',
    },
    {
      id: 'transfers',
      label: 'Transfers & Logs',
      icon: ArrowLeftRight,
      roles: ['admin', 'super_manager', 'manager'],
      tooltip: 'Inter-branch equipment movements and dispatch receipts',
    },
    {
      id: 'repairs_vendors',
      label: 'Vendors & Repairs',
      icon: Wrench,
      badge: dashboardStats?.activeRepairsCount ? dashboardStats.activeRepairsCount : undefined,
      roles: ['admin', 'super_manager', 'manager'],
      tooltip: 'External service vendors, work orders, and repairs',
    },
  ];

  const configurationItems: { id: NavTab; label: string; icon: React.ElementType; roles: UserRole[]; tooltip: string }[] = [
    {
      id: 'organization',
      label: 'Branch & Personnel',
      icon: Building2,
      roles: ['admin', 'super_manager', 'manager'],
      tooltip: 'Operating branches, departments, and personnel access',
    },
    {
      id: 'department_portal',
      label: 'Employee Kiosk (PIN)',
      icon: KeyRound,
      roles: ['admin', 'super_manager', 'manager', 'department'],
      tooltip: 'Quick employee tool checkouts via PIN badge',
    },
    {
      id: 'categories_fields',
      label: 'Categories & Fields',
      icon: FolderKanban,
      roles: ['admin', 'super_manager'],
      tooltip: 'Custom specification field sets and category taxonomy',
    },
    {
      id: 'postgres_config',
      label: 'PostgreSQL Server',
      icon: Database,
      roles: ['admin', 'super_manager'],
      tooltip: 'Database health, TrueNAS SCALE setup, Docker, and Backup & Restore tab',
    },
    {
      id: 'logs',
      label: 'Audit Trail Logs',
      icon: ScrollText,
      roles: ['admin', 'super_manager'],
      tooltip: 'Immutable audit logs and transactional event history',
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
      .toUpperCase() || 'AU';
  };

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col shrink-0 border-r border-slate-200/80 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
            <span className="font-semibold text-xs tracking-tight text-amber-700">
              AU
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-slate-900 font-semibold text-sm tracking-tight leading-none flex items-center gap-1.5">
              <span>AU Assetflow</span>
            </h1>
            <p className="text-[11px] font-medium text-slate-600 tracking-normal mt-0.5 truncate">
              AU Equipment & Tools
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-slate-600 text-[10px] uppercase font-semibold px-2.5 mb-1 tracking-wider">Main Operations</p>
        {visibleMain.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              title={item.tooltip}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? 'text-amber-950 bg-amber-50 border border-amber-300 font-semibold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-medium border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-700' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-amber-200/80 text-amber-950'
                      : 'bg-slate-200/80 text-slate-800 border border-slate-300/80'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {visibleConfig.length > 0 && (
          <div className="pt-4">
            <p className="text-slate-600 text-[10px] uppercase font-semibold px-2.5 mb-1 tracking-wider">Configuration</p>
            {visibleConfig.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  title={item.tooltip}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'text-amber-950 bg-amber-50 border border-amber-300 font-semibold'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-medium border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-700' : 'text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Database Status */}
      <div
        className="px-3 py-2 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between text-xs"
        title="PostgreSQL cluster active and connected"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          <span className="text-[11px] text-slate-700 font-medium">PostgreSQL Connected</span>
        </div>
        <span className="text-[10px] font-semibold text-slate-700 bg-white border border-slate-300 px-1.5 py-0.2 rounded">
          v16
        </span>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center min-w-0" title={`Signed in as ${currentUserName} (${roleDisplayNames[currentRole]})`}>
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center text-xs font-bold shrink-0">
            {getInitials(currentUserName)}
          </div>
          <div className="ml-2 min-w-0">
            <p className="text-xs font-semibold text-slate-800 leading-none truncate">{currentUserName}</p>
            <p className="text-[10px] text-slate-600 mt-1 uppercase font-medium tracking-wide truncate">
              {roleDisplayNames[currentRole]}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          title="Sign out of AU Assetflow"
          aria-label="Sign out"
          id="btn-sidebar-logout"
          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0 ml-1.5 border border-slate-300/80 hover:border-rose-200"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
