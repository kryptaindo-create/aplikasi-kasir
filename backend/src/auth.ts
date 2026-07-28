import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db';
import { authenticateToken, type AuthenticatedRequest } from './middleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey123!';

// --- Helper: Generate JWT ---
const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// --- LOGIN ENDPOINT ---
router.post('/login', async (req, res): Promise<any> => {
  const { username, password, device_identifier } = req.body;

  if (!username || !password || !device_identifier) {
    return res.status(400).json({ error: 'Username, password, and device_identifier are required' });
  }

  try {
    const userRes = await query('SELECT * FROM users WHERE username = $1 AND is_active = TRUE', [username]);
    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const user = userRes.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    // Generate Token
    const token = generateToken(user);

    // --- Anti-MultiLogin Enforcement ---
    // If user already logged in somewhere, this upsert will overwrite the token,
    // thereby invalidating the previous token on their next API request or poll.
    await query(
      `INSERT INTO active_sessions (user_id, device_identifier, token, last_active_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE 
       SET device_identifier = EXCLUDED.device_identifier,
           token = EXCLUDED.token,
           last_active_at = CURRENT_TIMESTAMP`,
      [user.id, device_identifier, token]
    );

    // Log Audit Trail
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'LOGIN', `Logged in from device: ${device_identifier}`]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id
      }
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- VERIFY MASTER PIN (OVERRIDE AUTH) ---
// Cashier client requests an override by submitting the Master Admin PIN.
router.post('/verify-master-pin', async (req, res): Promise<any> => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  try {
    // Find all active Master Admins
    const adminsRes = await query('SELECT id, username, pin_hash FROM users WHERE role = $1 AND is_active = TRUE', ['MASTER_ADMIN']);
    
    if (adminsRes.rowCount === 0) {
      return res.status(404).json({ error: 'Master Admin tidak ditemukan di sistem' });
    }

    // Verify PIN against each master admin's hash (normally there is only one, but we support any active Master Admin PIN)
    let authorizedAdmin = null;
    for (const admin of adminsRes.rows) {
      const match = await bcrypt.compare(pin, admin.pin_hash);
      if (match) {
        authorizedAdmin = admin;
        break;
      }
    }

    if (!authorizedAdmin) {
      return res.status(401).json({ error: 'PIN Master Admin tidak valid' });
    }

    res.json({
      authorized: true,
      master_admin_id: authorizedAdmin.id,
      master_admin_username: authorizedAdmin.username
    });
  } catch (error) {
    console.error('Error verifying master PIN:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- LOGOUT ENDPOINT ---
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await query('DELETE FROM active_sessions WHERE user_id = $1', [req.user.id]);
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'LOGOUT', `Logged out from device: ${req.user.device_identifier}`]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- HEARTBEAT / SESSION CHECK ENDPOINT ---
// Used by client to periodically verify if their session is still valid (Anti-MultiLogin)
router.get('/session-check', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Update last active timestamp
    await query(
      'UPDATE active_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ status: 'ACTIVE', user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
