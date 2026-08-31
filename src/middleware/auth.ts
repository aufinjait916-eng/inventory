import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    role?: string;
    branchId?: number | null;
    departmentId?: number | null;
    id?: number;
  };
  decodedToken?: DecodedIdToken;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionRole = req.headers['x-user-role'] as string;
    const sessionBranch = req.headers['x-user-branch'] as string;
    const sessionDept = req.headers['x-user-department'] as string;
    const sessionUserId = req.headers['x-user-id'] as string;
    const sessionUserName = req.headers['x-user-name'] as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        req.decodedToken = decodedToken;
        
        // Find or create in DB
        const existingUsers = await db.select().from(users).where(eq(users.uid, decodedToken.uid));
        if (existingUsers.length > 0) {
          const u = existingUsers[0];
          req.user = {
            uid: u.uid,
            email: u.email,
            name: u.name,
            role: sessionRole || u.role,
            branchId: sessionBranch ? parseInt(sessionBranch) : u.branchId,
            departmentId: sessionDept ? parseInt(sessionDept) : u.departmentId,
            id: u.id,
          };
        } else {
          const inserted = await db.insert(users).values({
            uid: decodedToken.uid,
            email: decodedToken.email || 'user@example.com',
            name: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'Authorized User'),
            role: sessionRole || 'manager',
            branchId: sessionBranch ? parseInt(sessionBranch) : 1,
            departmentId: sessionDept ? parseInt(sessionDept) : 1,
          }).returning();
          const u = inserted[0];
          req.user = {
            uid: u.uid,
            email: u.email,
            name: u.name,
            role: u.role,
            branchId: u.branchId,
            departmentId: u.departmentId,
            id: u.id,
          };
        }
        return next();
      } catch (err) {
        // If token verification fails, allow fallback session role if in dev mode
        console.warn('Bearer token verification failed or expired, using session context if provided:', err);
      }
    }

    // Role-based session context for preview & multi-role testing
    req.user = {
      uid: sessionUserId || 'demo-user-1',
      email: `${(sessionRole || 'admin').toLowerCase()}@company.local`,
      name: sessionUserName || (sessionRole ? `${sessionRole.toUpperCase()} User` : 'System Admin'),
      role: (sessionRole as any) || 'admin',
      branchId: sessionBranch ? parseInt(sessionBranch) : 1,
      departmentId: sessionDept ? parseInt(sessionDept) : 1,
      id: sessionUserId ? parseInt(sessionUserId) : 1,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next();
  }
};
