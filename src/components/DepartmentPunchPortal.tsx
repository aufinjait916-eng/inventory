import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Package,
  Boxes,
  Send,
  UserCheck,
  Building,
  RotateCcw,
  Sparkles,
  Wrench,
  Calendar,
  Clock,
  ClipboardCheck,
  AlertTriangle,
  Play,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { SearchableItemSelect } from './SearchableItemSelect.tsx';
import {
  Employee,
  InventoryItem,
  Machine,
  RequestReason,
  EmployeeRequest,
  PMWorkOrder,
} from '../types.ts';
import { PMChecklistExecutionModal } from './PMChecklistExecutionModal.tsx';

export const DepartmentPunchPortal: React.FC = () => {
  const { currentBranchId, currentDepartmentId, branches, departments, showToast } = useApp();

  // Active kiosk view tab (Requisitions vs PM Checklists)
  const [kioskTab, setKioskTab] = useState<'requisition' | 'pm_checklists'>('requisition');

  // Step 1: 4-digit PIN punch verification
  const [pin, setPin] = useState<string>('');
  const [verifiedEmployee, setVerifiedEmployee] = useState<Employee | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);

  // Step 2: Request creation form
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [reasons, setReasons] = useState<RequestReason[]>([]);
  const [recentRequests, setRecentRequests] = useState<EmployeeRequest[]>([]);

  // PM Work Orders assigned to this Department
  const [pmWorkOrders, setPmWorkOrders] = useState<PMWorkOrder[]>([]);
  const [selectedWOForExecution, setSelectedWOForExecution] = useState<PMWorkOrder | null>(null);
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState<boolean>(false);

  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [requestedQty, setRequestedQty] = useState<string>('1');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>(currentDepartmentId || '');
  const [selectedReasonId, setSelectedReasonId] = useState<number | ''>('');
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<number | ''>('');
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<EmployeeRequest | null>(null);

  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const currentDept = departments.find((d) => d.id === (selectedDepartmentId || currentDepartmentId));

  // Load department stock items, machines, pre-fed reasons, and PM work orders
  const loadKioskData = async () => {
    try {
      const [invData, mchData, rsnData, reqData, pmData] = await Promise.all([
        fetchApi<InventoryItem[]>(`/api/inventory?branchId=${currentBranchId}`),
        fetchApi<Machine[]>(`/api/machines?branchId=${currentBranchId}`),
        fetchApi<RequestReason[]>('/api/reasons'),
        fetchApi<EmployeeRequest[]>(`/api/requests?branchId=${currentBranchId}&departmentId=${currentDepartmentId}`),
        fetchApi<PMWorkOrder[]>(`/api/pm/work-orders?branchId=${currentBranchId}&departmentId=${currentDepartmentId}`),
      ]);

      setItems(invData || []);
      setMachines(mchData || []);
      setReasons(rsnData || []);
      setRecentRequests(reqData || []);
      setPmWorkOrders(pmData || []);
    } catch (err) {
      console.error('Failed to load department kiosk data:', err);
    }
  };

  useEffect(() => {
    loadKioskData();
  }, [currentBranchId, currentDepartmentId]);

  // Handle PIN button press
  const handlePinInput = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  const handlePinReset = () => {
    setPin('');
    setPinError(null);
    setVerifiedEmployee(null);
    setSubmittedSuccess(null);
  };

  // Verify PIN with backend /api/employees/verify-pin
  const verifyPin = async (enteredPin: string) => {
    try {
      setVerifying(true);
      setPinError(null);
      const res = await fetchApi<{ employee: Employee }>('/api/employees/verify-pin', {
        method: 'POST',
        body: JSON.stringify({
          branchId: currentBranchId,
          userCode: enteredPin,
        }),
      });

      if (res.employee) {
        setVerifiedEmployee(res.employee);
        if (res.employee.departments && res.employee.departments.length > 0) {
          const empFirstDeptId = res.employee.departments[0].departmentId;
          setSelectedDepartmentId(empFirstDeptId || currentDepartmentId || '');
        } else if (currentDepartmentId) {
          setSelectedDepartmentId(currentDepartmentId);
        }
        showToast(`Authenticated: ${res.employee.name} (${res.employee.employeeCode})`, 'success');
      } else {
        setPinError('Invalid 4-digit PIN. Contact your supervisor.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Invalid 4-digit code. Check PIN.');
    } finally {
      setVerifying(false);
    }
  };

  // Submit requisition request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedEmployee) return;

    if (!selectedItemId || !requestedQty) {
      showToast('Please select a stock item and specify quantity', 'error');
      return;
    }

    const selectedReasonObj = reasons.find((r) => r.id === selectedReasonId);
    const finalReasonText = customReasonText.trim() || selectedReasonObj?.reason || 'Standard operational task';

    try {
      setSubmittingRequest(true);
      const newReq = await fetchApi<EmployeeRequest>('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: verifiedEmployee.id,
          branchId: currentBranchId,
          departmentId: selectedDepartmentId ? Number(selectedDepartmentId) : (currentDepartmentId || null),
          itemId: Number(selectedItemId),
          requestedQty: parseFloat(requestedQty),
          reasonId: selectedReasonId ? Number(selectedReasonId) : null,
          reasonText: finalReasonText,
          machineId: selectedMachineId ? Number(selectedMachineId) : null,
        }),
      });

      setSubmittedSuccess(newReq);
      showToast(`Request ${newReq.requestId} submitted for manager review!`, 'success');
      await loadKioskData();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit request', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const selectedItemObj = items.find((i) => i.id === selectedItemId);

  // Active PM items for this employee & dept
  const pendingPMs = pmWorkOrders.filter((wo) => wo.status !== 'completed' && wo.status !== 'skipped');
  const completedPMs = pmWorkOrders.filter((wo) => wo.status === 'completed');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Kiosk Header */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-xl shadow-md shadow-blue-500/30">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>4-Digit PIN Verified Kiosk</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">Shop Floor Operator Kiosk</h2>
            <p className="text-xs text-slate-400">
              {currentBranch?.name || 'Central Plant'} • {currentDept?.name || 'Assembly Department'}
            </p>
          </div>
        </div>

        {verifiedEmployee ? (
          <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              {verifiedEmployee.name[0]}
            </div>
            <div className="text-left text-xs">
              <p className="font-bold text-white leading-tight">{verifiedEmployee.name}</p>
              <p className="text-slate-400 font-mono">{verifiedEmployee.employeeCode}</p>
            </div>
            <button
              onClick={handlePinReset}
              className="ml-2 p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
              title="Logout / Reset Punch"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Enter your 4-digit assigned PIN to access tasks</span>
        )}
      </div>

      {/* Main Kiosk Area */}
      {!verifiedEmployee ? (
        /* STEP 1: PIN Pad Screen */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 max-w-md mx-auto text-center space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Employee PIN Punch</h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter your assigned 4-digit code provided by your Manager
            </p>
            <div className="mt-2 text-[11px] bg-slate-100 text-slate-600 p-2 rounded-lg inline-block">
              Demo PINs: <span className="font-mono font-bold text-blue-700">1234</span> (John Doe) or{' '}
              <span className="font-mono font-bold text-blue-700">5678</span> (Sarah Jenkins)
            </div>
          </div>

          {/* PIN Display Circles */}
          <div className="flex justify-center items-center gap-3">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold font-mono transition-all ${
                    isFilled
                      ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm scale-105'
                      : 'border-slate-300 bg-slate-50 text-transparent'
                  }`}
                >
                  {isFilled ? '•' : ''}
                </div>
              );
            })}
          </div>

          {pinError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center justify-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4" />
              <span>{pinError}</span>
            </div>
          )}

          {/* Numerical Numpad Grid */}
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinInput(num)}
                className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-blue-600 active:text-white text-slate-800 text-lg font-bold font-mono transition shadow-xs cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handlePinReset}
              className="h-14 rounded-xl bg-slate-100 hover:bg-red-50 text-red-600 text-xs font-bold transition flex items-center justify-center cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handlePinInput('0')}
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-blue-600 active:text-white text-slate-800 text-lg font-bold font-mono transition shadow-xs cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinBackspace}
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center cursor-pointer"
            >
              ⌫ Back
            </button>
          </div>
        </div>
      ) : (
        /* STEP 2: Authenticated Employee Hub */
        <div className="space-y-6">
          {/* Kiosk Mode Switcher (Material Requisition vs PM Checklists) */}
          <div className="flex bg-slate-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setKioskTab('requisition')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                kioskTab === 'requisition'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4 text-blue-600" />
              1. Material Requisition Request
            </button>

            <button
              type="button"
              onClick={() => setKioskTab('pm_checklists')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                kioskTab === 'pm_checklists'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-4 h-4 text-blue-600" />
              2. Preventive Maintenance Checklists
              {pendingPMs.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {pendingPMs.length} Due
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: Material Requisition Form */}
          {kioskTab === 'requisition' && (
            <>
              {submittedSuccess ? (
                /* SUCCESS CONFIRMATION SCREEN */
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-md p-8 text-center space-y-5">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Requisition Request Logged!</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Your request has been dispatched to the Manager queue for issuance verification.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs max-w-md mx-auto space-y-2 text-left">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Request ID:</span>
                      <span className="font-mono font-bold text-blue-700">{submittedSuccess.requestId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Employee:</span>
                      <span className="font-bold text-slate-800">{verifiedEmployee.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Item Requested:</span>
                      <span className="font-bold text-slate-800">
                        {submittedSuccess.requestedQty} {submittedSuccess.uom} of {selectedItemObj?.name || 'Stock'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reason:</span>
                      <span className="text-slate-700 italic">"{submittedSuccess.reasonText}"</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setSubmittedSuccess(null)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer"
                    >
                      Submit Another Request
                    </button>
                    <button
                      onClick={handlePinReset}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Finish & Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                /* Stock Request Form */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Place Requisition Request</h3>
                      <p className="text-xs text-slate-500">Select material, quantity, machine and operational purpose</p>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                      Logged in: {verifiedEmployee.name}
                    </span>
                  </div>

                  <form onSubmit={handleSubmitRequest} className="space-y-5">
                    {/* Item Selection (Searchable without quantity) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Select Consumable / Tool / Asset <span className="text-red-500">*</span>
                      </label>
                      <SearchableItemSelect
                        items={items}
                        value={selectedItemId}
                        onChange={(val) => setSelectedItemId(val)}
                        placeholder="Type or search item name, code, model..."
                        hideQuantity={true}
                        required
                      />
                    </div>

                    {/* Department Context & Quantity & Machine Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Requested Quantity ({selectedItemObj?.uom || 'units'}) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          required
                          value={requestedQty}
                          onChange={(e) => setRequestedQty(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Target Machine {currentDept ? `(${currentDept.name})` : '(Optional)'}
                        </label>
                        <select
                          value={selectedMachineId}
                          onChange={(e) => setSelectedMachineId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">-- Direct Department Activity / None --</option>
                          {machines
                            .filter((m) => !currentDepartmentId || m.departmentId === Number(currentDepartmentId))
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.machineCode})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Reason Selection */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-700">
                        Reason for Request <span className="text-red-500">*</span>
                      </label>

                      <select
                        value={selectedReasonId}
                        onChange={(e) => setSelectedReasonId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">-- Pre-fed Requisition Purpose --</option>
                        {reasons.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.reason}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="Or specify custom operational note / job order ID..."
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>

                    {/* Submit & Reset Button */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handlePinReset}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel / Sign Out
                      </button>

                      <button
                        type="submit"
                        disabled={submittingRequest}
                        id="btn-submit-employee-request"
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>{submittingRequest ? 'Logging Request...' : 'Dispatch Request to Manager'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {/* TAB 2: Preventive Maintenance Checklists */}
          {kioskTab === 'pm_checklists' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-blue-600" />
                      Assigned Department Maintenance Tasks
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Open active machine servicing checklists, log measured tolerances, and submit maintenance completion
                    </p>
                  </div>
                  <button
                    onClick={loadKioskData}
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    title="Refresh Task Queue"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {pendingPMs.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-slate-800 font-bold text-sm">All Preventive Maintenance is Up-to-Date!</p>
                    <p className="text-slate-400 text-xs mt-1">No pending maintenance checklists due for your department.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingPMs.map((wo) => {
                      const isOverdue = wo.isOverdue;
                      return (
                        <div
                          key={wo.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isOverdue
                              ? 'border-rose-300 bg-rose-50/30'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-mono text-[11px] font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                                  {wo.workOrderNumber}
                                </span>
                                {isOverdue ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                                    OVERDUE
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                    {wo.status.replace('_', ' ')}
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">• {wo.plan?.category}</span>
                              </div>

                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {wo.title}
                              </h4>

                              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 flex-wrap">
                                <span className="font-semibold text-slate-700">
                                  Machine: {wo.machine?.name} ({wo.machine?.machineCode})
                                </span>
                                <span>
                                  Due: <strong className={isOverdue ? 'text-rose-600' : 'text-slate-800'}>{wo.dueDate}</strong>
                                </span>
                                <span>Est: ~{wo.plan?.estimatedDurationMinutes || 45} mins</span>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedWOForExecution(wo);
                                setIsExecutionModalOpen(true);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
                            >
                              <ClipboardCheck className="w-4 h-4" />
                              Open Checklist
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Completed Today in this department */}
              {completedPMs.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Recently Completed Checklists ({completedPMs.length})
                  </h4>
                  <div className="space-y-2">
                    {completedPMs.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs">
                        <div>
                          <span className="font-bold text-slate-900">{c.title}</span>
                          <span className="text-slate-500 block text-[11px]">
                            Machine: {c.machine?.name} • Signed by: {c.completedByName} on {c.completedAt ? new Date(c.completedAt).toLocaleDateString() : 'Today'}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                          Condition: {c.overallCondition || 'Good'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History table for requisitions */}
      {verifiedEmployee && kioskTab === 'requisition' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Department Requisitions History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Req ID</th>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Item & Qty</th>
                  <th className="py-2.5 px-3">Purpose</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      No requests submitted in this department yet.
                    </td>
                  </tr>
                ) : (
                  recentRequests.slice(0, 5).map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{req.requestId}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{req.employee?.name}</td>
                      <td className="py-2.5 px-3">
                        {req.requestedQty} {req.uom} • {req.item?.name}
                      </td>
                      <td className="py-2.5 px-3 italic text-slate-500">{req.reasonText}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'issued'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execution Modal for Shop Floor Technician */}
      <PMChecklistExecutionModal
        isOpen={isExecutionModalOpen}
        onClose={() => {
          setIsExecutionModalOpen(false);
          setSelectedWOForExecution(null);
        }}
        workOrder={selectedWOForExecution}
        defaultEmployeePin={pin}
        onSuccess={loadKioskData}
      />
    </div>
  );
};
