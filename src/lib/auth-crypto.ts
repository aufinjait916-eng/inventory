import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Checks if a stored password string is already a valid bcrypt hash
 */
export function isPasswordHashed(password: string | null | undefined): boolean {
  if (!password) return false;
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(password);
}

/**
 * Strongly encrypts / hashes a plain text password with salted bcrypt (12 rounds)
 */
export function hashPassword(plainPassword: string): string {
  if (!plainPassword) {
    throw new Error('Password cannot be empty');
  }
  return bcrypt.hashSync(plainPassword, BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash or legacy string
 */
export function verifyPassword(
  plainPassword: string,
  storedPasswordHash: string | null | undefined,
  userRole?: string
): boolean {
  if (!plainPassword) return false;

  // 1. If stored as a valid bcrypt hash
  if (storedPasswordHash && isPasswordHashed(storedPasswordHash)) {
    try {
      return bcrypt.compareSync(plainPassword, storedPasswordHash);
    } catch {
      return false;
    }
  }

  // 2. Backward-compatible legacy plaintext check (for unmigrated database records)
  if (storedPasswordHash && !isPasswordHashed(storedPasswordHash)) {
    if (storedPasswordHash === plainPassword) {
      return true;
    }
  }

  // 3. Fallback standard default passwords for legacy accounts without explicit passwords
  if (!storedPasswordHash) {
    if (userRole === 'admin' && (plainPassword === 'admin' || plainPassword === 'admin123')) return true;
    if (userRole === 'super_manager' && (plainPassword === 'super' || plainPassword === 'super123')) return true;
    if (userRole === 'manager' && (plainPassword === 'manager' || plainPassword === 'manager123')) return true;
    if (userRole === 'department' && (plainPassword === 'dept' || plainPassword === 'dept123')) return true;
    if (plainPassword === 'welcome123' || plainPassword === 'password123') return true;
  }

  return false;
}
