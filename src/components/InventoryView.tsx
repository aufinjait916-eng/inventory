import React, { useState, useEffect, useMemo } from 'react';
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
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
  const [groupByModel, setGroupByModel] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    return true;
  });

  // Group items by Model and calculate low stock at model level
  const modelGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      modelId: number | null;
      modelName: string;
      modelNumber: string;
      manufacturer: string;
      categoryName: string;
      minThreshold: number;
      uom: string;
      items: InventoryItem[];
      totalQuantity: number;
      availableQuantity: number;
      isLowStock: boolean;
    }>();

    filteredItems.forEach((item) => {
      const key = item.modelId ? `model-${item.modelId}` : `nomodel-${item.categoryId || 'none'}`;
      if (!map.has(key)) {
        const threshold = item.model?.minThreshold ?? item.minThreshold ?? 5;
        map.set(key, {
          key,
          modelId: item.modelId || null,
          modelName: item.model?.name || (item.category?.name ? `Generic / Unspecified Model (${item.category.name})` : 'Unassigned Model'),
          modelNumber: item.model?.modelNumber || 'N/A',
          manufacturer: item.model?.manufacturer || 'Standard OEM',
          categoryName: item.category?.name || 'General',
          minThreshold: threshold,
          uom: item.uom,
          items: [],
          totalQuantity: 0,
          availableQuantity: 0,
          isLowStock: false,
        });
      }
      const grp = map.get(key)!;
      grp.items.push(item);
      grp.totalQuantity += (item.totalQuantity || item.availableQuantity || 0);
      grp.availableQuantity += (item.availableQuantity || 0);
    });

    const list = Array.from(map.values());
    list.forEach((g) => {
      // The low stock information should only be shown when grouped by item model by checking the total quantity in the item model is less than the low stock threshold
      g.isLowStock = g.totalQuantity < g.minThreshold;
    });

    if (lowStockOnly) {
      return list.filter((g) => g.isLowStock);
    }

    return list;
  }, [filteredItems, lowStockOnly]);

  const displayedFlatItems = useMemo(() => {
    if (!lowStockOnly) return filteredItems;
    // When lowStockOnly is toggled, filter to items whose model has low stock
    const lowStockModelIds = new Set(modelGroups.filter((g) => g.isLowStock).map((g) => g.modelId));
    return filteredItems.filter((item) => lowStockModelIds.has(item.modelId || null));
  }, [filteredItems, lowStockOnly, modelGroups]);

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

  const renderItemRow = (item: InventoryItem) => {
    // Prioritize stock location with quantity > 0 (e.g. Destination branch after transfer)
    const activeLoc = item.stockLocations?.find((sl) => sl.quantity > 0) || item.stockLocations?.[0];
    const bName = activeLoc?.branch?.name || branches.find((b) => b.id === activeLoc?.branchId)?.name || 'Central Campus';
    const dName = activeLoc?.department?.name || (activeLoc?.departmentId ? `Dept #${activeLoc.departmentId}` : 'Main Store');
    const lName = (activeLoc?.location as any)?.formattedName || activeLoc?.location?.name || 'Main Bin';

    return (
      <tr key={item.id} className="hover:bg-slate-50/80 transition">
        {/* Code / SKU */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2.5">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                  item.itemType === 'asset'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {item.itemType === 'asset' ? <Boxes className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              </div>
            )}
            <div>
              <span className="font-mono font-bold text-xs text-slate-900 uppercase block tracking-wider">
                {item.code}
              </span>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                {item.itemType === 'asset' ? 'Capital Asset' : 'Consumable'}
              </span>
            </div>
          </div>
        </td>

        {/* Name & Model */}
        <td className="py-3 px-4">
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedItemDetail(item)}
              className="font-bold text-slate-900 text-xs hover:text-amber-800 text-left transition cursor-pointer"
            >
              {item.name}
            </button>
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600 font-medium">
              {item.model?.name && (
                <span className="text-slate-800 font-semibold">{item.model.name}</span>
              )}
              {item.model?.modelNumber && item.model.modelNumber !== 'N/A' && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                  {item.model.modelNumber}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Category */}
        <td className="py-3 px-4">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            {item.category?.name || 'General'}
          </span>
        </td>

        {/* Location / Sublocation */}
        <td className="py-3 px-4">
          <div className="space-y-0.5 text-xs">
            <div className="flex items-center gap-1 font-semibold text-slate-800">
              <Building className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>{bName}</span>
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              <span>{dName}</span>
              <span className="mx-1">•</span>
              <span className="text-slate-700">{lName}</span>
            </div>
          </div>
        </td>

        {/* Available Quantity & UOM */}
        <td className="py-3 px-4">
          <div className="flex items-baseline gap-1 font-mono">
            <span className="font-bold text-sm text-slate-900">
              {item.availableQuantity ?? item.totalQuantity}
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-600">{item.uom}</span>
          </div>
          {item.totalQuantity !== undefined && item.totalQuantity !== item.availableQuantity && (
            <span className="text-[10px] text-slate-500 font-medium block">
              Total: {item.totalQuantity} {item.uom}
            </span>
          )}
        </td>

        {/* Status: In repair, in use, available, trashed (Low stock only shown when grouped by model) */}
        <td className="py-3 px-4">
          {item.status === 'in_repair' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300">
              <Wrench className="w-3 h-3 text-amber-700" />
              <span>In Repair</span>
            </span>
          ) : item.status === 'trashed' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-200">
              <Trash2 className="w-3 h-3 text-rose-600" />
              <span>Decommissioned</span>
            </span>
          ) : item.status === 'in_use' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-200">
              <Activity className="w-3 h-3 text-blue-700" />
              <span>In Use</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              <span>Available</span>
            </span>
          )}
        </td>

        {/* Engagement */}
        <td className="py-3 px-4">
          {item.itemType === 'asset' ? (
            <div className="space-y-0.5 text-[11px]">
              <div className="flex items-center gap-1 text-slate-700 font-medium">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{Math.floor((item.totalEngagementMinutes || 0) / 60)} hrs active</span>
              </div>
              <span className="text-[10px] text-slate-500 capitalize">
                State: {item.engagementStatus || 'idle'}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-xs">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="py-3 px-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setSelectedItemDetail(item)}
              title="View Specifications & Custom Fields"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Transfer / Movement button */}
            {onOpenTransfer && item.status !== 'trashed' && item.status !== 'in_repair' && (
              <button
                onClick={() => onOpenTransfer(item)}
                title="Transfer / Relocate Stock"
                className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            )}

            {/* Repair button for Capital Assets */}
            {item.itemType === 'asset' && onOpenRepair && item.status !== 'trashed' && (
              <button
                onClick={() => onOpenRepair(item)}
                disabled={item.status === 'in_repair'}
                title={item.status === 'in_repair' ? 'Item is currently in repair at vendor' : 'Dispatch for Vendor Repair'}
                className={`p-1.5 rounded-lg transition ${
                  item.status === 'in_repair'
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 cursor-pointer'
                }`}
              >
                <Wrench className="w-4 h-4" />
              </button>
            )}

            {/* Admin / Manager actions */}
            {(currentRole === 'admin' || currentRole === 'super_manager') && (
              <>
                <button
                  onClick={() => setEditingItem(item)}
                  title="Edit Item Specs / Model"
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteItemModal({ isOpen: true, item })}
                  title="Delete Item Record"
                  className="p-1.5 text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">Assets & Consumables Catalog</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
              {filteredItems.length} Total SKUs
            </span>
          </div>
          <p className="text-xs text-slate-700 font-medium mt-0.5">
            {currentRole === 'admin' || currentRole === 'super_manager'
              ? `Stock control for branch: ${currentBranch?.name || 'All Branches'}`
              : `Stock restricted to your assigned branch: ${currentBranch?.name || 'Central Plant'}`}
          </p>
        </div>

        {(currentRole === 'admin' || currentRole === 'super_manager') && (
          <button
            id="btn-open-create-item"
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Asset / Consumable</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, tag, or SKU code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 placeholder:text-slate-500"
          />
        </div>

        {/* Classification Filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-300">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              typeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setTypeFilter('asset')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
              typeFilter === 'asset' ? 'bg-white text-amber-900 shadow-2xs' : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Assets</span>
          </button>
          <button
            onClick={() => setTypeFilter('consumable')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
              typeFilter === 'consumable' ? 'bg-white text-amber-900 shadow-2xs' : 'text-slate-700 hover:text-slate-950'
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
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
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
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        >
          <option value="all">All Units (UOM)</option>
          {UOM_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        {/* Group by Model Toggle */}
        <button
          onClick={() => setGroupByModel(!groupByModel)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
            groupByModel
              ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-2xs'
              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/70'
          }`}
          title="Group items by their equipment model template"
        >
          <Layers className="w-3.5 h-3.5 text-amber-700" />
          <span>Group by Item Model</span>
        </button>

        {/* Low Stock Warning Filter */}
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
            lowStockOnly
              ? 'bg-amber-100 text-amber-950 border-amber-400'
              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/70'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
          <span>Low Stock Only</span>
        </button>
      </div>

      {/* Render View: Grouped by Model OR Flat List */}
      {groupByModel ? (
        /* Model Grouped View */
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-600 font-medium">
              Loading model groups from PostgreSQL...
            </div>
          ) : modelGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-600">
              <Boxes className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="font-semibold text-slate-800">No models matched your filter criteria.</p>
              <p className="text-xs text-slate-600 mt-1">Try resetting filters or click "+ Add Asset / Consumable".</p>
            </div>
          ) : (
            modelGroups.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);

              return (
                <div
                  key={group.key}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-2xs ${
                    group.isLowStock
                      ? 'border-amber-300/80 ring-1 ring-amber-300/40'
                      : 'border-slate-200/90'
                  }`}
                >
                  {/* Model Group Header */}
                  <div
                    onClick={() => toggleGroupCollapse(group.key)}
                    className={`p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition ${
                      group.isLowStock
                        ? 'bg-gradient-to-r from-amber-50/70 to-white hover:bg-amber-50'
                        : 'bg-slate-50/70 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>

                      <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm">{group.modelName}</h3>
                          {group.modelNumber !== 'N/A' && (
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-200/70 text-slate-800 font-semibold">
                              {group.modelNumber}
                            </span>
                          )}
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                            {group.categoryName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                          Manufacturer: <span className="text-slate-800 font-semibold">{group.manufacturer}</span> •{' '}
                          <span className="font-semibold text-slate-800">{group.items.length}</span> SKU records assigned
                        </p>
                      </div>
                    </div>

                    {/* Stock Metrics & Low Stock Indicator */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-[11px] text-slate-600 font-medium">Total Model Stock:</span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              group.isLowStock ? 'text-amber-900' : 'text-slate-900'
                            }`}
                          >
                            {group.totalQuantity}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-600">{group.uom}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Threshold: ≤{group.minThreshold} {group.uom}
                        </span>
                      </div>

                      {/* LOW STOCK BADGE: Only shown when grouped by item model */}
                      {group.isLowStock ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-400 shadow-2xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>Low Stock (Total {group.totalQuantity} &lt; {group.minThreshold})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Healthy Stock</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Group Items Table (Collapsible) */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-200/80 overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-800">
                        <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200 tracking-wider">
                          <tr>
                            <th className="py-2.5 px-4">Code / SKU</th>
                            <th className="py-2.5 px-4">Item Name</th>
                            <th className="py-2.5 px-4">Category</th>
                            <th className="py-2.5 px-4">Location / Sublocation</th>
                            <th className="py-2.5 px-4">Available Qty & UOM</th>
                            <th className="py-2.5 px-4">Item Status</th>
                            <th className="py-2.5 px-4">Engagement</th>
                            <th className="py-2.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {group.items.map((item) => renderItemRow(item))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Flat Items Table View */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Code / SKU</th>
                  <th className="py-2.5 px-4">Name & Model</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Location / Sublocation</th>
                  <th className="py-2.5 px-4">Available Quantity & UOM</th>
                  <th className="py-2.5 px-4">Status & Health</th>
                  <th className="py-2.5 px-4">Engagement / Lifetime</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-600 font-medium">
                      Loading stock records from PostgreSQL...
                    </td>
                  </tr>
                ) : displayedFlatItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-600">
                      <Boxes className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="font-semibold text-slate-800">No inventory items matched your filter criteria.</p>
                      <p className="text-xs text-slate-600 mt-1">Try resetting filters or click "+ Add Asset / Consumable".</p>
                    </td>
                  </tr>
                ) : (
                  displayedFlatItems.map((item) => renderItemRow(item))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item Detail / Custom Fields Modal */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Stock Item Specification</span>
                <h3 className="text-base font-bold text-slate-900">{selectedItemDetail.name}</h3>
                <p className="font-mono text-xs text-amber-900 font-bold">{selectedItemDetail.code}</p>
              </div>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Photo if available */}
            {selectedItemDetail.imageUrl && (
              <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-300 bg-slate-50 flex items-center justify-center">
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
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-600 block text-[10px] uppercase font-bold">Category</span>
                <span className="font-semibold text-slate-900">{selectedItemDetail.category?.name}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-600 block text-[10px] uppercase font-bold">Model</span>
                <span className="font-semibold text-slate-900">{selectedItemDetail.model?.name || 'Standard'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-600 block text-[10px] uppercase font-bold">UOM</span>
                <span className="font-semibold text-slate-900 uppercase">{selectedItemDetail.uom}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-600 block text-[10px] uppercase font-bold">Available Stock</span>
                <span className="font-bold text-emerald-800 font-mono">
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
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-300 space-y-1.5">
                  {Object.entries(selectedItemDetail.customFieldsData).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-slate-800 font-semibold capitalize">{key.replace(/_/g, ' ')}:</span>
                      <span className="font-bold text-amber-950 font-mono">{String(val) || '—'}</span>
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
                      <span className="text-slate-800 font-medium">
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
              <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Notes:</span>
                {selectedItemDetail.notes}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Delete Inventory SKU?</h3>
              <p className="text-xs text-slate-500 mt-1.5">
                Are you sure you want to delete SKU <span className="font-medium text-slate-700">{deleteItemModal.item.name}</span> ({deleteItemModal.item.code})? All associated stock allocations and transaction references will be permanently removed.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeleteItemModal({ isOpen: false, item: null })}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-2xs cursor-pointer transition"
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
