import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Building,
  Layers,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Search,
  Plus,
  Boxes,
  Package,
  AlertCircle,
  Trash2,
  Check,
  X,
  MapPin,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { SearchableItemSelect } from './SearchableItemSelect.tsx';
import {
  Movement,
  InventoryItem,
  Branch,
  Department,
  LocationItem,
  Machine,
} from '../types.ts';

interface MovementsManagerProps {
  initialItem?: InventoryItem | null;
}

export const MovementsManager: React.FC<MovementsManagerProps> = ({ initialItem }) => {
  const { currentRole, currentBranchId, branches, departments, showToast, refreshAll } = useApp();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<Movement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [targetDepts, setTargetDepts] = useState<Department[]>([]);
  const [targetLocations, setTargetLocations] = useState<LocationItem[]>([]);
  const [targetMachines, setTargetMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  // New Movement Modal
  const [isModalOpen, setIsModalOpen] = useState(!!initialItem);
  const [selectedItemId, setSelectedItemId] = useState<number | ''>(initialItem?.id || '');
  const [movementType, setMovementType] = useState<
    'dept_to_dept' | 'branch_to_branch' | 'assigned_to_machine' | 'issued_to_employee' | 'trashed'
  >('dept_to_dept');
  const [quantity, setQuantity] = useState<string>('1');
  const [toBranchId, setToBranchId] = useState<number>(currentBranchId);
  const [fromDeptId, setFromDeptId] = useState<number | ''>('');
  const [toDeptId, setToDeptId] = useState<number | ''>('');
  const [toLocationId, setToLocationId] = useState<number | ''>('');
  const [toMachineId, setToMachineId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Accept & Allocate Transfer Modal
  const [acceptingMovement, setAcceptingMovement] = useState<Movement | null>(null);
  const [allocDeptId, setAllocDeptId] = useState<number | ''>('');
  const [allocLocationId, setAllocLocationId] = useState<number | ''>('');
  const [allocNotes, setAllocNotes] = useState('');
  const [allocSubmitting, setAllocSubmitting] = useState(false);

  // Current branch locations & depts for allocation
  const [currentBranchLocations, setCurrentBranchLocations] = useState<LocationItem[]>([]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const [movData, pendingData, invData, branchData, locData] = await Promise.all([
        fetchApi<Movement[]>(`/api/movements?branchId=${currentBranchId}`),
        fetchApi<Movement[]>(`/api/movements/pending?branchId=${currentBranchId}`),
        fetchApi<InventoryItem[]>(`/api/inventory?all=true&branchId=${currentBranchId}`),
        fetchApi<Branch[]>('/api/branches'),
        fetchApi<LocationItem[]>(`/api/locations?branchId=${currentBranchId}`),
      ]);

      setMovements(movData || []);
      setPendingTransfers(pendingData || []);
      const loadedItems = invData || [];
      setItems(loadedItems);
      setAllBranches(branchData || []);
      setCurrentBranchLocations(locData || []);

      if (!selectedItemId && loadedItems.length > 0) {
        setSelectedItemId(loadedItems[0].id);
        if (loadedItems[0].itemType === 'asset') {
          setQuantity('1');
        }
      }
    } catch (err) {
      console.error('Failed to load movements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [currentBranchId]);

  // Sync quantity whenever selected item changes
  const selectedItemObj = items.find((i) => i.id === selectedItemId);

  useEffect(() => {
    if (selectedItemObj) {
      if (selectedItemObj.itemType === 'asset') {
        setQuantity('1');
      }
    }
  }, [selectedItemId, selectedItemObj]);
  useEffect(() => {
    async function loadBranchEntities() {
      try {
        const [dData, lData, mData] = await Promise.all([
          fetchApi<Department[]>(`/api/departments?branchId=${toBranchId}`),
          fetchApi<LocationItem[]>(`/api/locations?branchId=${toBranchId}`),
          fetchApi<Machine[]>(`/api/machines?branchId=${toBranchId}`),
        ]);
        setTargetDepts(dData || []);
        setTargetLocations(lData || []);
        setTargetMachines(mData || []);
      } catch (err) {
        console.error('Failed to load target entities:', err);
      }
    }
    loadBranchEntities();
  }, [toBranchId]);

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !quantity) {
      showToast('Please select an item and specify quantity to move', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await fetchApi('/api/movements', {
        method: 'POST',
        body: JSON.stringify({
          itemId: Number(selectedItemId),
          quantity: parseFloat(quantity),
          uom: selectedItemObj?.uom || 'unit',
          movementType,
          fromBranchId: currentBranchId,
          toBranchId: movementType === 'branch_to_branch' ? Number(toBranchId) : currentBranchId,
          fromDepartmentId: fromDeptId ? Number(fromDeptId) : null,
          toDepartmentId: movementType === 'branch_to_branch' ? null : toDeptId ? Number(toDeptId) : null,
          toLocationId: movementType === 'branch_to_branch' ? null : toLocationId ? Number(toLocationId) : null,
          toMachineId: movementType === 'branch_to_branch' ? null : toMachineId ? Number(toMachineId) : null,
          notes,
        }),
      });

      if (movementType === 'branch_to_branch') {
        showToast('Inter-branch transfer initiated! Destination manager notified for acceptance.', 'success');
      } else {
        showToast('Stock movement successfully recorded!', 'success');
      }

      setIsModalOpen(false);
      setNotes('');
      await loadMovements();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Transfer failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAcceptModal = (mov: Movement) => {
    setAcceptingMovement(mov);
    setAllocDeptId(departments[0]?.id || '');
    setAllocLocationId('');
    setAllocNotes('');
  };

  const handleConfirmAcceptTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptingMovement) return;

    try {
      setAllocSubmitting(true);
      await fetchApi(`/api/movements/${acceptingMovement.id}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          targetDepartmentId: allocDeptId ? Number(allocDeptId) : null,
          targetLocationId: allocLocationId ? Number(allocLocationId) : null,
          notes: allocNotes,
        }),
      });

      showToast('Transfer accepted and stock allocated successfully!', 'success');
      setAcceptingMovement(null);
      await loadMovements();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to accept transfer', 'error');
    } finally {
      setAllocSubmitting(false);
    }
  };

  const handleRejectTransfer = async (mov: Movement) => {
    const reason = window.prompt('Enter reason for rejecting this transfer (optional):');
    if (reason === null) return; // cancelled

    try {
      await fetchApi(`/api/movements/${mov.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      showToast('Transfer rejected and stock returned to origin branch.', 'info');
      await loadMovements();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject transfer', 'error');
    }
  };

  const handleDeleteMovement = async (mov: Movement) => {
    if (!window.confirm(`Are you sure you want to delete this movement record?`)) return;

    try {
      await fetchApi(`/api/movements/${mov.id}`, { method: 'DELETE' });
      showToast('Movement record removed', 'success');
      await loadMovements();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete movement record', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-extrabold text-slate-900">Stock Movements & Inter-Branch Transfers</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {movements.length} Logged Transfers
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Relocate assets or consumables between departments, dispatch to machines, or initiate cross-branch logistics transfers.
          </p>
        </div>

        <button
          id="btn-open-new-movement"
          onClick={() => {
            loadMovements();
            if (items.length > 0) {
              const firstItem = items[0];
              setSelectedItemId(firstItem.id);
              if (firstItem.itemType === 'asset') {
                setQuantity('1');
              }
            }
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Movement</span>
        </button>
      </div>

      {/* PENDING TRANSFERS NOTIFICATION CARD (FOR BRANCH MANAGERS) */}
      {pendingTransfers.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-300 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <span>Incoming Transfers Awaiting Manager Acceptance</span>
                  <span className="px-2 py-0.5 text-xs font-black bg-amber-500 text-white rounded-full">
                    {pendingTransfers.length} Action Needed
                  </span>
                </h3>
                <p className="text-xs text-amber-800">
                  Transfers sent from other branches require your approval. Accept to allocate into your branch departments & storage locations.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTransfers.map((pending) => (
              <div
                key={pending.id}
                className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Branch Transfer Pending
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-1">
                      {pending.item?.name || `Item #${pending.itemId}`}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">SKU: {pending.item?.code}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-amber-600 font-mono">{pending.quantity}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">{pending.uom}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">From Origin Branch:</span>
                    <span className="font-bold text-slate-800">
                      {pending.fromBranch?.name || `Branch #${pending.fromBranchId}`}
                    </span>
                  </div>
                  {pending.notes && (
                    <div className="text-[11px] text-slate-600 italic">
                      Note: "{pending.notes}"
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400">
                    Dispatched: {new Date(pending.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleRejectTransfer(pending)}
                    className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => handleOpenAcceptModal(pending)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept & Allocate</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Transfer & Movement Ledger</h3>
          <span className="text-xs text-slate-400">Chronological activity log</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Moved Qty</th>
                <th className="py-3 px-4">Movement Route</th>
                <th className="py-3 px-4">Type & Status</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading movement history...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ArrowLeftRight className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No movement records recorded yet.</p>
                  </td>
                </tr>
              ) : (
                movements.map((mov) => {
                  const isPending = mov.status === 'pending_acceptance';
                  const isRejected = mov.status === 'rejected';

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                        {new Date(mov.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              mov.item?.itemType === 'asset' ? 'bg-blue-500' : 'bg-emerald-500'
                            }`}
                          />
                          <div>
                            <p className="font-bold text-slate-900">{mov.item?.name || `Item #${mov.itemId}`}</p>
                            <p className="text-[10px] font-mono text-slate-400">{mov.item?.code}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-baseline gap-1 font-mono">
                          <span className="font-black text-blue-700 text-sm">{mov.quantity}</span>
                          <span className="font-bold text-slate-500 text-[10px] uppercase">{mov.uom}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-slate-700">
                            {mov.fromDepartment?.name || mov.fromBranch?.name || 'Central Store'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-blue-900">
                            {mov.toDepartment?.name || mov.toBranch?.name || 'Assigned Location'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {mov.movementType.replace(/_/g, ' ')}
                        </span>
                        <div>
                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Clock className="w-3 h-3" />
                              <span>Pending Acceptance</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          )}
                          {!isPending && !isRejected && mov.movementType === 'branch_to_branch' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Accepted & Completed</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-slate-600 italic truncate">{mov.notes || 'Routine transfer'}</p>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPending && mov.toBranchId === currentBranchId && (
                            <button
                              onClick={() => handleOpenAcceptModal(mov)}
                              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold cursor-pointer"
                              title="Accept Transfer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteMovement(mov)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="Delete Movement Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* MODAL: Accept & Allocate Transfer */}
      {acceptingMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Accept Transfer & Allocate Location</h3>
              </div>
              <button
                onClick={() => setAcceptingMovement(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Item:</span>
                <span className="font-bold text-slate-900">{acceptingMovement.item?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Incoming Quantity:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {acceptingMovement.quantity} {acceptingMovement.uom}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">From Branch:</span>
                <span className="font-bold text-slate-800">{acceptingMovement.fromBranch?.name}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmAcceptTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Allocate to Department <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={allocDeptId}
                  onChange={(e) => setAllocDeptId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">-- Choose Receiving Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Storage Location / Bin <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={allocLocationId}
                  onChange={(e) => setAllocLocationId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">-- General Storage --</option>
                  {currentBranchLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.parentLocationId ? '(Sublocation)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Receiving Remarks / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Received in good condition, stored on shelf B2."
                  value={allocNotes}
                  onChange={(e) => setAllocNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAcceptingMovement(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {allocSubmitting ? 'Accepting...' : 'Accept & Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Movement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Record Stock Transfer & Allocation</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordMovement} className="space-y-4">
              {/* Item picker */}
              <div>
                <SearchableItemSelect
                  items={items}
                  value={selectedItemId}
                  onChange={(val) => setSelectedItemId(val)}
                  label="Select Stock Item (Asset / Consumable)"
                  required
                  placeholder="Type SKU or item name to filter..."
                  id="stock-transfer-item-select"
                />
              </div>

              {/* Movement Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Movement Type</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMovementType('dept_to_dept')}
                    className={`py-2 px-3 rounded-lg font-bold border transition cursor-pointer ${
                      movementType === 'dept_to_dept'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Dept-to-Dept
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('branch_to_branch')}
                    className={`py-2 px-3 rounded-lg font-bold border transition cursor-pointer ${
                      movementType === 'branch_to_branch'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Branch-to-Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('assigned_to_machine')}
                    className={`py-2 px-3 rounded-lg font-bold border transition cursor-pointer ${
                      movementType === 'assigned_to_machine'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Assign to Machine
                  </button>
                </div>
              </div>

              {/* Quantity and Target Branch */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Transfer Quantity ({selectedItemObj?.uom || 'units'}) <span className="text-red-500">*</span>
                  </label>
                  {selectedItemObj?.itemType === 'asset' ? (
                    <div>
                      <input
                        type="number"
                        readOnly
                        value="1"
                        className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl bg-slate-100 text-slate-700 cursor-not-allowed"
                      />
                      <p className="text-[10px] text-blue-600 font-semibold mt-1">
                        Each asset has quantity as 1 only
                      </p>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        placeholder="e.g. 5"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Consumable stock quantity can be adjusted freely
                      </p>
                    </div>
                  )}
                </div>

                {movementType === 'branch_to_branch' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Destination Branch <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={toBranchId}
                      onChange={(e) => setToBranchId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {allBranches
                        .filter((b) => b.id !== currentBranchId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Source Department</label>
                    <select
                      value={fromDeptId}
                      onChange={(e) => setFromDeptId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">-- Central Store / General --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Notice for Branch-to-Branch */}
              {movementType === 'branch_to_branch' ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Manager Acceptance Workflow</span>
                  </div>
                  <p className="text-blue-800 text-[11px]">
                    Target department and storage location are not required now. The destination Manager will receive a notification to review and accept this item into their department and storage bins.
                  </p>
                </div>
              ) : (
                /* Department, Location and Machine Picker for Intra-Branch */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Department</label>
                    <select
                      value={toDeptId}
                      onChange={(e) => setToDeptId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">-- Direct Store / General --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {movementType === 'assigned_to_machine' ? 'Target Machine' : 'Target Machine (Optional)'}
                    </label>
                    <select
                      value={toMachineId}
                      onChange={(e) => setToMachineId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">-- Not Assigned to Machine --</option>
                      {targetMachines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.machineCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Purpose & Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Line balancing request, inter-branch requisition, or relocation."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Executing Transfer...' : 'Confirm Stock Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

