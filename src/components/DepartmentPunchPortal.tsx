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
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import {
  Employee,
  InventoryItem,
  Machine,
  RequestReason,
  EmployeeRequest,
} from '../types.ts';

export const DepartmentPunchPortal: React.FC = () => {
  const { currentBranchId, currentDepartmentId, branches, departments, showToast } = useApp();

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

  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [requestedQty, setRequestedQty] = useState<string>('1');
  const [selectedReasonId, setSelectedReasonId] = useState<number | ''>('');
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<number | ''>('');
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<EmployeeRequest | null>(null);

  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const currentDept = departments.find((d) => d.id === currentDepartmentId);

  // Load department stock items, machines, and pre-fed reasons
  const loadKioskData = async () => {
    try {
      const [invData, mchData, rsnData, reqData] = await Promise.all([
        fetchApi<InventoryItem[]>(`/api/inventory?branchId=${currentBranchId}`),
        fetchApi<Machine[]>(`/api/machines?branchId=${currentBranchId}`),
        fetchApi<RequestReason[]>('/api/reasons'),
        fetchApi<EmployeeRequest[]>(`/api/requests?branchId=${currentBranchId}&departmentId=${currentDepartmentId}`),
      ]);

      setItems(invData || []);
      setMachines(mchData || []);
      setReasons(rsnData || []);
      setRecentRequests(reqData || []);
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
        showToast(`Authenticated: ${res.employee.name} (${res.employee.employeeCode})`, 'success');
      } else {
        setPinError('Invalid 4-digit usercode. Contact your manager.');
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
          departmentId: currentDepartmentId,
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
            <h2 className="text-xl font-bold tracking-tight">Department Requisition Portal</h2>
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
              className="ml-2 p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title="Logout / Reset Punch"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Enter your 4-digit assigned PIN to request materials</span>
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
                className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-blue-600 active:text-white text-slate-800 text-lg font-bold font-mono transition shadow-xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handlePinReset}
              className="h-14 rounded-xl bg-slate-100 hover:bg-red-50 text-red-600 text-xs font-bold transition flex items-center justify-center"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handlePinInput('0')}
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-blue-600 active:text-white text-slate-800 text-lg font-bold font-mono transition shadow-xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinBackspace}
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center"
            >
              ⌫ Back
            </button>
          </div>
        </div>
      ) : submittedSuccess ? (
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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"
            >
              Submit Another Request
            </button>
            <button
              onClick={handlePinReset}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Finish & Sign Out
            </button>
          </div>
        </div>
      ) : (
        /* STEP 2: Stock Request Form */
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
            {/* Item Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Consumable / Tool / Asset <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value ? Number(e.target.value) : '');
                }}
                className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Choose Stock Item --</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    [{i.code}] {i.name} ({i.availableQuantity} {i.uom} available in branch)
                  </option>
                ))}
              </select>
            </div>

            {/* Selected item stock preview info */}
            {selectedItemObj && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{selectedItemObj.name}</p>
                  <p className="text-[11px] text-slate-500">
                    Category: {selectedItemObj.category?.name || 'Standard'} • UOM:{' '}
                    <span className="uppercase font-bold text-blue-600">{selectedItemObj.uom}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-emerald-700">
                    {selectedItemObj.availableQuantity} {selectedItemObj.uom}
                  </span>
                  <span className="block text-[10px] text-slate-400">Available Stock</span>
                </div>
              </div>
            )}

            {/* Quantity and Machine Grid */}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Machine (Optional)</label>
                <select
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Direct Department Activity / None --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.machineCode}) - {m.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reason Selection (Pre-fed dropdown + Custom textbox) */}
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
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancel / Sign Out
              </button>

              <button
                type="submit"
                disabled={submittingRequest}
                id="btn-submit-employee-request"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{submittingRequest ? 'Logging Request...' : 'Dispatch Request to Manager'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent requests by department */}
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
    </div>
  );
};
