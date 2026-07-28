import { Router, type Response } from 'express';
import { query, pool } from './db';
import { authenticateToken, type AuthenticatedRequest } from './middleware';

const router = Router();

// --- PUSH SYNC ENDPOINT ---
// Client uploads local offline transactions/mutations
router.post('/push', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { mutations } = req.body; // Array of mutations: { id, table_name, action, payload, created_at }

  if (!mutations || !Array.isArray(mutations)) {
    return res.status(400).json({ error: 'Mutations array is required' });
  }

  const processedIds: string[] = [];
  const errors: any[] = [];

  // Process mutations sequentially inside a transaction wrapper where appropriate
  for (const mutation of mutations) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const payload = JSON.parse(mutation.payload);

      if (mutation.table_name === 'sales') {
        if (mutation.action === 'INSERT') {
          // 1. Insert Sales Header
          await client.query(
            `INSERT INTO sales (id, branch_id, cashier_id, member_id, subtotal, total_discount, grand_total, payment_method, cash_received, cash_change, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING`,
            [
              payload.id,
              payload.branch_id,
              payload.cashier_id,
              payload.member_id,
              payload.subtotal,
              payload.total_discount,
              payload.grand_total,
              payload.payment_method,
              payload.cash_received,
              payload.cash_change,
              payload.created_at
            ]
          );

          // 2. Insert Sales Items and Decrement Inventory
          // The items might be sent in mutation payload or separately. Let's assume payload.items contains them.
          if (payload.items && Array.isArray(payload.items)) {
            for (const item of payload.items) {
              await client.query(
                `INSERT INTO sale_items (id, sale_id, product_id, quantity, price_at_sale, cost_at_sale, discount_percent)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [
                  item.id,
                  payload.id,
                  item.product_id,
                  item.quantity,
                  item.price_at_sale,
                  item.cost_at_sale,
                  item.discount_percent
                ]
              );

              // Strict Per-Store Isolation Stock decrement
              await client.query(
                `UPDATE inventories 
                 SET stock = stock - $1 
                 WHERE product_id = $2 AND branch_id = $3`,
                [item.quantity, item.product_id, payload.branch_id]
              );
            }
          }
        }
      } 
      
      else if (mutation.table_name === 'shift_logs') {
        // Upsert shift log
        await client.query(
          `INSERT INTO shift_logs (id, cashier_id, branch_id, opening_time, closing_time, opening_cash, expected_cash, actual_cash, variance, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE
           SET closing_time = EXCLUDED.closing_time,
               expected_cash = EXCLUDED.expected_cash,
               actual_cash = EXCLUDED.actual_cash,
               variance = EXCLUDED.variance,
               status = EXCLUDED.status`,
          [
            payload.id,
            payload.cashier_id,
            payload.branch_id,
            payload.opening_time,
            payload.closing_time,
            payload.opening_cash,
            payload.expected_cash,
            payload.actual_cash,
            payload.variance,
            payload.status,
            payload.created_at || payload.opening_time
          ]
        );
      } 
      
      else if (mutation.table_name === 'void_audit_trail') {
        await client.query(
          `INSERT INTO void_audit_trail (id, transaction_id, item_id, cashier_id, master_admin_id_authorizer, reason, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            payload.id,
            payload.transaction_id,
            payload.item_id,
            payload.cashier_id,
            payload.master_admin_id_authorizer,
            payload.reason,
            payload.created_at
          ]
        );
      } 
      
      else if (mutation.table_name === 'discount_audit_trail') {
        await client.query(
          `INSERT INTO discount_audit_trail (id, transaction_id, cashier_id, discount_percentage, master_admin_id_authorizer, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            payload.id,
            payload.transaction_id,
            payload.cashier_id,
            payload.discount_percentage,
            payload.master_admin_id_authorizer,
            payload.created_at
          ]
        );
      } 
      
      else if (mutation.table_name === 'stock_claims') {
        // Cashier submits Berita Acara Kerusakan/Kehilangan.
        // The stock is NOT permanently deducted yet, or it is put in a QUARANTINE state.
        // Let's create the claim record.
        await client.query(
          `INSERT INTO stock_claims (id, product_id, branch_id, quantity, reason, notes, photo_evidence, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            payload.id,
            payload.product_id,
            payload.branch_id,
            payload.quantity,
            payload.reason,
            payload.notes,
            payload.photo_evidence,
            'PENDING_APPROVAL', // Force PENDING_APPROVAL on creation
            payload.created_at
          ]
        );

        // Put quantity into quarantine by decreasing active stock. If approved, we do nothing (it remains deducted).
        // If rejected, we add it back.
        await client.query(
          `UPDATE inventories 
           SET stock = stock - $1 
           WHERE product_id = $2 AND branch_id = $3`,
          [payload.quantity, payload.product_id, payload.branch_id]
        );
      }
      
      else if (mutation.table_name === 'stock_transfers') {
        if (mutation.action === 'INSERT') {
          // Insert transfer record
          await client.query(
            `INSERT INTO stock_transfers (id, product_id, from_branch_id, to_branch_id, quantity, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [
              payload.id,
              payload.product_id,
              payload.from_branch_id,
              payload.to_branch_id,
              payload.quantity,
              payload.status,
              payload.created_at
            ]
          );

          // Decrement sender stock
          await client.query(
            `UPDATE inventories 
             SET stock = stock - $1 
             WHERE product_id = $2 AND branch_id = $3`,
            [payload.quantity, payload.product_id, payload.from_branch_id]
          );
        } else if (mutation.action === 'UPDATE') {
          // Update status
          await client.query(
            `UPDATE stock_transfers 
             SET status = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [payload.status, payload.id]
          );

          if (payload.status === 'RECEIVED') {
            // Increment receiver stock
            await client.query(
              `INSERT INTO inventories (product_id, branch_id, stock)
               VALUES ($1, $2, $3)
               ON CONFLICT (product_id, branch_id) DO UPDATE
               SET stock = inventories.stock + EXCLUDED.stock`,
              [payload.product_id, payload.to_branch_id, payload.quantity]
            );
          } else if (payload.status === 'REJECTED') {
            // Restore sender stock
            await client.query(
              `UPDATE inventories 
               SET stock = stock + $1 
               WHERE product_id = $2 AND branch_id = $3`,
              [payload.quantity, payload.product_id, payload.from_branch_id]
            );
          }
        }
      }
      
      else if (mutation.table_name === 'products') {
        if (mutation.action === 'UPDATE') {
          await client.query(
            `UPDATE products 
             SET selling_price = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [payload.selling_price, payload.id]
          );
        }
      }
      
      else if (mutation.table_name === 'inventories') {
        if (mutation.action === 'UPDATE') {
          await client.query(
            `INSERT INTO inventories (product_id, branch_id, stock)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, branch_id) DO UPDATE
             SET stock = EXCLUDED.stock`,
            [payload.product_id, payload.branch_id, payload.stock]
          );
        }
      }

      await client.query('COMMIT');
      processedIds.push(mutation.id);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`Error syncing mutation ${mutation.id}:`, err);
      errors.push({ id: mutation.id, error: err.message });
    } finally {
      client.release();
    }
  }

  res.json({ processedIds, errors });
});

// --- PULL SYNC ENDPOINT ---
// Client requests latest database updates
router.get('/pull', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const lastSyncTime = req.query.last_sync_time as string; // ISO timestamp
  const branchId = req.query.branch_id as string;

  if (!branchId) {
    return res.status(400).json({ error: 'branch_id query parameter is required' });
  }

  try {
    const bindParams: any[] = [];
    let queryFilter = '';

    if (lastSyncTime) {
      bindParams.push(lastSyncTime);
      queryFilter = 'WHERE updated_at > $1';
    }

    // 1. Fetch Products
    const productsRes = await query(
      `SELECT id, barcode, name, category, selling_price, cost_price, max_discount, updated_at 
       FROM products ${queryFilter}`,
      bindParams
    );

    // 2. Fetch Inventories (Only for requesting branch - STRICT ISOLATION)
    const inventoriesRes = await query(
      'SELECT product_id, branch_id, stock FROM inventories WHERE branch_id = $1',
      [branchId]
    );

    // 3. Fetch Users (Only active cashiers + active master admins)
    const usersRes = await query(
      `SELECT id, username, password_hash, pin_hash, role, branch_id, is_active 
       FROM users ${lastSyncTime ? 'WHERE updated_at > $1' : 'WHERE is_active = TRUE'}`,
      lastSyncTime ? [lastSyncTime] : []
    );

    // 4. Fetch Stock Claims status (to update client-side status APPROVED/REJECTED)
    const claimsRes = await query(
      `SELECT id, product_id, branch_id, quantity, reason, notes, photo_evidence, status, created_at 
       FROM stock_claims WHERE branch_id = $1 ${lastSyncTime ? 'AND updated_at > $2' : ''}`,
      lastSyncTime ? [branchId, lastSyncTime] : [branchId]
    );

    // 5. Fetch Stock Transfers involving this branch
    const transfersRes = await query(
      `SELECT id, product_id, from_branch_id, to_branch_id, quantity, status, created_at 
       FROM stock_transfers 
       WHERE (from_branch_id = $1 OR to_branch_id = $1) ${lastSyncTime ? 'AND updated_at > $2' : ''}`,
      lastSyncTime ? [branchId, lastSyncTime] : [branchId]
    );

    res.json({
      serverTime: new Date().toISOString(),
      products: productsRes.rows,
      inventories: inventoriesRes.rows,
      users: usersRes.rows,
      stockClaims: claimsRes.rows,
      stockTransfers: transfersRes.rows
    });
  } catch (error) {
    console.error('Error during sync pull:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
