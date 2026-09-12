import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Building,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Phone,
  Mail,
  User,
  Boxes,
  Edit2,
  ShieldCheck,
  Eye,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { SearchableItemSelect } from './SearchableItemSelect.tsx';
import { VendorAssignmentsManager } from './VendorAssignmentsManager.tsx';
import { Vendor, VendorRepair, InventoryItem, Branch } from '../types.ts';

interface VendorsRepairsViewProps {
  initialRepairItem?: InventoryItem | null;
}

export const VendorsRepairsView: React.FC<VendorsRepairsViewProps> = ({ initialRepairItem }) => {
  const { currentRole, currentBranchId, branches, showToast, refreshAll } = useApp();

  const [activeTab, setActiveTab] = useState<'repairs' | 'vendors' | 'assignments'>('repairs');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [repairs, setRepairs] = useState<VendorRepair[]>([]);
  const [assetItems, setAssetItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [isSendRepairOpen, setIsSendRepairOpen] = useState(!!initialRepairItem);
  const [editingRepair, setEditingRepair] = useState<VendorRepair | null>(null);
  const [selectedReturnRepair, setSelectedReturnRepair] = useState<VendorRepair | null>(null);

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: async () => {},
  });

  // Vendor form
  const [vendorName, setVendorName] = useState('');
  const [vendorBranchId, setVendorBranchId] = useState<number | ''>(currentBranchId);
  const [contactPerson, setContactPerson] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [serviceType, setServiceType] = useState<'supplier' | 'repair' | 'supplier_and_repair'>('supplier_and_repair');
  const [assignedBranchIds, setAssignedBranchIds] = useState<number[]>([]);

  // Repair dispatch / edit form
  const [repairItemId, setRepairItemId] = useState<number | ''>(initialRepairItem?.id || '');
  const [repairVendorId, setRepairVendorId] = useState<number | ''>('');
  const [issueDescription, setIssueDescription] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [repairCost, setRepairCost] = useState('0');
  const [repairStatus, setRepairStatus] = useState<string>('sent_to_vendor');

  // Return / Resolution form
  const [returnStatus, setReturnStatus] = useState<'repaired' | 'unrepairable_trashed'>('repaired');
  const [finalCost, setFinalCost] = useState('0');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vData, rData, invData] = await Promise.all([
        fetchApi<Vendor[]>('/api/vendors'),
        fetchApi<VendorRepair[]>(`/api/repairs?branchId=${currentBranchId}`),
        fetchApi<InventoryItem[]>(`/api/inventory?branchId=${currentBranchId}&type=asset`),
      ]);

      setVendors(vData || []);
      setRepairs(rData || []);
      setAssetItems(invData || []);
    } catch (err) {
      console.error('Failed to load vendors/repairs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranchId]);

  // Vendor Actions
  const handleOpenAddVendor = () => {
    setEditingVendor(null);
    setVendorName('');
    setVendorBranchId(currentBranchId);
    setContactPerson('');
    setVendorEmail('');
    setVendorPhone('');
    setVendorAddress('');
    setServiceType('supplier_and_repair');
    setAssignedBranchIds([]);
    setIsAddVendorOpen(true);
  };

  const handleOpenEditVendor = (v: Vendor) => {
    setEditingVendor(v);
    setVendorName(v.name);
    setVendorBranchId(v.branchId || currentBranchId);
    setContactPerson(v.contactPerson || '');
    setVendorEmail(v.email || '');
    setVendorPhone(v.phone || '');
    setVendorAddress(v.address || '');
    setServiceType((v.serviceType as any) || 'supplier_and_repair');
    setAssignedBranchIds(v.assignedBranchIds || []);
    setIsAddVendorOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName) return;

    try {
      setSubmitting(true);
      if (editingVendor) {
        await fetchApi(`/api/vendors/${editingVendor.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            branchId: vendorBranchId || null,
            name: vendorName,
            contactPerson,
            email: vendorEmail,
            phone: vendorPhone,
            address: vendorAddress,
            serviceType,
            assignedBranchIds,
          }),
        });
        showToast(`Vendor "${vendorName}" updated successfully!`, 'success');
      } else {
        await fetchApi('/api/vendors', {
          method: 'POST',
          body: JSON.stringify({
            branchId: vendorBranchId || currentBranchId,
            name: vendorName,
            contactPerson,
            email: vendorEmail,
            phone: vendorPhone,
            address: vendorAddress,
            serviceType,
            assignedBranchIds,
          }),
        });
        showToast(`Vendor "${vendorName}" registered successfully!`, 'success');
      }

      setIsAddVendorOpen(false);
      await loadData();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to save vendor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVendor = (v: Vendor) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Vendor',
      description: `Are you sure you want to delete vendor "${v.name}"?`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/vendors/${v.id}`, { method: 'DELETE' });
          showToast(`Vendor "${v.name}" deleted.`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
          refreshAll();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete vendor', 'error');
        }
      },
    });
  };

  // Repair Actions
  const handleOpenDispatch = () => {
    setEditingRepair(null);
    setRepairItemId(assetItems[0]?.id || '');
    setRepairVendorId(vendors[0]?.id || '');
    setIssueDescription('');
    setExpectedReturnDate('');
    setRepairCost('0');
    setRepairStatus('sent_to_vendor');
    setIsSendRepairOpen(true);
  };

  const handleOpenEditRepair = (rep: VendorRepair) => {
    setEditingRepair(rep);
    setRepairItemId(rep.itemId);
    setRepairVendorId(rep.vendorId);
    setIssueDescription(rep.issueDescription);
    setExpectedReturnDate(rep.expectedReturnDate ? rep.expectedReturnDate.split('T')[0] : '');
    setRepairCost(rep.repairCost.toString());
    setRepairStatus(rep.status);
    setIsSendRepairOpen(true);
  };

  const handleSaveRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairItemId || !repairVendorId || !issueDescription) {
      showToast('Please select the item, vendor, and describe the issue.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (editingRepair) {
        await fetchApi(`/api/repairs/${editingRepair.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            vendorId: Number(repairVendorId),
            issueDescription,
            expectedReturnDate: expectedReturnDate || null,
            repairCost: parseFloat(repairCost) || 0,
            status: repairStatus,
          }),
        });
        showToast(`Repair record #${editingRepair.id} updated!`, 'success');
      } else {
        const result = await fetchApi<VendorRepair>('/api/repairs', {
          method: 'POST',
          body: JSON.stringify({
            itemId: Number(repairItemId),
            vendorId: Number(repairVendorId),
            branchId: currentBranchId,
            issueDescription,
            expectedReturnDate: expectedReturnDate || null,
            repairCost: parseFloat(repairCost) || 0,
          }),
        });

        const hoursEngaged = Math.floor((result.engagedDurationMinutes || 0) / 60);
        showToast(
          `Asset sent to vendor! Active engagement time calculated: ${hoursEngaged} hours.`,
          'success'
        );
      }

      setIsSendRepairOpen(false);
      await loadData();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRepair = (rep: VendorRepair) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Repair Record',
      description: `Delete repair ticket #${rep.id} for "${rep.item?.name || 'Asset'}"?`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/repairs/${rep.id}`, { method: 'DELETE' });
          showToast(`Repair ticket #${rep.id} deleted.`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
          refreshAll();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete repair ticket', 'error');
        }
      },
    });
  };

  const handleResolveRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnRepair) return;

    try {
      setSubmitting(true);
      await fetchApi(`/api/repairs/${selectedReturnRepair.id}/return`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: returnStatus,
          repairCost: parseFloat(finalCost) || selectedReturnRepair.repairCost,
          managerNotes: resolutionNotes,
        }),
      });

      showToast(
        returnStatus === 'repaired'
          ? 'Asset returned, verified, and placed back into active inventory!'
          : 'Asset marked as unrepairable and decommissioned/trashed in database.',
        'success'
      );
      setSelectedReturnRepair(null);
      await loadData();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Resolution failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDispatchItem = assetItems.find((i) => i.id === repairItemId);
  const isAdminOrSuper = currentRole === 'admin' || currentRole === 'super_manager';

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-extrabold text-slate-900">Vendors & Repairs Hub</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {repairs.length} Total Overhauls
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authorized suppliers, dispatch damaged assets for repair, track multi-branch vendor visibility, and compute engagement duration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-open-add-vendor"
            onClick={handleOpenAddVendor}
            title="Register a new authorized equipment vendor or service contractor"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
          </button>
          <button
            id="btn-open-send-repair"
            onClick={handleOpenDispatch}
            title="Create maintenance or overhaul ticket and dispatch asset to vendor"
            className="px-4 py-2 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] hover:from-[#FF8C00] hover:to-[#e03e00] text-white rounded-xl text-xs font-bold transition shadow-md shadow-[#FF8C00]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            <span>Dispatch Asset for Repair</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('repairs')}
          title="View active and completed repair tickets"
          className={`pb-3.5 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'repairs'
              ? 'border-[#FF8C00] text-[#FF8C00]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Maintenance & Repairs ({repairs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          title="View directory of approved equipment suppliers and repair contractors"
          className={`pb-3.5 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'vendors'
              ? 'border-[#FF8C00] text-[#FF8C00]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Authorized Vendors ({vendors.length})</span>
        </button>

        {isAdminOrSuper && (
          <button
            onClick={() => setActiveTab('assignments')}
            title="Admin multi-branch access control for vendors"
            className={`pb-3.5 px-1 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'assignments'
                ? 'border-[#FF8C00] text-[#FF8C00]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#FF8C00]" />
            <span className="flex items-center gap-1.5">
              Branch Visibility Matrix
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">
                Admin
              </span>
            </span>
          </button>
        )}
      </div>

      {/* Tab 1: Maintenance & Repairs */}
      {activeTab === 'repairs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Vendor Service Records & Engagement Metrics
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              Active Dispatched: {repairs.filter((r) => r.status === 'sent_to_vendor').length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Dispatched Date</th>
                  <th className="py-3 px-4">Asset Name & Tag</th>
                  <th className="py-3 px-4">Service Vendor</th>
                  <th className="py-3 px-4">Issue Description</th>
                  <th className="py-3 px-4">Engagement Prior to Repair</th>
                  <th className="py-3 px-4">Status & Cost</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading repair records...
                    </td>
                  </tr>
                ) : repairs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Wrench className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700">No repair records found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Assets dispatched to authorized workshops will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  repairs.map((rep) => {
                    const hoursEngaged = Math.floor((rep.engagedDurationMinutes || 0) / 60);
                    const isPending = rep.status === 'sent_to_vendor';

                    return (
                      <tr key={rep.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {rep.sentDate ? new Date(rep.sentDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{rep.item?.name || 'Asset Item'}</div>
                          <div className="text-[11px] font-mono text-slate-400">{rep.item?.code}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{rep.vendor?.name || 'Authorized Shop'}</div>
                          <div className="text-[11px] text-slate-400">{rep.vendor?.phone || 'No phone'}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate" title={rep.issueDescription}>
                          {rep.issueDescription}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold font-mono">
                            <Clock className="w-3 h-3" />
                            <span>{hoursEngaged} hrs</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">Before breakdown</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              rep.status === 'repaired'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rep.status === 'unrepairable_trashed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rep.status === 'sent_to_vendor' ? 'In Progress' : rep.status.replace(/_/g, ' ')}
                          </span>
                          <div className="text-[11px] font-mono text-slate-600 font-semibold mt-0.5">
                            Est: ${rep.repairCost}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <button
                                onClick={() => setSelectedReturnRepair(rep)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                                title="Resolve & Return"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Receive / Close</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEditRepair(rep)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit Repair Ticket"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {(currentRole === 'admin' || currentRole === 'super_manager') && (
                              <button
                                onClick={() => handleDeleteRepair(rep)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
      )}

      {/* Tab 2: Registered Vendors */}
      {activeTab === 'vendors' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Authorized Vendors & Workshops
            </h3>
            <span className="text-xs text-slate-500 font-semibold">{vendors.length} Registered</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vendors.map((v) => {
              const originBranch = branches.find((b) => b.id === v.branchId);

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5 text-xs relative group hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm truncate pr-2">{v.name}</h4>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                        {v.serviceType.replace(/_/g, ' ')}
                      </span>
                      {(currentRole === 'admin' || currentRole === 'super_manager') && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleOpenEditVendor(v)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="Edit Vendor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteVendor(v)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Delete Vendor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Origin Branch Tag */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Building className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>
                      Origin Branch:{' '}
                      <strong className="text-slate-700 font-semibold">
                        {originBranch ? originBranch.name : 'Central HQ (Global)'}
                      </strong>
                    </span>
                  </div>

                  {v.contactPerson && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{v.contactPerson}</span>
                    </div>
                  )}
                  {v.email && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{v.email}</span>
                    </div>
                  )}
                  {v.phone && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{v.phone}</span>
                    </div>
                  )}
                  {v.address && (
                    <div className="text-[11px] text-slate-400 truncate">
                      {v.address}
                    </div>
                  )}

                  {/* Multi-Branch Visibility Info for Admins */}
                  {isAdminOrSuper && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Allowed Branches:</span>
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {(v.assignedBranchIds?.length || 0) + (v.branchId ? 1 : branches.length)} of {branches.length}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Admin Vendor Visibility Matrix */}
      {activeTab === 'assignments' && isAdminOrSuper && (
        <VendorAssignmentsManager vendors={vendors} onRefresh={loadData} />
      )}

      {/* Dispatch / Edit Repair Modal */}
      {isSendRepairOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingRepair ? `Edit Repair Ticket #${editingRepair.id}` : 'Dispatch Asset for Vendor Repair'}
                </h3>
              </div>
              <button
                onClick={() => setIsSendRepairOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRepair} className="space-y-4 text-xs">
              <div>
                {editingRepair ? (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Asset</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800">
                      {editingRepair.item?.name} ({editingRepair.item?.code})
                    </div>
                  </div>
                ) : (
                  <SearchableItemSelect
                    items={assetItems}
                    value={repairItemId}
                    onChange={(val) => setRepairItemId(val)}
                    label="Target Asset for Repair"
                    required
                    placeholder="Type to filter assets by code or name..."
                    filterType="asset"
                    showEngagementInfo
                    id="repair-dispatch-asset-select"
                  />
                )}
              </div>

              {selectedDispatchItem && !editingRepair && (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-indigo-950">{selectedDispatchItem.name}</p>
                    <p className="text-[11px] text-indigo-700">Tag: {selectedDispatchItem.code}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-indigo-900">
                      {Math.floor((selectedDispatchItem.totalEngagementMinutes || 0) / 60)} hrs
                    </span>
                    <p className="text-[10px] text-indigo-600">Calculated Engagement Time</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Assigned Vendor / Workshop <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  tabIndex={1}
                  title="Select contracted repair specialist or OEM workshop"
                  value={repairVendorId}
                  onChange={(e) => setRepairVendorId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                >
                  <option value="">-- Select Repair Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.serviceType.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Issue Description & Failure Diagnostics <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  tabIndex={2}
                  title="Detailed symptoms, error codes, and maintenance instructions"
                  placeholder="e.g. Spindle bearing vibration anomaly under high RPM. Requires recalibration and seal replacement."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Return Date</label>
                  <input
                    type="date"
                    tabIndex={3}
                    title="Estimated date asset will be returned repaired"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estimated Repair Cost ($)</label>
                  <input
                    type="number"
                    step="any"
                    tabIndex={4}
                    title="Initial cost quotation provided by vendor"
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                  />
                </div>
              </div>

              {editingRepair && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Repair Status</label>
                  <select
                    tabIndex={5}
                    title="Current lifecycle status of repair ticket"
                    value={repairStatus}
                    onChange={(e) => setRepairStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white font-semibold"
                  >
                    <option value="sent_to_vendor">Sent to Vendor (In Progress)</option>
                    <option value="repaired">Repaired & Completed</option>
                    <option value="unrepairable_trashed">Unrepairable / Trashed</option>
                  </select>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  tabIndex={6}
                  title="Cancel dispatch dialog"
                  onClick={() => setIsSendRepairOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  tabIndex={7}
                  disabled={submitting}
                  title="Submit repair requisition and mark asset as In Repair"
                  className="px-5 py-2 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] hover:from-[#FF8C00] hover:to-[#e03e00] text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Dispatching...' : editingRepair ? 'Save Changes' : 'Dispatch Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return & Resolution Modal */}
      {selectedReturnRepair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Receive Asset from Vendor
                </h3>
              </div>
              <button
                onClick={() => setSelectedReturnRepair(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResolveRepair} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <p className="font-bold text-slate-900">{selectedReturnRepair.item?.name}</p>
                <p className="text-slate-500">Service Provider: {selectedReturnRepair.vendor?.name}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Resolution Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    tabIndex={1}
                    title="Asset successfully repaired and ready to return to stock"
                    onClick={() => setReturnStatus('repaired')}
                    className={`py-2 px-3 rounded-lg font-bold border transition cursor-pointer ${
                      returnStatus === 'repaired'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Repaired & Returned
                  </button>
                  <button
                    type="button"
                    tabIndex={2}
                    title="Asset deemed unrepairable and must be decommissioned"
                    onClick={() => setReturnStatus('unrepairable_trashed')}
                    className={`py-2 px-3 rounded-lg font-bold border transition cursor-pointer ${
                      returnStatus === 'unrepairable_trashed'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Unrepairable / Trashed
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Final Service Invoice Cost ($)</label>
                <input
                  type="number"
                  step="any"
                  tabIndex={3}
                  title="Final billed repair invoice amount"
                  value={finalCost}
                  onChange={(e) => setFinalCost(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Manager Closeout Remark</label>
                <textarea
                  rows={2}
                  tabIndex={4}
                  title="Closeout QA notes or testing certificate reference"
                  placeholder="e.g. Verified tolerances and calibration certificate. Passed QA testing."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  tabIndex={5}
                  title="Cancel resolution dialog"
                  onClick={() => setSelectedReturnRepair(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  tabIndex={6}
                  disabled={submitting}
                  title="Update repair ticket and return asset to active inventory"
                  className="px-5 py-2 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] hover:from-[#FF8C00] hover:to-[#e03e00] text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Closing Ticket...' : 'Save & Update Asset Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Vendor Modal */}
      {isAddVendorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingVendor ? 'Edit Vendor Details' : 'Register New Vendor'}
              </h3>
              <button
                onClick={() => setIsAddVendorOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Vendor / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  tabIndex={1}
                  title="Official business or corporate name of vendor"
                  placeholder="e.g. Precision Machine Tooling Ltd."
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                />
              </div>

              {/* Origin Branch Selector for Admin */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Origin / Creator Branch</label>
                {isAdminOrSuper ? (
                  <select
                    tabIndex={2}
                    title="Primary originating branch for this vendor"
                    value={vendorBranchId}
                    onChange={(e) => setVendorBranchId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white font-semibold"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold">
                    {branches.find((b) => b.id === currentBranchId)?.name || 'Current Branch'}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  tabIndex={3}
                  title="Primary account manager, service representative, or point of contact"
                  placeholder="e.g. Marcus Vance"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    tabIndex={4}
                    title="Vendor direct phone or customer hotline"
                    placeholder="+44 20 7946 0991"
                    value={vendorPhone}
                    onChange={(e) => setVendorPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    tabIndex={5}
                    title="Vendor service or billing email address"
                    placeholder="support@vendor.com"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address / Facility</label>
                <input
                  type="text"
                  tabIndex={6}
                  title="Physical depot, plant, or mailing address"
                  placeholder="Street address or industrial park..."
                  value={vendorAddress}
                  onChange={(e) => setVendorAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Service Type</label>
                <select
                  tabIndex={7}
                  title="Designation of vendor capabilities and service scope"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#FF8C00] focus:border-[#FF8C00] bg-white"
                >
                  <option value="supplier_and_repair">Supplier & Repair Contractor</option>
                  <option value="repair">Maintenance / Repair Specialist Only</option>
                  <option value="supplier">Consumable / Asset Supplier Only</option>
                </select>
              </div>

              {/* Multi-Branch Assignment checkboxes for Admin */}
              {isAdminOrSuper && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="block font-bold text-slate-700">
                    Grant Visibility to Other Branches
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {branches
                      .filter((b) => b.id !== (vendorBranchId || currentBranchId))
                      .map((branch) => {
                        const checked = assignedBranchIds.includes(branch.id);
                        return (
                          <label
                            key={branch.id}
                            title={`Authorize ${branch.name} to view and dispatch with this vendor`}
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignedBranchIds([...assignedBranchIds, branch.id]);
                                } else {
                                  setAssignedBranchIds(assignedBranchIds.filter((id) => id !== branch.id));
                                }
                              }}
                              className="rounded text-[#FF8C00] focus:ring-[#FF8C00]"
                            />
                            <span className="text-slate-700 font-medium">{branch.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  tabIndex={8}
                  title="Cancel vendor registration dialog"
                  onClick={() => setIsAddVendorOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  tabIndex={9}
                  disabled={submitting}
                  title="Save vendor details to directory"
                  className="px-5 py-2 bg-gradient-to-r from-[#FF8C00] to-[#FF4500] hover:from-[#FF8C00] hover:to-[#e03e00] text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingVendor ? 'Update Vendor' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{deleteModal.title}</h3>
              <p className="text-xs text-slate-500 mt-1.5">{deleteModal.description}</p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteModal.onConfirm}
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
