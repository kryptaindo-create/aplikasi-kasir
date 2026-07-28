import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, pool } from './db';
import { authenticateToken, requireRole, type AuthenticatedRequest } from './middleware';

const router = Router();

// Ensure all routes in this router require MASTER_ADMIN role
router.use(authenticateToken);
router.use(requireRole(['MASTER_ADMIN']));

// --- 1. USER MANAGEMENT: CREATE USER ---
router.post('/users', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { username, password, pin, role, branch_id } = req.body;

  if (!username || !password || !pin || !role) {
    return res.status(400).json({ error: 'Username, password, pin, and role are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const pinHash = await bcrypt.hash(pin, salt);

    const userRes = await query(
      `INSERT INTO users (username, password_hash, pin_hash, role, branch_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, role, branch_id`,
      [username, passwordHash, pinHash, role, branch_id || null]
    );

    res.status(201).json(userRes.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- 2. STOCK CLAIM APPROVAL: APPROVE/REJECT BERITA ACARA ---
router.post('/claims/approve', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { claim_id, approve } = req.body; // approve: boolean

  if (!claim_id || approve === undefined) {
    return res.status(400).json({ error: 'claim_id and approve (boolean) are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch claim details
    const claimRes = await client.query('SELECT * FROM stock_claims WHERE id = $1', [claim_id]);
    if (claimRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan berita acara tidak ditemukan' });
    }

    const claim = claimRes.rows[0];

    if (claim.status !== 'PENDING_APPROVAL') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pengajuan sudah diproses sebelumnya' });
    }

    const newStatus = approve ? 'APPROVED' : 'REJECTED';

    // 2. Update claim status
    await client.query(
      'UPDATE stock_claims SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStatus, claim_id]
    );

    // 3. If REJECTED, restore the stock back to the branch active inventory
    // (Since stock was decremented locally/upon syncing when the claim was submitted)
    if (!approve) {
      await client.query(
        `INSERT INTO inventories (product_id, branch_id, stock)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, branch_id) DO UPDATE
         SET stock = inventories.stock + EXCLUDED.stock`,
        [claim.product_id, claim.branch_id, claim.quantity]
      );
    }

    // Log the approval action
    await client.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user!.id, 'CLAIM_APPROVAL', `Processed claim ${claim_id} with status: ${newStatus}`]
    );

    await client.query('COMMIT');
    res.json({ message: `Pengajuan berhasil di-${newStatus}`, status: newStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving claim:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// --- 3. CONSOLIDATED FINANCIAL REPORT ---
// Owner views total revenue, net profit, transaction count (total or per-branch)
router.get('/reports/consolidated', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { start_date, end_date } = req.query; // format YYYY-MM-DD

  try {
    const bindParams: any[] = [];
    let dateFilter = '';

    if (start_date && end_date) {
      bindParams.push(`${start_date} 00:00:00+07`);
      bindParams.push(`${end_date} 23:59:59+07`);
      dateFilter = 'WHERE s.created_at >= $1 AND s.created_at <= $2';
    }

    // Consolidated metrics
    const metricsRes = await query(
      `SELECT 
         COALESCE(SUM(s.grand_total), 0) AS total_revenue,
         COALESCE(SUM(s.grand_total - (
           SELECT SUM(si.cost_at_sale * si.quantity) 
           FROM sale_items si 
           WHERE si.sale_id = s.id
         )), 0) AS net_profit,
         COUNT(s.id) AS total_transactions
       FROM sales s
       ${dateFilter}`,
      bindParams
    );

    // Per branch breakdown
    const branchBreakdownRes = await query(
      `SELECT 
         b.id AS branch_id,
         b.name AS branch_name,
         COALESCE(SUM(s.grand_total), 0) AS revenue,
         COALESCE(SUM(s.grand_total - (
           SELECT SUM(si.cost_at_sale * si.quantity) 
           FROM sale_items si 
           WHERE si.sale_id = s.id
         )), 0) AS net_profit,
         COUNT(s.id) AS transactions
       FROM branches b
       LEFT JOIN sales s ON s.branch_id = b.id ${start_date && end_date ? 'AND s.created_at >= $1 AND s.created_at <= $2' : ''}
       GROUP BY b.id, b.name`,
      bindParams
    );

    // Sales by category
    const categorySalesRes = await query(
      `SELECT 
         p.category,
         COALESCE(SUM(si.quantity), 0) AS units_sold,
         COALESCE(SUM(si.price_at_sale * si.quantity), 0) AS revenue
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       JOIN sales s ON si.sale_id = s.id
       ${dateFilter}
       GROUP BY p.category
       ORDER BY revenue DESC`,
      bindParams
    );

    res.json({
      consolidated: metricsRes.rows[0],
      branches: branchBreakdownRes.rows,
      categories: categorySalesRes.rows
    });
  } catch (error) {
    console.error('Error generating consolidated reports:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- 4. FRAUD LOGS & AUDIT TRAIL MONITORING ---
router.get('/fraud-logs', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    // A. Void Audit Logs
    const voids = await query(
      `SELECT v.*, u1.username AS cashier_name, u2.username AS authorizer_name
       FROM void_audit_trail v
       JOIN users u1 ON v.cashier_id = u1.id
       JOIN users u2 ON v.master_admin_id_authorizer = u2.id
       ORDER BY v.created_at DESC LIMIT 50`
    );

    // B. Discount Audit Logs
    const discounts = await query(
      `SELECT d.*, u1.username AS cashier_name, u2.username AS authorizer_name
       FROM discount_audit_trail d
       JOIN users u1 ON d.cashier_id = u1.id
       JOIN users u2 ON d.master_admin_id_authorizer = u2.id
       ORDER BY d.created_at DESC LIMIT 50`
    );

    // C. Cash Discrepancies (Minus deviations from shift logs)
    const discrepancies = await query(
      `SELECT s.*, u.username AS cashier_name, b.name AS branch_name
       FROM shift_logs s
       JOIN users u ON s.cashier_id = u.id
       JOIN branches b ON s.branch_id = b.id
       WHERE s.variance < 0
       ORDER BY s.closing_time DESC LIMIT 50`
    );

    res.json({
      voids: voids.rows,
      discounts: discounts.rows,
      discrepancies: discrepancies.rows
    });
  } catch (error) {
    console.error('Error fetching fraud logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- 5. ACTIVE SESSIONS LIST ---
router.get('/active-sessions', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const sessions = await query(
      `SELECT s.id, s.device_identifier, s.last_active_at, u.username, u.role, b.name AS branch_name
       FROM active_sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN branches b ON u.branch_id = b.id
       ORDER BY s.last_active_at DESC`
    );
    res.json(sessions.rows);
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// --- 7. INVENTORY STOCK UPDATE ---
router.put('/inventories/:productId/:branchId', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { productId, branchId } = req.params;
  const { stock } = req.body;

  if (stock === undefined || isNaN(Number(stock))) {
    return res.status(400).json({ error: 'Stock quantity is required and must be a number' });
  }

  try {
    // Upsert inventory record
    const result = await query(
      `INSERT INTO inventories (product_id, branch_id, stock)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, branch_id) DO UPDATE
       SET stock = EXCLUDED.stock
       RETURNING *`,
      [productId, branchId, Number(stock)]
    );

    // Log the stock adjustment action
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user!.id, 'INVENTORY_STOCK_UPDATE', `Adjusted product ${productId} stock in branch ${branchId} to ${stock}`]
    );

    res.json({ message: 'Inventory stock updated successfully', inventory: result.rows[0] });
  } catch (error) {
    console.error('Error updating inventory stock:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- 8. CREATE NEW PRODUCT ---
router.post('/products', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { barcode, name, category, selling_price, cost_price, max_discount, initial_stocks } = req.body;
  // initial_stocks: Record<branch_id, stock>

  if (!barcode || !name || !category || selling_price === undefined || cost_price === undefined) {
    return res.status(400).json({ error: 'barcode, name, category, selling_price, dan cost_price wajib diisi' });
  }

  try {
    // 1. Insert product
    const productRes = await query(
      `INSERT INTO products (barcode, name, category, selling_price, cost_price, max_discount, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING *`,
      [barcode, name, category, Number(selling_price), Number(cost_price), Number(max_discount || 10)]
    );

    const product = productRes.rows[0];

    // 2. Insert initial inventories for each provided branch
    if (initial_stocks && typeof initial_stocks === 'object') {
      for (const [branchId, stock] of Object.entries(initial_stocks)) {
        await query(
          `INSERT INTO inventories (product_id, branch_id, stock)
           VALUES ($1, $2, $3)
           ON CONFLICT (product_id, branch_id) DO UPDATE SET stock = EXCLUDED.stock`,
          [product.id, branchId, Number(stock) || 0]
        );
      }
    }

    // 3. Audit log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user!.id, 'PRODUCT_CREATED', `Created new product: ${name} (barcode: ${barcode})`]
    );

    res.status(201).json({ message: 'Produk berhasil ditambahkan', product });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Barcode sudah digunakan oleh produk lain' });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- 6. PRODUCT UPDATE (price + cost) ---
router.put('/products/:id', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const { selling_price, cost_price, category, max_discount } = req.body;

  if (selling_price === undefined || isNaN(Number(selling_price))) {
    return res.status(400).json({ error: 'Selling price is required and must be a number' });
  }

  try {
    const result = await query(
      `UPDATE products 
       SET selling_price = $1, cost_price = COALESCE($2, cost_price), category = COALESCE($3, category), max_discount = COALESCE($4, max_discount), updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [Number(selling_price), cost_price !== undefined ? Number(cost_price) : null, category || null, max_discount !== undefined ? Number(max_discount) : null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user!.id, 'PRODUCT_PRICE_UPDATE', `Updated product ${id}: sell=${selling_price}, cost=${cost_price}`]
    );

    res.json({ message: 'Product updated successfully', product: result.rows[0] });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

