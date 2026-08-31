import { auth } from './firebase.ts';

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  // Attach Firebase token if user is signed in with Google
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch (err) {
    // Ignore if not logged in via Firebase
  }

  // Attach active role & branch context from localStorage
  const currentRole = localStorage.getItem('app_role') || 'admin';
  const currentBranch = localStorage.getItem('app_branch_id') || '1';
  const currentDept = localStorage.getItem('app_dept_id') || '1';
  const currentUserId = localStorage.getItem('app_user_id') || '1';
  const currentUserName = localStorage.getItem('app_user_name') || 'Arthur Pendelton (Admin)';

  headers.set('x-user-role', currentRole);
  headers.set('x-user-branch', currentBranch);
  headers.set('x-user-department', currentDept);
  headers.set('x-user-id', currentUserId);
  headers.set('x-user-name', currentUserName);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errData = await response.json();
        if (errData.error) errorMsg = errData.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Expected JSON response from ${endpoint} but received ${contentType}: ${text.substring(0, 100)}`);
  }

  return response.json();
}
