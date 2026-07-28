import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey123!';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'MASTER_ADMIN' | 'CASHIER';
    branch_id: string | null;
    device_identifier: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token missing' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // --- Anti-MultiLogin Check ---
    // Check if this token matches the active session in DB
    const sessionRes = await query(
      'SELECT token, device_identifier FROM active_sessions WHERE user_id = $1',
      [decoded.id]
    );

    if (sessionRes.rowCount === 0 || sessionRes.rows[0].token !== token) {
      res.status(401).json({ 
        error: 'SESSION_INVALIDATED', 
        message: 'Akun Anda telah login di perangkat lain.' 
      });
      return;
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      branch_id: decoded.branch_id,
      device_identifier: sessionRes.rows[0].device_identifier
    };

    next();
  } catch (error) {
    res.status(403).json({ error: 'Token is invalid or expired' });
  }
};

export const requireRole = (allowedRoles: ('MASTER_ADMIN' | 'CASHIER')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Akses ditolak: Hak akses tidak mencukupi.' });
      return;
    }

    next();
  };
};
