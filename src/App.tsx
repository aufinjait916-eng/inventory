import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { InventoryView } from './components/InventoryView.tsx';
import { ItemCreateModal } from './components/ItemCreateModal.tsx';
import { DepartmentPunchPortal } from './components/DepartmentPunchPortal.tsx';
import { RequestManagement } from './components/RequestManagement.tsx';
import { MovementsManager } from './components/MovementsManager.tsx';
import { VendorsRepairsView } from './components/VendorsRepairsView.tsx';
import { CategoriesAndFieldsView } from './components/CategoriesAndFieldsView.tsx';
import { OrganizationView } from './components/OrganizationView.tsx';
import { AuditLogsView } from './components/AuditLogsView.tsx';
import { PostgresConfigView } from './components/PostgresConfigView.tsx';
import { InventoryItem } from './types.ts';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { toast } = useApp();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Quick modals across views
  const [isItemCreateModalOpen, setIsItemCreateModalOpen] = useState(false);
  const [transferTargetItem, setTransferTargetItem] = useState<InventoryItem | null>(null);
  const [repairTargetItem, setRepairTargetItem] = useState<InventoryItem | null>(null);

  const handleOpenTransfer = (item: InventoryItem) => {
    setTransferTargetItem(item);
    setActiveTab('transfers');
  };

  const handleOpenRepair = (item: InventoryItem) => {
    setRepairTargetItem(item);
    setActiveTab('repairs_vendors');
  };

  const handleNavSelect = (tab: NavTab) => {
    if (tab === 'create_item') {
      setIsItemCreateModalOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans text-slate-800 antialiased">
      {/* Side Menu Navigation System */}
      <Sidebar activeTab={activeTab} setActiveTab={handleNavSelect} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header with Role Switcher & Branch Selector */}
        <Header />

        {/* Dynamic View Canvas */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} />}
            {activeTab === 'inventory' && (
              <InventoryView
                onOpenTransfer={handleOpenTransfer}
                onOpenRepair={handleOpenRepair}
              />
            )}
            {activeTab === 'department_portal' && <DepartmentPunchPortal />}
            {activeTab === 'requests' && <RequestManagement />}
            {activeTab === 'transfers' && <MovementsManager initialItem={transferTargetItem} />}
            {activeTab === 'repairs_vendors' && <VendorsRepairsView initialRepairItem={repairTargetItem} />}
            {activeTab === 'categories_fields' && <CategoriesAndFieldsView />}
            {activeTab === 'organization' && <OrganizationView />}
            {activeTab === 'logs' && <AuditLogsView />}
            {activeTab === 'postgres_config' && <PostgresConfigView />}
          </div>
        </main>
      </div>

      {/* Global Stock Creation Modal */}
      <ItemCreateModal
        isOpen={isItemCreateModalOpen}
        onClose={() => setIsItemCreateModalOpen(false)}
        onSuccess={() => {
          setActiveTab('inventory');
        }}
      />

      {/* Global Toast Alert Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border ${
              toast.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-950 text-rose-200 border-rose-800'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

export default App;
