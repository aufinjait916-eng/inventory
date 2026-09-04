import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wrench,
  ShieldAlert,
  Package,
  Check,
  AlertCircle,
  HelpCircle,
  FileText,
  UserCheck,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { PMWorkOrder, PMChecklistTaskItem, PMChecklistResultItem, PMConsumedPart } from '../types.ts';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';

interface PMChecklistExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: PMWorkOrder | null;
  onSuccess: () => void;
  defaultEmployeePin?: string;
}

export const PMChecklistExecutionModal: React.FC<PMChecklistExecutionModalProps> = ({
  isOpen,
  onClose,
  workOrder,
  onSuccess,
  defaultEmployeePin,
}) => {
  const { currentUserName, showToast, inventoryItems = [] } = useApp() as any;

  const [checklistResults, setChecklistResults] = useState<PMChecklistResultItem[]>([]);
  const [partsConsumed, setPartsConsumed] = useState<PMConsumedPart[]>([]);
  const [deductFromStock, setDeductFromStock] = useState<boolean>(true);
  const [overallCondition, setOverallCondition] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'critical'>('good');
  const [summaryNotes, setSummaryNotes] = useState<string>('');
  const [timeSpentMinutes, setTimeSpentMinutes] = useState<number>(45);
  const [pin, setPin] = useState<string>(defaultEmployeePin || '');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Initialize checklist results and parts from work order or master plan
  useEffect(() => {
    if (workOrder) {
      const templateTasks: PMChecklistTaskItem[] = (workOrder.plan?.checklistTemplate as PMChecklistTaskItem[]) || [];
      const existingResults: PMChecklistResultItem[] = (workOrder.checklistResults as PMChecklistResultItem[]) || [];

      if (existingResults.length > 0) {
        setChecklistResults(existingResults);
      } else {
        const initialResults: PMChecklistResultItem[] = templateTasks.map((t) => ({
          taskId: t.id,
          task: t.task,
          type: t.type,
          status: 'pass',
          valueNum: t.minValue !== undefined ? t.minValue : undefined,
          notes: '',
        }));
        setChecklistResults(initialResults);
      }

      // Initialize parts consumed from template if not already present
      const templateParts = (workOrder.plan?.requiredPartsTemplate as any[]) || [];
      const existingParts: PMConsumedPart[] = (workOrder.partsConsumed as PMConsumedPart[]) || [];

      if (existingParts.length > 0) {
        setPartsConsumed(existingParts);
      } else {
        const initialParts: PMConsumedPart[] = templateParts.map((p) => ({
          itemId: p.itemId,
          itemName: p.itemName || 'Spare Part / Lubricant',
          quantity: p.quantity || 1,
          uom: p.uom || 'unit',
          deductedFromStock: true,
        }));
        setPartsConsumed(initialParts);
      }

      setOverallCondition(workOrder.overallCondition || 'good');
      setSummaryNotes(workOrder.summaryNotes || '');
      setTimeSpentMinutes(workOrder.timeSpentMinutes || workOrder.plan?.estimatedDurationMinutes || 45);
      if (defaultEmployeePin) {
        setPin(defaultEmployeePin);
      }
    }
  }, [workOrder, defaultEmployeePin]);

  if (!isOpen || !workOrder) return null;

  const handleTaskStatusChange = (taskId: string, status: 'pass' | 'fail' | 'na') => {
    setChecklistResults((prev) =>
      prev.map((item) => (item.taskId === taskId ? { ...item, status } : item))
    );
  };

  const handleTaskNumericChange = (taskId: string, valStr: string, min?: number, max?: number) => {
    const num = valStr === '' ? undefined : parseFloat(valStr);
    const isOut = num !== undefined && ((min !== undefined && num < min) || (max !== undefined && num > max));

    setChecklistResults((prev) =>
      prev.map((item) =>
        item.taskId === taskId
          ? {
              ...item,
              valueNum: num,
              status: isOut ? 'fail' : 'pass',
              isOutOfRange: isOut,
            }
          : item
      )
    );
  };

  const handleTaskNotesChange = (taskId: string, notes: string) => {
    setChecklistResults((prev) =>
      prev.map((item) => (item.taskId === taskId ? { ...item, notes } : item))
    );
  };

  const handlePartQtyChange = (index: number, qtyStr: string) => {
    const qty = Math.max(0, parseFloat(qtyStr) || 0);
    setPartsConsumed((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, quantity: qty } : p))
    );
  };

  const handleAddCustomPart = () => {
    setPartsConsumed((prev) => [
      ...prev,
      {
        itemName: '',
        quantity: 1,
        uom: 'unit',
        deductedFromStock: false,
      },
    ]);
  };

  const handleRemovePart = (index: number) => {
    setPartsConsumed((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if any mandatory item is uninspected
    const templateTasks = (workOrder.plan?.checklistTemplate as PMChecklistTaskItem[]) || [];
    for (const t of templateTasks) {
      if (t.isRequired) {
        const res = checklistResults.find((r) => r.taskId === t.id);
        if (t.type === 'numeric' && (res?.valueNum === undefined || isNaN(res.valueNum))) {
          showToast(`Task "${t.task}" requires a measured numeric value.`, 'error');
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const res = await fetchApi<{ error?: string }>(`/api/pm/work-orders/${workOrder.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          checklistResults,
          partsConsumed,
          deductFromStock,
          overallCondition,
          summaryNotes,
          timeSpentMinutes,
          completedByPin: pin.trim() || undefined,
          completedByName: currentUserName,
        }),
      });

      if (res && res.error) {
        showToast(res.error, 'error');
        return;
      }

      showToast(`Preventive maintenance logged successfully for ${workOrder.title}!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete PM checklist', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const templateTasks: PMChecklistTaskItem[] = (workOrder.plan?.checklistTemplate as PMChecklistTaskItem[]) || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  {workOrder.workOrderNumber}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-300">
                  Machine: <strong className="text-white">{workOrder.machine?.name || 'Machine'} ({workOrder.machine?.machineCode})</strong>
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight mt-0.5">
                {workOrder.title || workOrder.plan?.title || 'Preventive Maintenance Execution'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Warning Banner if present */}
        {workOrder.plan?.safetyNotes && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-3 text-amber-900 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">
              <strong>Mandatory Safety & LOTO:</strong> {workOrder.plan.safetyNotes}
            </span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-400 font-medium block">Branch & Dept</span>
              <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                {workOrder.branch?.name} / {workOrder.department?.name}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Scheduled Due Date</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {workOrder.dueDate}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Frequency / Plan</span>
              <span className="font-semibold text-slate-800 mt-0.5 block capitalize">
                {workOrder.plan?.frequencyType} ({workOrder.plan?.code})
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Est. Duration</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {workOrder.plan?.estimatedDurationMinutes || 60} mins
              </span>
            </div>
          </div>

          {/* Section 1: Checklist Tasks Evaluation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Step-by-Step Inspection Checklist ({templateTasks.length} Tasks)
              </h3>
              <span className="text-xs text-slate-400">All checks must be verified before sign-off</span>
            </div>

            <div className="space-y-3">
              {templateTasks.map((task, index) => {
                const currentResult = checklistResults.find((r) => r.taskId === task.id);
                const isPass = currentResult?.status === 'pass';
                const isFail = currentResult?.status === 'fail';
                const isOutOfRange = currentResult?.isOutOfRange;

                return (
                  <div
                    key={task.id || index}
                    className={`p-4 rounded-xl border transition-all ${
                      isFail
                        ? 'border-rose-300 bg-rose-50/40'
                        : isPass
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Task Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                            {task.order || index + 1}
                          </span>
                          <h4 className="text-xs font-bold text-slate-800">
                            {task.task}
                            {task.isRequired && <span className="text-rose-500 ml-1">*</span>}
                          </h4>
                        </div>
                        {task.instruction && (
                          <p className="text-xs text-slate-500 mt-1 ml-7 leading-relaxed">
                            {task.instruction}
                          </p>
                        )}
                        {task.type === 'numeric' && (
                          <div className="ml-7 mt-1.5 flex items-center gap-2 text-[11px] text-blue-600 font-medium">
                            <span>Acceptable Range:</span>
                            <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                              {task.minValue ?? '-∞'} – {task.maxValue ?? '+∞'} {task.unit}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Input Controls based on type */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0 ml-7 sm:ml-0">
                        {task.type === 'numeric' ? (
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <input
                                type="number"
                                step="any"
                                value={currentResult?.valueNum !== undefined ? currentResult.valueNum : ''}
                                onChange={(e) => handleTaskNumericChange(task.id, e.target.value, task.minValue, task.maxValue)}
                                placeholder="Measure"
                                className={`w-24 px-2.5 py-1.5 text-xs font-bold font-mono rounded-lg border focus:outline-none focus:ring-2 ${
                                  isOutOfRange
                                    ? 'border-rose-400 bg-rose-50 text-rose-800 focus:ring-rose-400'
                                    : 'border-slate-300 bg-white text-slate-800 focus:ring-blue-500'
                                }`}
                              />
                              {task.unit && (
                                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-semibold pointer-events-none">
                                  {task.unit}
                                </span>
                              )}
                            </div>
                            <div className="flex rounded-lg overflow-hidden border border-slate-300">
                              <button
                                type="button"
                                onClick={() => handleTaskStatusChange(task.id, 'pass')}
                                className={`px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                                  isPass && !isOutOfRange ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" /> Pass
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTaskStatusChange(task.id, 'fail')}
                                className={`px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                                  isFail || isOutOfRange ? 'bg-rose-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <X className="w-3.5 h-3.5" /> Fail
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                            <button
                              type="button"
                              onClick={() => handleTaskStatusChange(task.id, 'pass')}
                              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                                isPass ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" /> Pass / OK
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTaskStatusChange(task.id, 'fail')}
                              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                                isFail ? 'bg-rose-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" /> Needs Attention
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTaskStatusChange(task.id, 'na')}
                              className={`px-2 py-1.5 text-xs font-semibold cursor-pointer transition ${
                                currentResult?.status === 'na' ? 'bg-slate-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              N/A
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Task Note / Observation */}
                    <div className="mt-2.5 ml-7">
                      <input
                        type="text"
                        value={currentResult?.notes || ''}
                        onChange={(e) => handleTaskNotesChange(task.id, e.target.value)}
                        placeholder="Add specific measurement readings or technician observations (optional)..."
                        className="w-full text-xs px-3 py-1.5 bg-slate-50/80 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder-slate-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Consumed Spare Parts & Lubricants */}
          <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Spare Parts, Filters & Fluids Consumed
              </h3>
              <button
                type="button"
                onClick={handleAddCustomPart}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
              >
                + Add Extra Item
              </button>
            </div>

            {partsConsumed.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No consumable parts specified for this maintenance plan.</p>
            ) : (
              <div className="space-y-2.5">
                {partsConsumed.map((part, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={part.itemName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPartsConsumed((prev) =>
                            prev.map((p, i) => (i === pIdx ? { ...p, itemName: val } : p))
                          );
                        }}
                        placeholder="Part or Fluid Name (e.g. Slideway Oil, Filter Cartridge)"
                        className="w-full px-2 py-1 border border-slate-200 rounded font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-slate-500">Qty:</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={part.quantity}
                        onChange={(e) => handlePartQtyChange(pIdx, e.target.value)}
                        className="w-16 px-2 py-1 border border-slate-200 rounded font-bold font-mono text-slate-800 text-center focus:outline-none"
                      />
                      <span className="text-slate-500 uppercase font-semibold text-[10px] w-12 text-center">
                        {part.uom}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePart(pIdx)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {partsConsumed.length > 0 && (
              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-200/60">
                <input
                  type="checkbox"
                  id="chk-deduct-stock"
                  checked={deductFromStock}
                  onChange={(e) => setDeductFromStock(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-deduct-stock" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Automatically deduct consumed quantities from stock and record machine assignment log
                </label>
              </div>
            )}
          </div>

          {/* Section 3: Overall Condition & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Machine Overall Condition Health Assessment
              </label>
              <select
                value={overallCondition}
                onChange={(e: any) => setOverallCondition(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
              >
                <option value="excellent">🟢 Excellent - Like New Condition</option>
                <option value="good">🟢 Good - Operational, Normal Wear</option>
                <option value="fair">🟡 Fair - Requires Monitoring</option>
                <option value="poor">🟠 Poor - Requires Corrective Maintenance</option>
                <option value="critical">🔴 Critical - Machine Offline / Unsafe</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Actual Service Time Spent (Minutes)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min="1"
                  value={timeSpentMinutes}
                  onChange={(e) => setTimeSpentMinutes(parseInt(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Summary Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Service Summary, Corrective Actions & Recommendations
            </label>
            <textarea
              rows={3}
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              placeholder="Detail any observations, adjustments made, next inspection focus, or vendor recommendations..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
            />
          </div>

          {/* Section 5: Technician Sign-Off Verification (PIN or User Account) */}
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Technician Sign-Off: <span className="text-blue-700">{currentUserName}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Enter 4-digit employee PIN to verify shop floor identity (optional if logged in)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">PIN:</span>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4 Digits"
                className="w-24 px-2.5 py-1.5 text-center tracking-widest font-mono text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              id="btn-submit-pm-completion"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm hover:shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? 'Submitting Log...' : 'Sign Off & Complete PM Checklist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
