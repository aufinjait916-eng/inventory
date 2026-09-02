import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Building,
  Wrench,
  Plus,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Sparkles,
  Edit2,
  Trash2,
  Layers,
  Phone,
  Mail,
  AlertTriangle,
  UserCheck,
  FolderTree,
  CornerDownRight,
  Tags,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { fetchApi } from '../lib/api.ts';
import {
  Branch,
  Department,
  LocationItem,
  Machine,
  Employee,
  SystemUser,
  Category,
} from '../types.ts';

export const OrganizationView: React.FC = () => {
  const { currentRole, currentBranchId, branches, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'machines' | 'locations' | 'branches' | 'managers'>(
    'employees'
  );

  useEffect(() => {
    if (currentRole === 'manager' && (activeTab === 'managers' || activeTab === 'branches')) {
      setActiveTab('employees');
    }
  }, [currentRole, activeTab]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit System User / Manager Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'manager' | 'super_manager' | 'admin' | 'department'>('manager');
  const [userBranchId, setUserBranchId] = useState<number | ''>(currentBranchId);
  const [userDeptId, setUserDeptId] = useState<number | ''>('');
  const [userActive, setUserActive] = useState<boolean>(true);
  const [userAssignedCategoryIds, setUserAssignedCategoryIds] = useState<number[]>([]);

  // Category Assignment Quick Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedUserForCategories, setSelectedUserForCategories] = useState<SystemUser | null>(null);
  const [modalAssignedCategoryIds, setModalAssignedCategoryIds] = useState<number[]>([]);

  // Add / Edit Employee Modal
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [empName, setEmpName] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [empPin, setEmpPin] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empDeptIds, setEmpDeptIds] = useState<number[]>([]);

  // Add / Edit Department Modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptFloor, setDeptFloor] = useState('');

  // Add / Edit Machine Modal
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState<number | null>(null);
  const [machineName, setMachineName] = useState('');
  const [machineCode, setMachineCode] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [machineDeptId, setMachineDeptId] = useState<number | ''>('');
  const [machineStatus, setMachineStatus] = useState<string>('active');

  // Add / Edit Branch Modal
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [branchPhone, setBranchPhone] = useState('');

  // Add / Edit Location Modal
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [editingLocId, setEditingLocId] = useState<number | null>(null);
  const [locBranchId, setLocBranchId] = useState<number>(currentBranchId);
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState('storage');
  const [locDeptId, setLocDeptId] = useState<number | ''>('');
  const [parentLocId, setParentLocId] = useState<number | ''>('');
  const [modalDepartments, setModalDepartments] = useState<Department[]>([]);
  const [modalParentLocations, setModalParentLocations] = useState<LocationItem[]>([]);

  // Generic Delete Confirmation Modal
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

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [empData, deptData, mchData, locData, brData, userData, catData] = await Promise.all([
        fetchApi<Employee[]>(`/api/employees?branchId=${currentBranchId}`),
        fetchApi<Department[]>(`/api/departments?branchId=${currentBranchId}`),
        fetchApi<Machine[]>(`/api/machines?branchId=${currentBranchId}`),
        fetchApi<LocationItem[]>(`/api/locations?branchId=${currentBranchId}`),
        fetchApi<Branch[]>('/api/branches'),
        fetchApi<SystemUser[]>('/api/users'),
        fetchApi<Category[]>('/api/categories?all=true'),
      ]);

      setEmployees(empData || []);
      setDepartments(deptData || []);
      setMachines(mchData || []);
      setLocations(locData || []);
      setAllBranches(brData || []);
      setSystemUsers(userData || []);
      setAllCategories(catData || []);
    } catch (err) {
      console.error('Failed to load organization records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranchId]);

  // Employee CRUD Handlers
  const handleOpenCreateEmp = () => {
    setEditingEmpId(null);
    setEmpName('');
    setEmpCode(`EMP-${Math.floor(100 + Math.random() * 900)}`);
    setEmpPin(`${Math.floor(1000 + Math.random() * 9000)}`);
    setEmpPhone('');
    setEmpEmail('');
    setEmpDeptIds([]);
    setIsEmpModalOpen(true);
  };

  const handleOpenEditEmp = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setEmpName(emp.name);
    setEmpCode(emp.employeeCode);
    setEmpPin(emp.userCode);
    setEmpPhone(emp.phone || '');
    setEmpEmail(emp.email || '');
    setEmpDeptIds(emp.departments?.map((d) => d.departmentId) || []);
    setIsEmpModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empCode || !empPin) {
      showToast('Name, Employee Code, and 4-Digit PIN are required', 'error');
      return;
    }
    if (empPin.length !== 4 || !/^\d{4}$/.test(empPin)) {
      showToast('PIN must be exactly 4 numeric digits (e.g. 4821)', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (editingEmpId) {
        await fetchApi(`/api/employees/${editingEmpId}`, {
          method: 'PUT',
          body: JSON.stringify({
            branchId: currentBranchId,
            name: empName,
            employeeCode: empCode.toUpperCase(),
            userCode: empPin,
            phone: empPhone,
            email: empEmail,
            departmentIds: empDeptIds,
          }),
        });
        showToast(`Employee "${empName}" updated successfully!`, 'success');
      } else {
        await fetchApi('/api/employees', {
          method: 'POST',
          body: JSON.stringify({
            branchId: currentBranchId,
            name: empName,
            employeeCode: empCode.toUpperCase(),
            userCode: empPin,
            phone: empPhone,
            email: empEmail,
            departmentIds: empDeptIds,
          }),
        });
        showToast(`Employee "${empName}" created with 4-digit PIN access!`, 'success');
      }

      setIsEmpModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save employee', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmp = (emp: Employee) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Employee',
      description: `Are you sure you want to delete ${emp.name} (${emp.employeeCode})? Their kiosk punch access will be revoked.`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/employees/${emp.id}`, { method: 'DELETE' });
          showToast(`Employee "${emp.name}" deleted successfully!`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete employee', 'error');
        }
      },
    });
  };

  // Department CRUD Handlers
  const handleOpenCreateDept = () => {
    setEditingDeptId(null);
    setDeptName('');
    setDeptCode('');
    setDeptFloor('');
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept: Department) => {
    setEditingDeptId(dept.id);
    setDeptName(dept.name);
    setDeptCode(dept.code);
    setDeptFloor(dept.floorLocation || '');
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName || !deptCode) return;

    try {
      setSubmitting(true);
      if (editingDeptId) {
        await fetchApi(`/api/departments/${editingDeptId}`, {
          method: 'PUT',
          body: JSON.stringify({
            branchId: currentBranchId,
            name: deptName,
            code: deptCode.toUpperCase(),
            floorLocation: deptFloor,
          }),
        });
        showToast(`Department "${deptName}" updated!`, 'success');
      } else {
        await fetchApi('/api/departments', {
          method: 'POST',
          body: JSON.stringify({
            branchId: currentBranchId,
            name: deptName,
            code: deptCode.toUpperCase(),
            floorLocation: deptFloor,
          }),
        });
        showToast(`Department "${deptName}" created!`, 'success');
      }
      setIsDeptModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save department', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDept = (dept: Department) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Department',
      description: `Are you sure you want to delete department "${dept.name}" (${dept.code})?`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/departments/${dept.id}`, { method: 'DELETE' });
          showToast(`Department "${dept.name}" deleted!`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete department', 'error');
        }
      },
    });
  };

  // Machine CRUD Handlers
  const handleOpenCreateMachine = () => {
    setEditingMachineId(null);
    setMachineName('');
    setMachineCode('');
    setMachineModel('');
    setMachineDeptId(departments[0]?.id || '');
    setMachineStatus('active');
    setIsMachineModalOpen(true);
  };

  const handleOpenEditMachine = (m: Machine) => {
    setEditingMachineId(m.id);
    setMachineName(m.name);
    setMachineCode(m.machineCode);
    setMachineModel(m.model || '');
    setMachineDeptId(m.departmentId);
    setMachineStatus(m.status || 'active');
    setIsMachineModalOpen(true);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineName || !machineCode || !machineDeptId) return;

    try {
      setSubmitting(true);
      if (editingMachineId) {
        await fetchApi(`/api/machines/${editingMachineId}`, {
          method: 'PUT',
          body: JSON.stringify({
            branchId: currentBranchId,
            departmentId: Number(machineDeptId),
            name: machineName,
            machineCode: machineCode.toUpperCase(),
            model: machineModel,
            status: machineStatus,
          }),
        });
        showToast(`Machine "${machineName}" updated!`, 'success');
      } else {
        await fetchApi('/api/machines', {
          method: 'POST',
          body: JSON.stringify({
            branchId: currentBranchId,
            departmentId: Number(machineDeptId),
            name: machineName,
            machineCode: machineCode.toUpperCase(),
            model: machineModel,
            status: machineStatus,
          }),
        });
        showToast(`Machine "${machineName}" registered!`, 'success');
      }
      setIsMachineModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save machine', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMachine = (m: Machine) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Machine',
      description: `Are you sure you want to delete machine "${m.name}" (${m.machineCode})?`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/machines/${m.id}`, { method: 'DELETE' });
          showToast(`Machine "${m.name}" deleted!`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete machine', 'error');
        }
      },
    });
  };

  // Branch CRUD Handlers
  const handleOpenCreateBranch = () => {
    setEditingBranchId(null);
    setBranchName('');
    setBranchCode('');
    setBranchLocation('');
    setBranchPhone('');
    setIsBranchModalOpen(true);
  };

  const handleOpenEditBranch = (b: Branch) => {
    setEditingBranchId(b.id);
    setBranchName(b.name);
    setBranchCode(b.code);
    setBranchLocation(b.location);
    setBranchPhone(b.phone || '');
    setIsBranchModalOpen(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName || !branchCode || !branchLocation) return;

    try {
      setSubmitting(true);
      if (editingBranchId) {
        await fetchApi(`/api/branches/${editingBranchId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: branchName,
            code: branchCode.toUpperCase(),
            location: branchLocation,
            phone: branchPhone,
          }),
        });
        showToast(`Branch "${branchName}" updated!`, 'success');
      } else {
        await fetchApi('/api/branches', {
          method: 'POST',
          body: JSON.stringify({
            name: branchName,
            code: branchCode.toUpperCase(),
            location: branchLocation,
            phone: branchPhone,
          }),
        });
        showToast(`Branch "${branchName}" created!`, 'success');
      }
      setIsBranchModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save branch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBranch = (b: Branch) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Branch',
      description: `Are you sure you want to delete branch "${b.name}" (${b.code})?`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/branches/${b.id}`, { method: 'DELETE' });
          showToast(`Branch "${b.name}" deleted!`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete branch', 'error');
        }
      },
    });
  };

  // Location CRUD Handlers
  // Location CRUD Handlers
  const syncModalBranchData = async (branchId: number) => {
    try {
      if (branchId === currentBranchId) {
        setModalDepartments(departments);
        setModalParentLocations(locations);
      } else {
        const [deptData, locData] = await Promise.all([
          fetchApi<Department[]>(`/api/departments?branchId=${branchId}`),
          fetchApi<LocationItem[]>(`/api/locations?branchId=${branchId}`),
        ]);
        setModalDepartments(deptData || []);
        setModalParentLocations(locData || []);
      }
    } catch (err) {
      console.error('Failed to load modal branch metadata:', err);
    }
  };

  const handleOpenCreateLoc = async (parentId?: number) => {
    setEditingLocId(null);
    setLocName('');

    if (parentId) {
      const parent = locations.find((l) => l.id === parentId);
      const targetBranch = parent?.branchId || currentBranchId;
      setLocBranchId(targetBranch);
      setParentLocId(parentId);
      setLocType('rack');
      setLocDeptId(parent?.departmentId || '');
      await syncModalBranchData(targetBranch);
    } else {
      const targetBranch = currentRole === 'manager' ? currentBranchId : currentBranchId;
      setLocBranchId(targetBranch);
      setParentLocId('');
      setLocType('storage');
      setLocDeptId(''); // Optional (No Department)
      await syncModalBranchData(targetBranch);
    }

    setIsLocModalOpen(true);
  };

  const handleOpenEditLoc = async (loc: LocationItem) => {
    setEditingLocId(loc.id);
    setLocName(loc.name);
    setLocType(loc.type || 'storage');
    const targetBranch = loc.branchId || currentBranchId;
    setLocBranchId(targetBranch);
    setParentLocId(loc.parentLocationId || '');
    setLocDeptId(loc.departmentId || '');
    await syncModalBranchData(targetBranch);
    setIsLocModalOpen(true);
  };

  const handleParentLocationChange = (selectedParentId: number | '') => {
    setParentLocId(selectedParentId);
    if (selectedParentId) {
      const activeLocs = modalParentLocations.length > 0 ? modalParentLocations : locations;
      const parent = activeLocs.find((l) => l.id === Number(selectedParentId));
      if (parent) {
        // Fix department to parent location's department (or empty if parent has no dept)
        setLocDeptId(parent.departmentId || '');
        if (parent.branchId && parent.branchId !== locBranchId) {
          setLocBranchId(parent.branchId);
          syncModalBranchData(parent.branchId);
        }
      }
    }
  };

  const handleModalBranchChange = async (newBranchId: number) => {
    setLocBranchId(newBranchId);
    setParentLocId('');
    setLocDeptId('');
    await syncModalBranchData(newBranchId);
  };

  const handleSaveLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) {
      showToast('Location name is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const targetBranch = currentRole === 'manager' ? currentBranchId : locBranchId;

      if (editingLocId) {
        await fetchApi(`/api/locations/${editingLocId}`, {
          method: 'PUT',
          body: JSON.stringify({
            branchId: targetBranch,
            departmentId: locDeptId ? Number(locDeptId) : null,
            name: locName.trim(),
            type: locType,
            parentLocationId: parentLocId ? Number(parentLocId) : null,
          }),
        });
        showToast(`Location "${locName}" updated!`, 'success');
      } else {
        await fetchApi('/api/locations', {
          method: 'POST',
          body: JSON.stringify({
            branchId: targetBranch,
            departmentId: locDeptId ? Number(locDeptId) : null,
            name: locName.trim(),
            type: locType,
            parentLocationId: parentLocId ? Number(parentLocId) : null,
          }),
        });
        showToast(`Location "${locName}" created!`, 'success');
      }
      setIsLocModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save location', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLoc = (loc: LocationItem) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Location',
      description: `Are you sure you want to delete storage location "${loc.name}"? Any sublocations under it will also be unlinked.`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/locations/${loc.id}`, { method: 'DELETE' });
          showToast(`Location "${loc.name}" deleted!`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete location', 'error');
        }
      },
    });
  };

  // User / Manager CRUD Handlers
  const handleOpenCreateUser = () => {
    setEditingUserId(null);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserRole('manager');
    setUserBranchId(currentBranchId);
    setUserDeptId('');
    setUserActive(true);
    // By default, select all categories for a new manager
    setUserAssignedCategoryIds(allCategories.map((c) => c.id));
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: SystemUser) => {
    setEditingUserId(u.id);
    setUserName(u.name);
    setUserEmail(u.email);
    setUserPassword('');
    setUserRole(u.role as any);
    setUserBranchId(u.branchId || '');
    setUserDeptId(u.departmentId || '');
    setUserActive(u.isActive !== false);
    setUserAssignedCategoryIds(u.assignedCategoryIds || []);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim() || !userRole) {
      showToast('Full name, email, and role are required', 'error');
      return;
    }

    const isGlobalRole = userRole === 'admin' || userRole === 'super_manager';
    if (!isGlobalRole && !userBranchId) {
      showToast('Please select an assigned branch for this user role', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        name: userName.trim(),
        email: userEmail.trim().toLowerCase(),
        role: userRole,
        branchId: isGlobalRole ? null : (userBranchId ? Number(userBranchId) : null),
        departmentId: isGlobalRole ? null : (userDeptId ? Number(userDeptId) : null),
        isActive: userActive,
        assignedCategoryIds: (userRole === 'manager' || userRole === 'department') ? userAssignedCategoryIds : undefined,
      };

      if (userPassword && userPassword.trim()) {
        payload.password = userPassword.trim();
      }

      if (editingUserId) {
        await fetchApi(`/api/users/${editingUserId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`User "${userName}" updated successfully!`, 'success');
      } else {
        await fetchApi('/api/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`User "${userName}" created successfully!`, 'success');
      }
      setIsUserModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save user record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCategoryModal = (u: SystemUser) => {
    setSelectedUserForCategories(u);
    setModalAssignedCategoryIds(u.assignedCategoryIds || []);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategoryAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCategories) return;

    try {
      setSubmitting(true);
      await fetchApi(`/api/users/${selectedUserForCategories.id}/categories`, {
        method: 'PUT',
        body: JSON.stringify({
          categoryIds: modalAssignedCategoryIds,
        }),
      });
      showToast(`Category permissions updated for ${selectedUserForCategories.name}!`, 'success');
      setIsCategoryModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update category permissions', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = (u: SystemUser) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Manager / User',
      description: `Are you sure you want to remove user "${u.name}" (${u.email})?`,
      onConfirm: async () => {
        try {
          await fetchApi(`/api/users/${u.id}`, { method: 'DELETE' });
          showToast(`Manager "${u.name}" removed!`, 'success');
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete user', 'error');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-extrabold text-slate-900">Organization, Personnel & Assets Setup</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full management and record control for branches, departments, locations, machinery, and personnel PINs.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'employees' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Employees ({employees.length})</span>
          </button>
          {currentRole !== 'manager' && (
            <button
              onClick={() => setActiveTab('managers')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'managers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Users ({systemUsers.length})</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'departments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-amber-600" />
            <span>Departments ({departments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'locations' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>Locations & Sublocations ({locations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('machines')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'machines' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-indigo-600" />
            <span>Machines ({machines.length})</span>
          </button>
          {currentRole !== 'manager' && (
            <button
              onClick={() => setActiveTab('branches')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'branches' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-violet-600" />
              <span>Branches ({allBranches.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* EMPLOYEES TAB */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Branch Personnel & Assigned 4-Digit PINs</h3>
              <p className="text-xs text-slate-500">
                Employees authenticate via punch kiosks using their 4-digit code (no user accounts needed).
              </p>
            </div>
            {(currentRole === 'admin' || currentRole === 'super_manager' || currentRole === 'manager') && (
              <button
                id="btn-add-employee"
                onClick={handleOpenCreateEmp}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Employee</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">4-Digit Kiosk PIN</th>
                  <th className="py-3 px-4">Associated Departments</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{emp.employeeCode}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{emp.name}</td>
                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-md font-mono font-bold text-xs">
                        <KeyRound className="w-3 h-3 text-blue-600" />
                        <span>{emp.userCode}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {emp.departments && emp.departments.length > 0 ? (
                          emp.departments.map((d) => (
                            <span
                              key={d.id}
                              className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700"
                            >
                              {d.department?.name || `Dept #${d.departmentId}`}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">All Depts</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {emp.phone || emp.email || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ACTIVE
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditEmp(emp)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit Employee"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmp(emp)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No employees registered yet. Click "Add Employee" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPARTMENTS TAB */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Branch Departments (Stock Locations)</h3>
              <p className="text-xs text-slate-500">
                Departments serve as physical locations for asset & consumable allocations.
              </p>
            </div>
            <button
              onClick={handleOpenCreateDept}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {departments.map((d) => (
              <div key={d.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs relative group hover:border-blue-300 transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded">{d.code}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditDept(d)}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit Department"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDept(d)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete Department"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{d.name}</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">Floor / Zone: {d.floorLocation || 'Main Hall'}</p>
                </div>
              </div>
            ))}
            {departments.length === 0 && !loading && (
              <div className="col-span-3 text-center py-8 text-slate-400">
                No departments added yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANAGERS & SYSTEM USERS TAB */}
      {activeTab === 'managers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Managers & Authorized System Users</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Admin Enforced
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage system administrators, managers, and associate them with their respective branches and assigned item categories.
              </p>
            </div>
            {currentRole === 'admin' && (
              <button
                id="btn-add-manager"
                onClick={handleOpenCreateUser}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Manager</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemUsers.map((u) => {
              const assignedBranch = allBranches.find((b) => b.id === u.branchId);
              const assignedDept = departments.find((d) => d.id === u.departmentId);

              const roleBadgeColors: Record<string, string> = {
                admin: 'bg-red-50 text-red-700 border-red-200',
                super_manager: 'bg-purple-50 text-purple-700 border-purple-200',
                manager: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                department: 'bg-blue-50 text-blue-700 border-blue-200',
              };

              const roleLabels: Record<string, string> = {
                admin: 'SYSTEM ADMIN',
                super_manager: 'SUPER MANAGER',
                manager: 'MANAGER',
                department: 'DEPT HEAD',
              };

              const userCategoryCount = u.assignedCategoryIds?.length ?? 0;
              const assignedCategoryNames = u.assignedCategoryIds
                ?.map((catId) => allCategories.find((c) => c.id === catId)?.name)
                .filter(Boolean);

              return (
                <div
                  key={u.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs relative group hover:border-indigo-300 transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono uppercase text-[10px] font-bold px-2 py-0.5 rounded border ${
                          roleBadgeColors[u.role] || 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {roleLabels[u.role] || u.role.toUpperCase()}
                      </span>

                      <div className="flex items-center gap-1">
                        {u.isActive !== false ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                            INACTIVE
                          </span>
                        )}

                        {currentRole === 'admin' && (
                          <>
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                              title="Edit Manager"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              title="Remove Manager"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        <span>{u.name}</span>
                      </h4>
                      <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{u.email}</span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>Assigned Branch:</span>
                        </span>
                        <span className="font-bold text-slate-800">
                          {assignedBranch ? assignedBranch.name : u.role === 'admin' || u.role === 'super_manager' ? 'All Branches' : `Branch #${u.branchId}`}
                        </span>
                      </div>

                      {u.hasPassword && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 flex items-center gap-1">
                            <KeyRound className="w-3 h-3 text-emerald-600" />
                            <span>Password Protected:</span>
                          </span>
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-200">
                            Configured
                          </span>
                        </div>
                      )}

                      {/* Assigned Category Visibility (for Managers & Department Users) */}
                      {(u.role === 'manager' || u.role === 'department') && (
                        <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 flex items-center gap-1 font-semibold">
                              <Tags className="w-3 h-3 text-indigo-600" />
                              <span>Assigned Categories:</span>
                            </span>
                            <span className="font-bold text-indigo-700">
                              {userCategoryCount} / {allCategories.length}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                            {assignedCategoryNames && assignedCategoryNames.length > 0 ? (
                              assignedCategoryNames.map((name, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-medium"
                                >
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                                No categories assigned (Restricted)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admin Quick Category Assignment Action */}
                  {currentRole === 'admin' && (u.role === 'manager' || u.role === 'department') && (
                    <div className="pt-2 border-t border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => handleOpenCategoryModal(u)}
                        className="w-full py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Tags className="w-3.5 h-3.5" />
                        <span>Assign Categories ({userCategoryCount})</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {systemUsers.length === 0 && !loading && (
              <div className="col-span-3 text-center py-8 text-slate-400">
                No managers found. Click "Add Manager" to associate a manager with a branch.
              </div>
            )}
          </div>
        </div>
      )}

      {/* STORAGE LOCATIONS & SUBLOCATIONS TAB */}
      {activeTab === 'locations' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Storage Locations & Sublocations Hierarchy</h3>
              <p className="text-xs text-slate-500">
                Configure primary rooms, zones, and nest sublocations (shelves, racks, bins) under them.
              </p>
            </div>
            <button
              onClick={() => handleOpenCreateLoc()}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Location</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations
              .filter((loc) => !loc.parentLocationId)
              .map((loc) => {
                const dept = departments.find((d) => d.id === loc.departmentId);
                const sublocations = locations.filter((sub) => sub.parentLocationId === loc.id);

                return (
                  <div
                    key={loc.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs relative group hover:border-emerald-300 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono uppercase text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {loc.type || 'storage'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                          Primary Location
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenCreateLoc(loc.id)}
                          className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                          title="Add Sublocation under this location"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditLoc(loc)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title="Edit Location"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLoc(loc)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                          title="Delete Location"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>{loc.name}</span>
                      </h4>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Dept: <span className="font-semibold text-slate-700">{dept?.name || 'General Branch'}</span>
                      </p>
                    </div>

                    {/* Sublocations List / Hierarchy */}
                    <div className="pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <FolderTree className="w-3 h-3 text-emerald-600" />
                          <span>Sublocations ({sublocations.length})</span>
                        </span>
                        <button
                          onClick={() => handleOpenCreateLoc(loc.id)}
                          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Add Sublocation</span>
                        </button>
                      </div>

                      {sublocations.length > 0 ? (
                        <div className="space-y-1.5">
                          {sublocations.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5">
                                <CornerDownRight className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                <span className="font-semibold text-slate-800">{sub.name}</span>
                                <span className="text-[9px] uppercase font-mono text-slate-400 bg-slate-100 px-1 rounded">
                                  {sub.type || 'bin'}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => handleOpenEditLoc(sub)}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                  title="Edit Sublocation"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLoc(sub)}
                                  className="p-0.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                  title="Delete Sublocation"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No sublocations (shelves/bins) nested yet.</p>
                      )}
                    </div>
                  </div>
                );
              })}

            {locations.length === 0 && !loading && (
              <div className="col-span-3 text-center py-8 text-slate-400">
                No storage locations recorded yet. Click "Add Location" to configure bins, racks, and rooms.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MACHINES TAB */}
      {activeTab === 'machines' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Department Machinery & Equipment</h3>
              <p className="text-xs text-slate-500">
                Register machines to which assets and consumables can be dedicated.
              </p>
            </div>
            <button
              onClick={handleOpenCreateMachine}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Machine</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {machines.map((m) => {
              const dept = departments.find((d) => d.id === m.departmentId);
              return (
                <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs relative group hover:border-indigo-300 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {m.machineCode}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {(m.status || 'active').toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleOpenEditMachine(m)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Machine"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMachine(m)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete Machine"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{m.name}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Dept: <span className="font-semibold text-slate-700">{dept?.name || 'Assembly'}</span>
                      {m.model && ` • Model: ${m.model}`}
                    </p>
                  </div>
                </div>
              );
            })}
            {machines.length === 0 && !loading && (
              <div className="col-span-3 text-center py-8 text-slate-400">
                No machines recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* BRANCHES TAB (ADMIN-ONLY CREATION) */}
      {activeTab === 'branches' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Organization Branch Network</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                  {currentRole === 'admin' ? 'Admin Full Access' : 'Admin Restricted'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-branch architecture. Only System Administrators can create or delete branch facilities.
              </p>
            </div>
            {currentRole === 'admin' && (
              <button
                id="btn-add-branch"
                onClick={handleOpenCreateBranch}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Branch</span>
              </button>
            )}
          </div>

          {currentRole !== 'admin' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Branch creation and editing is restricted to System Administrators. Managers and super managers have isolated operations within their assigned branch locations.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {allBranches.map((b) => (
              <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs relative group hover:border-violet-300 transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {b.code}
                  </span>
                  {currentRole === 'admin' ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditBranch(b)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                        title="Edit Branch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBranch(b)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        title="Delete Branch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold">Managed</span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                  <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{b.location}</span>
                  </p>
                  {b.phone && (
                    <p className="text-slate-400 text-[10px] mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>{b.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Employee */}
      {isEmpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingEmpId ? 'Edit Employee Record' : 'Add Branch Employee'}
              </h3>
              <button onClick={() => setIsEmpModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Miller"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Employee ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-109"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    4-Digit Kiosk PIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    placeholder="e.g. 7842"
                    value={empPin}
                    onChange={(e) => setEmpPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 font-mono font-bold tracking-widest text-center border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-blue-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 019-2834"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="emp@factory.com"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Associated Departments</label>
                <div className="max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50 space-y-1">
                  {departments.map((d) => {
                    const isChecked = empDeptIds.includes(d.id);
                    return (
                      <label key={d.id} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setEmpDeptIds([...empDeptIds, d.id]);
                            else setEmpDeptIds(empDeptIds.filter((id) => id !== d.id));
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="font-medium">{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmpModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingEmpId ? 'Update Employee' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Department */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingDeptId ? 'Edit Department' : 'Add Department'}
              </h3>
              <button onClick={() => setIsDeptModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quality Assurance & Testing"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="QAT"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Floor Location</label>
                  <input
                    type="text"
                    placeholder="Level 2 West"
                    value={deptFloor}
                    onChange={(e) => setDeptFloor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingDeptId ? 'Update Department' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Machine */}
      {isMachineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingMachineId ? 'Edit Machine' : 'Register Machine'}
              </h3>
              <button onClick={() => setIsMachineModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMachine} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Machine Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Haas VF-4SS Vertical Machining Center"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Machine Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MCH-VF4-01"
                    value={machineCode}
                    onChange={(e) => setMachineCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Model / Specs</label>
                  <input
                    type="text"
                    placeholder="VF-4SS (2024)"
                    value={machineModel}
                    onChange={(e) => setMachineModel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Department</label>
                  <select
                    value={machineDeptId}
                    onChange={(e) => setMachineDeptId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Operational Status</label>
                  <select
                    value={machineStatus}
                    onChange={(e) => setMachineStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="active">Active / Operational</option>
                    <option value="maintenance">Under Maintenance</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMachineModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingMachineId ? 'Update Machine' : 'Save Machine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Storage Location */}
      {isLocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingLocId ? 'Edit Storage Location' : parentLocId ? 'Add Sublocation / Bin' : 'Add Storage Location'}
                </h3>
                <p className="text-xs text-slate-500">
                  {parentLocId
                    ? 'Sublocations inherit branch and department from their parent location.'
                    : 'Locations can optionally belong to a department or the general branch.'}
                </p>
              </div>
              <button onClick={() => setIsLocModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLoc} className="space-y-3.5 text-xs">
              {/* Branch Association */}
              {currentRole === 'manager' ? (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                    Branch Association
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      {allBranches.find((b) => b.id === currentBranchId)?.name || `Branch #${currentBranchId}`}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Manager Branch Locked
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      Branch <span className="text-red-500">*</span>
                    </label>
                    {parentLocId && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        Locked to Parent
                      </span>
                    )}
                  </div>
                  <select
                    value={locBranchId}
                    disabled={!!parentLocId}
                    onChange={(e) => handleModalBranchChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
                  >
                    {allBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.code ? `(${b.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Location / Bin Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Storage Bay A, Shelf 3, Bin 12"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Parent Location <span className="text-slate-400 font-normal">(Optional - for sublocations/bins)</span>
                </label>
                <select
                  value={parentLocId}
                  onChange={(e) => handleParentLocationChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                >
                  <option value="">(None - Top-level Primary Location)</option>
                  {(modalParentLocations.length > 0 ? modalParentLocations : locations)
                    .filter((l) => (!editingLocId || l.id !== editingLocId) && !l.parentLocationId && l.branchId === locBranchId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.type || 'storage'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Location Type</label>
                  <select
                    value={locType}
                    onChange={(e) => setLocType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                  >
                    <option value="storage">Storage Room</option>
                    <option value="rack">Rack / Shelf</option>
                    <option value="bay">Bay / Area</option>
                    <option value="department">Department Hub</option>
                    <option value="bin">Bin / Container</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Department</label>
                    {parentLocId && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                        Fixed
                      </span>
                    )}
                  </div>
                  <select
                    value={locDeptId}
                    disabled={!!parentLocId}
                    onChange={(e) => setLocDeptId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
                  >
                    <option value="">No Department (General Branch)</option>
                    {(modalDepartments.length > 0 ? modalDepartments : departments).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {parentLocId && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-800">
                  <span className="font-bold">Note:</span>
                  <span>
                    When creating a sublocation, the department is automatically fixed based on the selected parent location (
                    <span className="font-semibold">
                      {(modalDepartments.length > 0 ? modalDepartments : departments).find((d) => d.id === locDeptId)?.name || 'No Department'}
                    </span>
                    ).
                  </span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLocModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer transition"
                >
                  {editingLocId ? 'Update Location' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Manager / User */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingUserId ? 'Edit User Record' : 'Create User Account'}
                </h3>
              </div>
              <button onClick={() => setIsUserModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Login Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="sarah.jenkins@factory.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {editingUserId ? 'Change Password (Optional)' : 'User Password'}
                </label>
                <input
                  type="password"
                  placeholder={editingUserId ? 'Leave blank to keep existing password' : 'Set password (e.g. welcome123)'}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {editingUserId ? 'Leave blank if you do not wish to change the password.' : 'Default password is "welcome123" if left blank.'}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  System Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="manager">Manager</option>
                  <option value="super_manager">Super Manager (All Branches)</option>
                  <option value="department">Department Head</option>
                  <option value="admin">System Administrator (All Branches)</option>
                </select>
              </div>

              {/* Conditional Branch & Department assignment */}
              {userRole === 'admin' || userRole === 'super_manager' ? (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl text-violet-800 text-[11px] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <span>
                    <strong>Global Access:</strong> {userRole === 'admin' ? 'System Administrators' : 'Super Managers'} have full access across all branches. Branch assignment is not needed.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Assigned Branch <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={userBranchId}
                      required
                      onChange={(e) => setUserBranchId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {allBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Department (Optional)</label>
                    <select
                      value={userDeptId}
                      onChange={(e) => setUserDeptId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">All Departments in Branch</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Category Assignment Section (For Managers & Department Users) */}
              {(userRole === 'manager' || userRole === 'department') && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Tags className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Assigned Categories ({userAssignedCategoryIds.length} / {allCategories.length})</span>
                    </label>
                    <div className="flex items-center gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setUserAssignedCategoryIds(allCategories.map((c) => c.id))}
                        className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-indigo-300">•</span>
                      <button
                        type="button"
                        onClick={() => setUserAssignedCategoryIds([])}
                        className="font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-indigo-700 leading-tight">
                    {userRole === 'department'
                      ? 'Department users will only be able to request and search materials belonging to these assigned categories.'
                      : 'Managers will only have visibility into stock items, models, and requests belonging to these assigned categories.'}
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1 bg-white p-2 rounded-lg border border-indigo-100">
                    {allCategories.map((cat) => {
                      const isSelected = userAssignedCategoryIds.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-2 p-1.5 rounded text-[11px] cursor-pointer transition border ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-semibold'
                              : 'hover:bg-slate-50 border-transparent text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setUserAssignedCategoryIds([...userAssignedCategoryIds, cat.id]);
                              } else {
                                setUserAssignedCategoryIds(userAssignedCategoryIds.filter((id) => id !== cat.id));
                              }
                            }}
                            className="w-3.5 h-3.5 text-indigo-600 rounded"
                          />
                          <span className="truncate">{cat.name}</span>
                        </label>
                      );
                    })}
                    {allCategories.length === 0 && (
                      <div className="col-span-2 text-center text-[10px] text-slate-400 py-2">
                        No categories found in system.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={userActive}
                  onChange={(e) => setUserActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="userActiveCheck" className="text-slate-700 font-semibold cursor-pointer select-none">
                  Active User Status (Enabled for login and management)
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer transition"
                >
                  {editingUserId ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Category Assignment (Admin) */}
      {isCategoryModalOpen && selectedUserForCategories && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assign Categories to Manager</h3>
                  <p className="text-xs text-slate-500">
                    {selectedUserForCategories.name} • {selectedUserForCategories.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategoryAssignments} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed">
                <span className="font-bold">Manager Visibility Rule:</span> This manager will strictly only be able to view, manage, request, transfer, and repair items and dynamic fields within the selected categories. Unselected categories are completely hidden.
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-700">
                  Select Permitted Categories ({modalAssignedCategoryIds.length} / {allCategories.length} selected)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalAssignedCategoryIds(allCategories.map((c) => c.id))}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setModalAssignedCategoryIds([])}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {allCategories.map((cat) => {
                  const isChecked = modalAssignedCategoryIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-semibold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalAssignedCategoryIds([...modalAssignedCategoryIds, cat.id]);
                          } else {
                            setModalAssignedCategoryIds(modalAssignedCategoryIds.filter((id) => id !== cat.id));
                          }
                        }}
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{cat.name}</div>
                        {cat.description && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{cat.description}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
                {allCategories.length === 0 && (
                  <div className="col-span-2 text-center text-slate-400 py-6">
                    No categories available in the system catalog.
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  Save Category Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Branch */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingBranchId ? 'Edit Branch' : 'Add New Branch'}
              </h3>
              <button onClick={() => setIsBranchModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. West Coast Distribution Facility"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Branch Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="WCD-01"
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 482-1940"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Physical Address / Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 742 Industrial Pkwy, Building B, Seattle, WA"
                  value={branchLocation}
                  onChange={(e) => setBranchLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editingBranchId ? 'Update Branch' : 'Save Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Delete Modal */}
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
