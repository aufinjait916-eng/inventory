import React, { useState } from 'react';
import {
  ShieldCheck,
  Building,
  Check,
  X,
  Search,
  Filter,
  Users,
  Eye,
  Lock,
  Globe,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import { Vendor, Branch } from '../types.ts';

interface VendorAssignmentsManagerProps {
  vendors: Vendor[];
  onRefresh: () => Promise<void>;
}

export const VendorAssignmentsManager: React.FC<VendorAssignmentsManagerProps> = ({
  vendors,
  onRefresh,
}) => {
  const { branches, showToast, refreshAll } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOriginBranch, setSelectedOriginBranch] = useState<string>('all');
  const [savingVendorId, setSavingVendorId] = useState<number | null>(null);

  // Local state for assignments to allow smooth editing and bulk actions
  const [localAssignments, setLocalAssignments] = useState<Record<number, number[]>>(() => {
    const initial: Record<number, number[]> = {};
    vendors.forEach((v) => {
      initial[v.id] = v.assignedBranchIds || [];
    });
    return initial;
  });

  // Update local assignments when incoming vendors list changes
  React.useEffect(() => {
    const updated: Record<number, number[]> = {};
    vendors.forEach((v) => {
      updated[v.id] = v.assignedBranchIds || [];
    });
    setLocalAssignments(updated);
  }, [vendors]);

  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.contactPerson && v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())) ||
      v.serviceType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesOrigin =
      selectedOriginBranch === 'all'
        ? true
        : selectedOriginBranch === 'hq'
        ? !v.branchId
        : v.branchId === Number(selectedOriginBranch);

    return matchesSearch && matchesOrigin;
  });

  const handleToggleBranch = async (vendor: Vendor, branchId: number) => {
    if (vendor.branchId === branchId) {
      // Origin branch always has native access
      return;
    }

    const currentAssigned = localAssignments[vendor.id] || [];
    const isAssigned = currentAssigned.includes(branchId);
    const newAssigned = isAssigned
      ? currentAssigned.filter((id) => id !== branchId)
      : [...currentAssigned, branchId];

    // Optimistic UI update
    setLocalAssignments((prev) => ({
      ...prev,
      [vendor.id]: newAssigned,
    }));

    try {
      setSavingVendorId(vendor.id);
      await fetchApi(`/api/vendors/${vendor.id}/branch-assignments`, {
        method: 'POST',
        body: JSON.stringify({ branchIds: newAssigned }),
      });

      const branchName = branches.find((b) => b.id === branchId)?.name || `Branch #${branchId}`;
      showToast(
        isAssigned
          ? `Visibility for "${vendor.name}" revoked from ${branchName}`
          : `Visibility for "${vendor.name}" granted to ${branchName}`,
        'success'
      );
      await onRefresh();
      refreshAll();
    } catch (err: any) {
      // Revert on failure
      setLocalAssignments((prev) => ({
        ...prev,
        [vendor.id]: currentAssigned,
      }));
      showToast(err.message || 'Failed to update vendor permissions', 'error');
    } finally {
      setSavingVendorId(null);
    }
  };

  const handleGrantAll = async (vendor: Vendor) => {
    // All branches except origin
    const allBranchIds = branches
      .map((b) => b.id)
      .filter((bId) => bId !== vendor.branchId);

    setLocalAssignments((prev) => ({
      ...prev,
      [vendor.id]: allBranchIds,
    }));

    try {
      setSavingVendorId(vendor.id);
      await fetchApi(`/api/vendors/${vendor.id}/branch-assignments`, {
        method: 'POST',
        body: JSON.stringify({ branchIds: allBranchIds }),
      });
      showToast(`Granted global visibility to all branches for "${vendor.name}"`, 'success');
      await onRefresh();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to grant global visibility', 'error');
    } finally {
      setSavingVendorId(null);
    }
  };

  const handleRevokeAll = async (vendor: Vendor) => {
    setLocalAssignments((prev) => ({
      ...prev,
      [vendor.id]: [],
    }));

    try {
      setSavingVendorId(vendor.id);
      await fetchApi(`/api/vendors/${vendor.id}/branch-assignments`, {
        method: 'POST',
        body: JSON.stringify({ branchIds: [] }),
      });
      showToast(`Restricted "${vendor.name}" to its origin branch only`, 'info');
      await onRefresh();
      refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke permissions', 'error');
    } finally {
      setSavingVendorId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informational Banner */}
      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#FF8C00] to-[#FF4500] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="font-extrabold text-amber-950 text-sm">
            Administrator Vendor Access & Visibility Control
          </h4>
          <p className="text-amber-900 leading-relaxed">
            By default, vendors created by a Manager are only visible to that branch. As an
            Administrator, you can review where each vendor was registered and assign visibility to
            managers of other branches. Originating branches maintain permanent primary access.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              tabIndex={1}
              title="Search vendor by name, contact, or service type"
              placeholder="Search vendor by name, contact, or service type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C00]"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              tabIndex={2}
              title="Filter vendors by branch of creation"
              value={selectedOriginBranch}
              onChange={(e) => setSelectedOriginBranch(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF8C00]"
            >
              <option value="all">All Origin Branches</option>
              <option value="hq">Headquarters / Global</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  Created at: {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
            Showing {filteredVendors.length} of {vendors.length} Vendors
          </span>
        </div>
      </div>

      {/* Vendors Assignment Cards / Table */}
      <div className="space-y-4">
        {filteredVendors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
            <Building className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-bold text-slate-700 text-sm">No vendors match your search filters</p>
            <p className="text-xs">Adjust your search query or origin branch filter above.</p>
          </div>
        ) : (
          filteredVendors.map((vendor) => {
            const originBranch = branches.find((b) => b.id === vendor.branchId);
            const assignedIds = localAssignments[vendor.id] || [];
            const isSaving = savingVendorId === vendor.id;

            return (
              <div
                key={vendor.id}
                id={`vendor-assignment-card-${vendor.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition space-y-4"
              >
                {/* Header Information */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-slate-900 text-sm">{vendor.name}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {vendor.serviceType.replace(/_/g, ' ')}
                      </span>
                      {isSaving && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Saving permissions...
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {vendor.contactPerson && (
                        <span>
                          Contact: <strong className="text-slate-700">{vendor.contactPerson}</strong>
                        </span>
                      )}
                      {vendor.phone && (
                        <span>
                          Phone: <strong className="text-slate-700 font-mono">{vendor.phone}</strong>
                        </span>
                      )}
                      {vendor.email && (
                        <span>
                          Email: <strong className="text-slate-700">{vendor.email}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Origin Branch Tag */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Origin / Created At</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-xs font-extrabold text-indigo-950 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                          {originBranch ? originBranch.name : 'Central HQ (Global)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branch Visibility Matrix Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      Manager Visibility & Authorization
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGrantAll(vendor)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        Grant All Branches
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => handleRevokeAll(vendor)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                      >
                        Restrict to Origin Only
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                    {branches.map((branch) => {
                      const isOrigin = branch.id === vendor.branchId;
                      const isAssigned = isOrigin || assignedIds.includes(branch.id);

                      return (
                        <div
                          key={branch.id}
                          id={`vendor-${vendor.id}-branch-${branch.id}`}
                          onClick={() => {
                            if (!isOrigin) {
                              handleToggleBranch(vendor, branch.id);
                            }
                          }}
                          className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                            isOrigin
                              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 cursor-default'
                              : isAssigned
                              ? 'bg-blue-50/80 border-blue-300 text-blue-950 cursor-pointer hover:bg-blue-100/70'
                              : 'bg-slate-50 border-slate-200 text-slate-600 cursor-pointer hover:border-slate-300 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold truncate text-xs">{branch.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{branch.code}</p>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {isOrigin ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-200/80 text-indigo-900">
                                Origin
                              </span>
                            ) : isAssigned ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-200/80 text-blue-900 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Visible
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-500 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Hidden
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
