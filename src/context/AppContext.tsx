import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, Branch, Department, Category, DashboardStats, SystemUser } from '../types.ts';
import { fetchApi } from '../lib/api.ts';

interface AppContextType {
  authenticatedUser: SystemUser | null;
  isAuthenticated: boolean;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; user?: SystemUser; error?: string }>;
  logout: () => void;

  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentBranchId: number;
  setCurrentBranchId: (id: number) => void;
  currentDepartmentId: number;
  setCurrentDepartmentId: (id: number) => void;
  currentUserName: string;
  setCurrentUserName: (name: string) => void;
  
  branches: Branch[];
  departments: Department[];
  categories: Category[];
  dashboardStats: DashboardStats | null;
  
  refreshAll: () => Promise<void>;
  seedDemoData: () => Promise<void>;
  
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authenticatedUser, setAuthenticatedUser] = useState<SystemUser | null>(() => {
    try {
      const saved = localStorage.getItem('app_authenticated_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    // Default demo session if previously authenticated or initialized
    const savedRole = localStorage.getItem('app_role');
    if (savedRole) {
      return {
        id: parseInt(localStorage.getItem('app_user_id') || '1'),
        uid: 'user-admin-1',
        email: 'admin@company.local',
        name: localStorage.getItem('app_user_name') || 'Arthur Pendelton (Admin)',
        role: (savedRole as UserRole) || 'admin',
        branchId: parseInt(localStorage.getItem('app_branch_id') || '1'),
        departmentId: parseInt(localStorage.getItem('app_dept_id') || '1'),
        isActive: true,
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  });

  const [currentRole, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('app_role') as UserRole) || 'admin';
  });
  const [currentBranchId, setBranchState] = useState<number>(() => {
    return parseInt(localStorage.getItem('app_branch_id') || '1');
  });
  const [currentDepartmentId, setDeptState] = useState<number>(() => {
    return parseInt(localStorage.getItem('app_dept_id') || '1');
  });
  const [currentUserName, setNameState] = useState<string>(() => {
    return localStorage.getItem('app_user_name') || 'Arthur Pendelton (Admin)';
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const login = async (identifier: string, password?: string): Promise<{ success: boolean; user?: SystemUser; error?: string }> => {
    try {
      const response = await fetchApi<{ success: boolean; user: SystemUser; message?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      if (response && response.user) {
        const u = response.user;
        setAuthenticatedUser(u);
        localStorage.setItem('app_authenticated_user', JSON.stringify(u));
        
        setRoleState(u.role);
        localStorage.setItem('app_role', u.role);

        const branchIdToSet = u.branchId || 1;
        setBranchState(branchIdToSet);
        localStorage.setItem('app_branch_id', branchIdToSet.toString());

        const deptIdToSet = u.departmentId || 1;
        setDeptState(deptIdToSet);
        localStorage.setItem('app_dept_id', deptIdToSet.toString());

        setNameState(u.name);
        localStorage.setItem('app_user_name', u.name);
        localStorage.setItem('app_user_id', u.id.toString());

        showToast(response.message || `Welcome back, ${u.name}!`, 'success');
        await refreshAll();
        return { success: true, user: u };
      }
      return { success: false, error: 'Failed to authenticate user' };
    } catch (err: any) {
      const errMsg = err.message || 'Invalid username or password';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  const logout = () => {
    setAuthenticatedUser(null);
    localStorage.removeItem('app_authenticated_user');
    localStorage.removeItem('app_role');
    localStorage.removeItem('app_user_name');
    localStorage.removeItem('app_user_id');
    showToast('Logged out of session', 'info');
  };

  const setCurrentRole = (role: UserRole) => {
    setRoleState(role);
    localStorage.setItem('app_role', role);
  };

  const setCurrentBranchId = (id: number) => {
    setBranchState(id);
    localStorage.setItem('app_branch_id', id.toString());
  };

  const setCurrentDepartmentId = (id: number) => {
    setDeptState(id);
    localStorage.setItem('app_dept_id', id.toString());
  };

  const setCurrentUserName = (name: string) => {
    setNameState(name);
    localStorage.setItem('app_user_name', name);
  };

  const refreshAll = async () => {
    try {
      const [branchData, deptData, catData, statsData] = await Promise.all([
        fetchApi<Branch[]>('/api/branches'),
        fetchApi<Department[]>('/api/departments'),
        fetchApi<Category[]>('/api/categories'),
        fetchApi<DashboardStats>(`/api/dashboard-stats?branchId=${currentBranchId}`),
      ]);

      setBranches(branchData || []);
      setDepartments(deptData || []);
      setCategories(catData || []);
      setDashboardStats(statsData || null);
    } catch (err) {
      console.error('Failed to load primary metadata:', err);
    }
  };

  const seedDemoData = async () => {
    try {
      showToast('Initializing demo dataset in PostgreSQL...', 'info');
      await fetchApi('/api/seed-demo', { method: 'POST' });
      await refreshAll();
      showToast('Database reset and seeded with full multi-branch demo data!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to seed database', 'error');
    }
  };

  useEffect(() => {
    if (authenticatedUser) {
      refreshAll();
    }
  }, [currentRole, currentBranchId, authenticatedUser]);

  return (
    <AppContext.Provider
      value={{
        authenticatedUser,
        isAuthenticated: !!authenticatedUser,
        login,
        logout,
        currentRole,
        setCurrentRole,
        currentBranchId,
        setCurrentBranchId,
        currentDepartmentId,
        setCurrentDepartmentId,
        currentUserName,
        setCurrentUserName,
        branches,
        departments,
        categories,
        dashboardStats,
        refreshAll,
        seedDemoData,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
