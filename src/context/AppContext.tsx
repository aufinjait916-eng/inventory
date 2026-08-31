import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, Branch, Department, Category, DashboardStats } from '../types.ts';
import { fetchApi } from '../lib/api.ts';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface AppContextType {
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
  
  currentUser: FirebaseUser | null;
  isFirebaseLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  
  refreshAll: () => Promise<void>;
  seedDemoData: () => Promise<void>;
  
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const setCurrentRole = (role: UserRole) => {
    setRoleState(role);
    localStorage.setItem('app_role', role);
    
    // Set typical user name corresponding to role for realistic logs
    let sampleName = 'Arthur Pendelton (Admin)';
    if (role === 'super_manager') sampleName = 'Claire Sterling (Super Manager)';
    else if (role === 'manager') sampleName = 'Robert Fox (Manager)';
    else if (role === 'department') sampleName = 'Assembly Dept Terminal';
    
    setNameState(sampleName);
    localStorage.setItem('app_user_name', sampleName);
    showToast(`Switched active workspace role to ${role.replace('_', ' ').toUpperCase()}`, 'info');
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

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsFirebaseLoading(false);
      if (user) {
        if (user.displayName) {
          setNameState(user.displayName);
          localStorage.setItem('app_user_name', user.displayName);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (result.user.displayName) {
        setNameState(result.user.displayName);
        localStorage.setItem('app_user_name', result.user.displayName);
      }
      showToast(`Signed in as ${result.user.email}`, 'success');
      await refreshAll();
    } catch (err: any) {
      // User dismissed or closed the sign-in popup dialog
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/user-cancelled'
      ) {
        return;
      }
      console.error('Google Sign-in error:', err);
      showToast(err.message || 'Google sign-in failed', 'error');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      showToast('Signed out from Google Auth', 'info');
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
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
    refreshAll();
  }, [currentRole, currentBranchId]);

  return (
    <AppContext.Provider
      value={{
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
        currentUser,
        isFirebaseLoading,
        loginWithGoogle,
        logout,
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
