import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  User,
  Building,
  Wrench,
  Search,
  Filter,
  Sparkles,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { EmployeeRequest, Department, Machine, InventoryItem } from '../types.ts';

export const RequestManagement: React.FC = () => {
  const { currentRole, currentBranchId, branches, showToast, refreshAll } = useApp();
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'issued' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');

  // Selected request for action modal (Issue / Reject)
  const [selectedReq, setSelectedReq] = useState<EmployeeRequest | null>(null);
  const [actionType, setActionType] = useState<'issue' | 'reject'>('issue');
  const [managerNotes, setManagerNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Edit Request Modal
  const [editingReq, setEditingReq] = useState<EmployeeRequest | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editReasonText, setEditReasonText] = useState('');
  const [editManagerNotes, setEditManagerNotes] = useState('');
  const [editDeptId, setEditDeptId] = useState<number | ''>('');
  const [editMachineId, setEditMachineId] = useState<number | ''>('');

  // Delete Request Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    req: EmployeeRequest | null;
  }>({
    isOpen: false,
    req: null,
  });

  const currentBranch = branches.find((b) => b.id === currentBranchId);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (currentBranchId) queryParams.set('branchId', currentBranchId.toString());
      if (statusFilter !== 'all') queryParams.set('status', statusFilter);

      const [reqData, deptData, machData] = await Promise.all([
        fetchApi<EmployeeRequest[]>(`/api/requests?${queryParams.toString()}`),
        fetchApi<Department[]>(`/api/departments?branchId=${currentBranchId}`),
        fetchApi<Machine[]>(`/api/machines?branchId=${currentBranchId}`),
      ]);

      setRequests(reqData || []);
      setDepartments(deptData || []);
      setMachines(machData || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
      showToast('Failed to load requisitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [currentBranchId, statusFilter]);

  const handleOpenAction = (req: EmployeeRequest, type: 'issue' | 'reject') => {
    setSelectedReq(req);
    setActionType(type);
    setManagerNotes('');
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    try {
      setProcessing(true);
      const newStatus = actionType === 'issue' ? 'issued' : 'rejected';

      await fetchApi(`/api/requests/${selectedReq.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          managerNotes,
        }),
      });

      showToast(
        `Request ${selectedReq.requestId} marked as ${newStatus.toUpperCase()}${
          actionType === 'issue' ? ' and stock deducted' : ''
        }!`,
        'success'
      );
      setSelectedReq(null);
      await loadRequests();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to process request action', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenEdit = (req: EmployeeRequest) => {
    setEditingReq(req);
    setEditQty(req.requestedQty.toString());
    setEditReasonText(req.reasonText || '');
    setEditManagerNotes(req.managerNotes || '');
    setEditDeptId(req.departmentId || '');
    setEditMachineId(req.machineId || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq) return;

    try {
      setProcessing(true);
      await fetchApi(`/api/requests/${editingReq.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          requestedQty: Number(editQty) || 1,
          reasonText: editReasonText,
          managerNotes: editManagerNotes,
          departmentId: editDeptId ? Number(editDeptId) : null,
          machineId: editMachineId ? Number(editMachineId) : null,
        }),
      });

      showToast(`Request #${editingReq.requestId} updated successfully!`, 'success');
      setEditingReq(null);
      await loadRequests();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to update request', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteModal.req) return;

    try {
      setProcessing(true);
      await fetchApi(`/api/requests/${deleteModal.req.id}`, { method: 'DELETE' });
      showToast(`Request #${deleteModal.req.requestId} deleted successfully.`, 'success');
      setDeleteModal({ isOpen: false, req: null });
      await loadRequests();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete requisition', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const filtered = requests.filter((r) => {
    if (
      search &&
      !r.requestId.toLowerCase().includes(search.toLowerCase()) &&
      !r.employee?.name.toLowerCase().includes(search.toLowerCase()) &&
      !r.item?.name.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-extrabold text-slate-900">Requisitions & Issue Queue</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {filtered.length} Requests
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verify employee PIN punch requests, review inventory availability, edit details, and authorize stock issuance.
          </p>
        </div>

        {/* Filter by status */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending Verification
          </button>
          <button
            onClick={() => setStatusFilter('issued')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'issued'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Issued / Fulfilled
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rejected
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Logs
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Req #</th>
                <th className="py-3 px-4">Employee (Usercode Verified)</th>
                <th className="py-3 px-4">Department & Machine</th>
                <th className="py-3 px-4">Material / Item</th>
                <th className="py-3 px-4">Requested Qty</th>
                <th className="py-3 px-4">Purpose / Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading requisition queue...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No requests found in this queue.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {req.requestId}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          {req.employee?.name?.[0] || 'E'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{req.employee?.name || 'Employee'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            PIN: {req.employee?.userCode ? '••••' : 'Verified'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{req.department?.name || 'Dept'}</p>
                      {req.machine ? (
                        <p className="text-[11px] text-indigo-600 font-medium">
                          Machine: {req.machine.name} ({req.machine.machineCode})
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">General Floor</p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{req.item?.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{req.item?.code}</p>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-sm font-black text-slate-900">{req.requestedQty}</span>
                        <span className="font-bold text-slate-500 uppercase text-[10px]">{req.uom}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Branch Stock: {req.item?.availableQuantity ?? '—'} {req.uom}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-700 italic truncate">"{req.reasonText}"</p>
                      {req.managerNotes && (
                        <p className="text-[10px] text-blue-600 font-semibold mt-0.5">
                          Manager: {req.managerNotes}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'issued'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : req.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                        }`}
                      >
                        {req.status === 'issued' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : req.status === 'rejected' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {req.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {req.status === 'pending' && (
                          <>
                            <button
                              id={`btn-issue-req-${req.id}`}
                              onClick={() => handleOpenAction(req, 'issue')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
                              title="Issue Stock"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Issue</span>
                            </button>
                            <button
                              id={`btn-reject-req-${req.id}`}
                              onClick={() => handleOpenAction(req, 'reject')}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition border border-rose-200 cursor-pointer"
                              title="Reject Request"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {(currentRole === 'admin' || currentRole === 'super_manager' || currentRole === 'manager') && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(req)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit Requisition Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, req })}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Delete Requisition Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Request Modal */}
      {editingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Requisition #{editingReq.requestId}</h3>
              </div>
              <button
                onClick={() => setEditingReq(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Requested Material / Item</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800">
                  {editingReq.item?.name} ({editingReq.item?.code})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Requested Quantity ({editingReq.uom})</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={editDeptId}
                    onChange={(e) => setEditDeptId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- No Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Machine</label>
                <select
                  value={editMachineId}
                  onChange={(e) => setEditMachineId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- General / No Machine --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.machineCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Operational Purpose</label>
                <input
                  type="text"
                  value={editReasonText}
                  onChange={(e) => setEditReasonText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Manager Issuance Remark</label>
                <input
                  type="text"
                  placeholder="Notes for audit record..."
                  value={editManagerNotes}
                  onChange={(e) => setEditManagerNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReq(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Request Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.req && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Requisition Record?</h3>
              <p className="text-xs text-slate-500 mt-1.5">
                Are you sure you want to permanently delete requisition <span className="font-bold text-slate-800">#{deleteModal.req.requestId}</span>?
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, req: null })}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRequest}
                disabled={processing}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue / Reject Action Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {actionType === 'issue' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <h3 className="text-base font-bold text-slate-900">
                  {actionType === 'issue' ? 'Authorize Stock Issuance' : 'Reject Requisition'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Request ID:</span>
                <span className="font-bold font-mono text-slate-800">{selectedReq.requestId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-slate-800">{selectedReq.employee?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Item & Quantity:</span>
                <span className="font-bold text-slate-900">
                  {selectedReq.requestedQty} {selectedReq.uom} • {selectedReq.item?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Available in Branch:</span>
                <span
                  className={`font-bold font-mono ${
                    (selectedReq.item?.availableQuantity || 0) < selectedReq.requestedQty
                      ? 'text-rose-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {selectedReq.item?.availableQuantity ?? 0} {selectedReq.uom}
                </span>
              </div>
            </div>

            {(selectedReq.item?.availableQuantity || 0) < selectedReq.requestedQty && actionType === 'issue' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Warning: Requested quantity ({selectedReq.requestedQty}) exceeds currently available stock (
                  {selectedReq.item?.availableQuantity}).
                </span>
              </div>
            )}

            <form onSubmit={handleConfirmAction} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Manager Notes / Issuance Remark
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    actionType === 'issue'
                      ? 'e.g. Handed over at stockroom counter. Logged for Job Order 440.'
                      : 'e.g. Insufficient floor stock. Alternative brand offered or awaiting restocking.'
                  }
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer ${
                    actionType === 'issue'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {processing
                    ? 'Processing...'
                    : actionType === 'issue'
                    ? 'Confirm & Deduct Stock'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
