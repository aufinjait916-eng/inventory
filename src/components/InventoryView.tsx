import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Package,
  Search,
  Filter,
  AlertTriangle,
  Plus,
  ArrowRightLeft,
  Wrench,
  Eye,
  Building,
  Layers,
  Sparkles,
  Info,
  Clock,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { InventoryItem, Category, UOM_OPTIONS } from '../types.ts';
import { ItemCreateModal } from './ItemCreateModal.tsx';
import { ItemEditModal } from './ItemEditModal.tsx';

interface InventoryViewProps {
  onOpenTransfer?: (item: InventoryItem) => void;
  onOpenRepair?: (item: InventoryItem) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onOpenTransfer, onOpenRepair }) => {
  const { currentRole, currentBranchId, branches, showToast, refreshAll } = useApp();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'asset' | 'consumable'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [uomFilter, setUomFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals & Detail drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItem | null>(null);

  // Delete modal state
  const [deleteItemModal, setDeleteItemModal] = useState<{
    isOpen: boolean;
    item: InventoryItem | null;
  }>({
    isOpen: false,
    item: null,
  });

  const currentBranch = branches.find((b) => b.id === currentBranchId);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (currentBranchId) queryParams.set('branchId', currentBranchId.toString());
      if (typeFilter !== 'all') queryParams.set('type', typeFilter);
      if (categoryFilter !== 'all') queryParams.set('categoryId', categoryFilter);
      if (search) queryParams.set('search', search);

      const [invData, catData] = await Promise.all([
        fetchApi<InventoryItem[]>(`/api/inventory?${queryParams.toString()}`),
        fetchApi<Category[]>('/api/categories'),
      ]);

      setItems(invData || []);
      setCategories(catData || []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      showToast('Failed to load stock list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [currentBranchId, typeFilter, categoryFilter, search]);

  const filteredItems = items.filter((item) => {
    if (uomFilter !== 'all' && item.uom !== uomFilter) return false;
    if (lowStockOnly && item.availableQuantity > item.minThreshold) return false;
    return true;
  });

  const handleDeleteItem = async () => {
    if (!deleteItemModal.item) return;
    try {
      await fetchApi(`/api/inventory/${deleteItemModal.item.id}`, { method: 'DELETE' });
      showToast(`Inventory record "${deleteItemModal.item.name}" deleted.`, 'success');
      setDeleteItemModal({ isOpen: false, item: null });
      await loadInventory();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete inventory record', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900">Assets & Consumables Catalog</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {filteredItems.length} Total SKUs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentRole === 'admin' || currentRole === 'super_manager'
              ? `Stock control for branch: ${currentBranch?.name || 'All Branches'}`
              : `Stock restricted to your assigned branch: ${currentBranch?.name || 'Central Plant'}`}
          </p>
        </div>

        {(currentRole === 'admin' || currentRole === 'super_manager') && (
          <button
            id="btn-open-create-item"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset / Consumable</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, tag, or SKU code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Classification Filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              typeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setTypeFilter('asset')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1 ${
              typeFilter === 'asset' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Assets</span>
          </button>
          <button
            onClick={() => setTypeFilter('consumable')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1 ${
              typeFilter === 'consumable' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Consumables</span>
          </button>
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id.toString()}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>

        {/* UOM Filter */}
        <select
          value={uomFilter}
          onChange={(e) => setUomFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Units (UOM)</option>
          {UOM_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        {/* Low Stock Warning Filter */}
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition border ${
            lowStockOnly
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Low Stock Only</span>
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Code / SKU</th>
                <th className="py-3 px-4">Name & Model</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Location / Sublocation</th>
                <th className="py-3 px-4">Available Quantity & UOM</th>
                <th className="py-3 px-4">Status & Health</th>
                <th className="py-3 px-4">Engagement / Lifetime</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading stock records from PostgreSQL...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No inventory items matched your filter criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting filters or click "+ Add Asset / Consumable".</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.availableQuantity <= item.minThreshold;
                  const hoursEngaged = Math.floor((item.totalEngagementMinutes || 0) / 60);

                  // Extract location tags
                  const branchStockLocs = (item.stockLocations || []).filter(
                    (sl) => !currentBranchId || sl.branchId === currentBranchId
                  );

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {item.code}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                item.itemType === 'asset'
                                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}
                            >
                              {item.itemType === 'asset' ? (
                                <Boxes className="w-5 h-5" />
                              ) : (
                                <Package className="w-5 h-5" />
                              )}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            {item.model && (
                              <p className="text-[11px] text-slate-500">
                                Model: <span className="font-medium text-slate-700">{item.model.name}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {item.category?.name || 'General'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {branchStockLocs.length > 0 ? (
                          <div className="space-y-1">
                            {branchStockLocs.slice(0, 2).map((sl, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                                <Building className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-800">
                                  {sl.department?.name || 'General'}:
                                </span>
                                <span className="text-slate-600 truncate max-w-[140px]" title={sl.location?.formattedName || sl.location?.name || 'Direct Area'}>
                                  {sl.location?.formattedName || sl.location?.name || 'Direct Area'}
                                </span>
                                {sl.quantity > 0 && (
                                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded shrink-0">
                                    {sl.quantity}
                                  </span>
                                )}
                              </div>
                            ))}
                            {branchStockLocs.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                +{branchStockLocs.length - 2} more locations
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">General Storage</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`font-mono text-sm font-extrabold ${
                              isLow ? 'text-amber-700' : 'text-slate-900'
                            }`}
                          >
                            {item.availableQuantity}
                          </span>
                          <span className="font-bold text-slate-500 text-[11px] uppercase">{item.uom}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Total: {item.totalQuantity} {item.uom}</span>
                      </td>

                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock (≤{item.minThreshold})
                          </span>
                        ) : item.status === 'in_repair' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                            <Wrench className="w-3 h-3" />
                            In Repair
                          </span>
                        ) : item.status === 'trashed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            Trashed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Healthy Stock
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {item.itemType === 'asset' ? (
                          <div className="text-[11px]">
                            <span className="text-slate-500">Engaged: </span>
                            <span className="font-bold text-slate-800 font-mono">
                              {hoursEngaged > 0 ? `${hoursEngaged} hrs` : 'Idle / Fresh'}
                            </span>
                            {item.engagementStatus === 'engaged' && (
                              <span className="block text-[10px] text-blue-600 font-semibold">Active in Line</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Inspect Details & Custom Fields"
                            onClick={() => setSelectedItemDetail(item)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {(currentRole === 'admin' || currentRole === 'super_manager' || currentRole === 'manager') && (
                            <>
                              <button
                                title="Edit Record"
                                onClick={() => setEditingItem(item)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                title="Move / Transfer between Departments or Branches"
                                onClick={() => onOpenTransfer && onOpenTransfer(item)}
                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>

                              {item.itemType === 'asset' && (
                                <button
                                  title="Send to Vendor for Repair & Log Engagement Time"
                                  onClick={() => onOpenRepair && onOpenRepair(item)}
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                >
                                  <Wrench className="w-4 h-4" />
                                </button>
                              )}

                              {(currentRole === 'admin' || currentRole === 'super_manager') && (
                                <button
                                  title="Delete Inventory Record"
                                  onClick={() => setDeleteItemModal({ isOpen: true, item })}
                                  className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Detail / Custom Fields Modal */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Stock Item Specification</span>
                <h3 className="text-base font-bold text-slate-900">{selectedItemDetail.name}</h3>
                <p className="font-mono text-xs text-blue-600 font-semibold">{selectedItemDetail.code}</p>
              </div>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Photo if available */}
            {selectedItemDetail.imageUrl && (
              <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                <img
                  src={selectedItemDetail.imageUrl}
                  alt={selectedItemDetail.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Core specs */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                <span className="font-bold text-slate-800">{selectedItemDetail.category?.name}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Model</span>
                <span className="font-bold text-slate-800">{selectedItemDetail.model?.name || 'Standard'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">UOM</span>
                <span className="font-bold text-slate-800 uppercase">{selectedItemDetail.uom}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Available Stock</span>
                <span className="font-bold text-emerald-700 font-mono">
                  {selectedItemDetail.availableQuantity} {selectedItemDetail.uom}
                </span>
              </div>
            </div>

            {/* Custom Field Values from Model's Field Set */}
            {selectedItemDetail.customFieldsData && Object.keys(selectedItemDetail.customFieldsData).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Model Custom Field Values
                </h4>
                <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-1.5">
                  {Object.entries(selectedItemDetail.customFieldsData).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                      <span className="font-bold text-indigo-950 font-mono">{String(val) || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Location Breakdown */}
            {selectedItemDetail.stockLocations && selectedItemDetail.stockLocations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Physical Allocation</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  {selectedItemDetail.stockLocations.map((loc) => (
                    <div key={loc.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        {branches.find((b) => b.id === loc.branchId)?.name || 'Branch'} • Dept #{loc.departmentId || 'Main'}
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {loc.quantity} {selectedItemDetail.uom}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedItemDetail.notes && (
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700 block mb-0.5">Notes:</span>
                {selectedItemDetail.notes}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Creating new item */}
      <ItemCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          loadInventory();
          refreshAll();
        }}
      />

      {/* Modal for Editing item */}
      <ItemEditModal
        isOpen={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSuccess={() => {
          loadInventory();
          refreshAll();
        }}
      />

      {/* Delete Confirmation Modal */}
      {deleteItemModal.isOpen && deleteItemModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Inventory SKU?</h3>
              <p className="text-xs text-slate-500 mt-1.5">
                Are you sure you want to delete SKU <span className="font-bold text-slate-800">{deleteItemModal.item.name}</span> ({deleteItemModal.item.code})? All associated stock allocations and transaction references will be permanently removed.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeleteItemModal({ isOpen: false, item: null })}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
