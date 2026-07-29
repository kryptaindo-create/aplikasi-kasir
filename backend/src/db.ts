import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// File path for mock database
const dbFilePath = path.join(__dirname, '..', 'db.json');

// Interface for database structure
interface DbStructure {
  branches: any[];
  users: any[];
  products: any[];
  inventories: any[];
  sales: any[];
  sale_items: any[];
  shift_logs: any[];
  void_audit_trail: any[];
  discount_audit_trail: any[];
  stock_claims: any[];
  stock_transfers: any[];
  active_sessions: any[];
  audit_logs: any[];
}

// Initial seed data
const initialData: DbStructure = {
  branches: [
    { id: 'b1000000-0000-0000-0000-000000000001', name: 'WAJAH DIESEL PEREULAK', address: 'Jl. Wajah Diesel Pereulak No. 1', phone: '021-5550001' },
    { id: 'b1000000-0000-0000-0000-000000000002', name: 'WAJAH DIESEL IDIH', address: 'Jl. Wajah Diesel Idih No. 12', phone: '021-5550002' },
    { id: 'b1000000-0000-0000-0000-000000000003', name: 'ASTANA PLASTIK', address: 'Jl. Astana Plastik No. 45', phone: '021-5550003' }
  ],
  users: [
    { id: 'u1000000-0000-0000-0000-000000000001', username: 'owner_admin', password_hash: '$2a$10$tMh7jLwz9f7w8U.Z12n9xe9e5n05y5W.PfeM5o2sHzeuS94.y0F.a', pin_hash: '$2a$10$wO/LzI63y6Z3N8KzH60.veaY/OQ3O7.UeeU3e6E7yN7Y3N.K6e', role: 'MASTER_ADMIN', branch_id: null, is_active: true },
    { id: 'u1000000-0000-0000-0000-000000000002', username: 'kasir_senayan', password_hash: '$2a$10$tMh7jLwz9f7w8U.Z12n9xe9e5n05y5W.PfeM5o2sHzeuS94.y0F.a', pin_hash: '$2a$10$wO/LzI63y6Z3N8KzH60.veaY/OQ3O7.UeeU3e6E7yN7Y3N.K6e', role: 'CASHIER', branch_id: 'b1000000-0000-0000-0000-000000000001', is_active: true },
    { id: 'u1000000-0000-0000-0000-000000000003', username: 'kasir_kemang', password_hash: '$2a$10$tMh7jLwz9f7w8U.Z12n9xe9e5n05y5W.PfeM5o2sHzeuS94.y0F.a', pin_hash: '$2a$10$wO/LzI63y6Z3N8KzH60.veaY/OQ3O7.UeeU3e6E7yN7Y3N.K6e', role: 'CASHIER', branch_id: 'b1000000-0000-0000-0000-000000000002', is_active: true },
    { id: 'u1000000-0000-0000-0000-000000000004', username: 'kasir_gading', password_hash: '$2a$10$tMh7jLwz9f7w8U.Z12n9xe9e5n05y5W.PfeM5o2sHzeuS94.y0F.a', pin_hash: '$2a$10$wO/LzI63y6Z3N8KzH60.veaY/OQ3O7.UeeU3e6E7yN7Y3N.K6e', role: 'CASHIER', branch_id: 'b1000000-0000-0000-0000-000000000003', is_active: true }
  ],
  products: [
    { id: 'p1000000-0000-0000-0000-000000000001', barcode: '8999999123401', name: 'Kopi Susu Gula Aren 250ml', category: 'Minuman', selling_price: 18000.00, cost_price: 10000.00, max_discount: 10.00, updated_at: new Date().toISOString() },
    { id: 'p1000000-0000-0000-0000-000000000002', barcode: '8999999123402', name: 'Roti Bakar Coklat Keju', category: 'Makanan', selling_price: 22000.00, cost_price: 12000.00, max_discount: 10.00, updated_at: new Date().toISOString() },
    { id: 'p1000000-0000-0000-0000-000000000003', barcode: '8999999123403', name: 'Rokok Sampoerna Mild 16', category: 'Tembakau', selling_price: 32000.00, cost_price: 28000.00, max_discount: 5.00, updated_at: new Date().toISOString() },
    { id: 'p1000000-0000-0000-0000-000000000004', barcode: '8999999123404', name: 'Susu Formula SGM Eksplor 1kg', category: 'Kebutuhan Anak', selling_price: 95000.00, cost_price: 80000.00, max_discount: 8.00, updated_at: new Date().toISOString() }
  ],
  inventories: [
    { product_id: 'p1000000-0000-0000-0000-000000000001', branch_id: 'b1000000-0000-0000-0000-000000000001', stock: 50 },
    { product_id: 'p1000000-0000-0000-0000-000000000002', branch_id: 'b1000000-0000-0000-0000-000000000001', stock: 30 },
    { product_id: 'p1000000-0000-0000-0000-000000000003', branch_id: 'b1000000-0000-0000-0000-000000000001', stock: 100 },
    { product_id: 'p1000000-0000-0000-0000-000000000004', branch_id: 'b1000000-0000-0000-0000-000000000001', stock: 20 },
    { product_id: 'p1000000-0000-0000-0000-000000000001', branch_id: 'b1000000-0000-0000-0000-000000000002', stock: 40 },
    { product_id: 'p1000000-0000-0000-0000-000000000002', branch_id: 'b1000000-0000-0000-0000-000000000002', stock: 25 },
    { product_id: 'p1000000-0000-0000-0000-000000000003', branch_id: 'b1000000-0000-0000-0000-000000000002', stock: 80 },
    { product_id: 'p1000000-0000-0000-0000-000000000004', branch_id: 'b1000000-0000-0000-0000-000000000002', stock: 15 },
    { product_id: 'p1000000-0000-0000-0000-000000000001', branch_id: 'b1000000-0000-0000-0000-000000000003', stock: 60 },
    { product_id: 'p1000000-0000-0000-0000-000000000002', branch_id: 'b1000000-0000-0000-0000-000000000003', stock: 35 },
    { product_id: 'p1000000-0000-0000-0000-000000000003', branch_id: 'b1000000-0000-0000-0000-000000000003', stock: 120 },
    { product_id: 'p1000000-0000-0000-0000-000000000004', branch_id: 'b1000000-0000-0000-0000-000000000003', stock: 25 }
  ],
  sales: [],
  sale_items: [],
  shift_logs: [],
  void_audit_trail: [],
  discount_audit_trail: [],
  stock_claims: [],
  stock_transfers: [],
  active_sessions: [],
  audit_logs: []
};

// Database helper functions
const readDb = (): DbStructure => {
  if (!fs.existsSync(dbFilePath)) {
    fs.writeFileSync(dbFilePath, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
  try {
    const raw = fs.readFileSync(dbFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading JSON DB, using initial data:', e);
    return initialData;
  }
};

const writeDb = (data: DbStructure) => {
  fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
};

// Execute a SQL-like mock query
export const query = async (text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> => {
  const data = readDb();
  const sql = text.trim().replace(/\s+/g, ' ');
  let rows: any[] = [];

  // --- 1. active_sessions validation join with users ---
  if (/select.*active_sessions.*join.*users.*token/i.test(sql)) {
    const token = params[0];
    const session = data.active_sessions.find(s => s.token === token);
    if (session) {
      const user = data.users.find(u => u.id === session.user_id);
      if (user) {
        rows = [{
          ...session,
          username: user.username,
          role: user.role,
          branch_id: user.branch_id
        }];
      }
    }
  }
  // --- 2. select active sessions list for dashboard ---
  else if (/select.*active_sessions.*branch_name/i.test(sql)) {
    rows = data.active_sessions.map(s => {
      const user = data.users.find(u => u.id === s.user_id);
      const branch = user ? data.branches.find(b => b.id === user.branch_id) : null;
      return {
        id: s.id,
        device_identifier: s.device_identifier,
        last_active_at: s.last_active_at,
        username: user ? user.username : 'Unknown',
        role: user ? user.role : 'Unknown',
        branch_name: branch ? branch.name : null
      };
    }).sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
  }
  // --- 3. check single active session ---
  else if (/select.*from\s+active_sessions\s+where\s+user_id/i.test(sql)) {
    const userId = params[0];
    rows = data.active_sessions.filter(s => s.user_id === userId);
  }
  // --- 4. select user by username (login) ---
  else if (/select.*from\s+users\s+where\s+username.*is_active/i.test(sql)) {
    const username = params[0];
    rows = data.users.filter(u => u.username === username && u.is_active === true);
  }
  // --- 5. select master admin users ---
  else if (/select.*users\s+where\s+role\s*=\s*\$1/i.test(sql)) {
    const role = params[0];
    rows = data.users.filter(u => u.role === role && u.is_active === true);
  }
  // --- 6. products pull sync ---
  else if (/select.*from\s+products/i.test(sql)) {
    const lastSync = params[0];
    if (lastSync) {
      rows = data.products.filter(p => new Date(p.updated_at).getTime() > new Date(lastSync).getTime());
    } else {
      rows = data.products;
    }
  }
  // --- 7. inventories pull sync ---
  else if (/select.*from\s+inventories\s+where\s+branch_id/i.test(sql)) {
    const branchId = params[0];
    rows = data.inventories.filter(i => i.branch_id === branchId);
  }
  // --- 8. users pull sync ---
  else if (/select.*from\s+users/i.test(sql)) {
    const lastSync = params[0];
    if (lastSync) {
      rows = data.users.filter(u => u.updated_at && new Date(u.updated_at).getTime() > new Date(lastSync).getTime());
    } else {
      rows = data.users.filter(u => u.is_active === true);
    }
  }
  // --- 9. stock_claims pull sync ---
  else if (/select.*from\s+stock_claims\s+where\s+branch_id/i.test(sql)) {
    const branchId = params[0];
    const lastSync = params[1];
    if (lastSync) {
      rows = data.stock_claims.filter(c => c.branch_id === branchId && new Date(c.updated_at || c.created_at).getTime() > new Date(lastSync).getTime());
    } else {
      rows = data.stock_claims.filter(c => c.branch_id === branchId);
    }
  }
  // --- 10. stock_transfers pull sync ---
  else if (/select.*from\s+stock_transfers/i.test(sql)) {
    const branchId = params[0];
    const lastSync = params[1];
    const base = data.stock_transfers.filter(t => t.from_branch_id === branchId || t.to_branch_id === branchId);
    if (lastSync) {
      rows = base.filter(t => new Date(t.updated_at || t.created_at).getTime() > new Date(lastSync).getTime());
    } else {
      rows = base;
    }
  }
  // --- 11. single stock claim by id ---
  else if (/select.*from\s+stock_claims\s+where\s+id\s*=\s*\$1/i.test(sql)) {
    rows = data.stock_claims.filter(c => c.id === params[0]);
  }
  // --- 12. consolidated dashboard reports ---
  else if (/select.*sum\(s\.grand_total\).*from\s+sales/i.test(sql)) {
    let filteredSales = data.sales;
    if (params.length === 2) {
      const start = new Date(params[0]).getTime();
      const end = new Date(params[1]).getTime();
      filteredSales = data.sales.filter(s => {
        const t = new Date(s.created_at).getTime();
        return t >= start && t <= end;
      });
    }
    
    const total_revenue = filteredSales.reduce((sum, s) => sum + Number(s.grand_total), 0);
    const total_transactions = filteredSales.length;
    let total_cost = 0;
    filteredSales.forEach(s => {
      const items = data.sale_items.filter(si => si.sale_id === s.id);
      items.forEach(item => {
        total_cost += Number(item.cost_at_sale) * Number(item.quantity);
      });
    });
    const net_profit = total_revenue - total_cost;

    rows = [{
      total_revenue,
      net_profit,
      total_transactions
    }];
  }
  // --- 13. per branch report breakdown ---
  else if (/select.*branch_id.*branch_name.*from\s+branches/i.test(sql)) {
    rows = data.branches.map(b => {
      let branchSales = data.sales.filter(s => s.branch_id === b.id);
      if (params.length === 2) {
        const start = new Date(params[0]).getTime();
        const end = new Date(params[1]).getTime();
        branchSales = branchSales.filter(s => {
          const t = new Date(s.created_at).getTime();
          return t >= start && t <= end;
        });
      }
      const revenue = branchSales.reduce((sum, s) => sum + Number(s.grand_total), 0);
      const transactions = branchSales.length;
      let cost = 0;
      branchSales.forEach(s => {
        const items = data.sale_items.filter(si => si.sale_id === s.id);
        items.forEach(item => {
          cost += Number(item.cost_at_sale) * Number(item.quantity);
        });
      });
      const net_profit = revenue - cost;
      return {
        branch_id: b.id,
        branch_name: b.name,
        revenue,
        net_profit,
        transactions
      };
    });
  }
  // --- 14. category sales report ---
  else if (/select.*category.*units_sold.*from\s+sale_items/i.test(sql)) {
    let filteredSales = data.sales;
    if (params.length === 2) {
      const start = new Date(params[0]).getTime();
      const end = new Date(params[1]).getTime();
      filteredSales = data.sales.filter(s => {
        const t = new Date(s.created_at).getTime();
        return t >= start && t <= end;
      });
    }
    const saleIds = filteredSales.map(s => s.id);
    const items = data.sale_items.filter(si => saleIds.includes(si.sale_id));
    
    const catMap = new Map<string, { units: number; rev: number }>();
    items.forEach(item => {
      const prod = data.products.find(p => p.id === item.product_id);
      const cat = prod ? prod.category || 'Lainnya' : 'Lainnya';
      const prev = catMap.get(cat) || { units: 0, rev: 0 };
      catMap.set(cat, {
        units: prev.units + Number(item.quantity),
        rev: prev.rev + (Number(item.price_at_sale) * Number(item.quantity))
      });
    });

    rows = Array.from(catMap.entries()).map(([category, stats]) => ({
      category,
      units_sold: stats.units,
      revenue: stats.rev
    })).sort((a, b) => b.revenue - a.revenue);
  }
  // --- 15. void audit logs ---
  else if (/select.*void_audit_trail.*cashier_name/i.test(sql)) {
    rows = data.void_audit_trail.map(v => {
      const cashier = data.users.find(u => u.id === v.cashier_id);
      const authorizer = data.users.find(u => u.id === v.master_admin_id_authorizer);
      return {
        ...v,
        cashier_name: cashier ? cashier.username : 'Unknown',
        authorizer_name: authorizer ? authorizer.username : 'System'
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
  }
  // --- 16. discount audit logs ---
  else if (/select.*discount_audit_trail.*cashier_name/i.test(sql)) {
    rows = data.discount_audit_trail.map(dLog => {
      const cashier = data.users.find(u => u.id === dLog.cashier_id);
      const authorizer = data.users.find(u => u.id === dLog.master_admin_id_authorizer);
      return {
        ...dLog,
        cashier_name: cashier ? cashier.username : 'Unknown',
        authorizer_name: authorizer ? authorizer.username : 'System'
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
  }
  // --- 17. cash discrepancies shift logs ---
  else if (/select.*shift_logs.*variance/i.test(sql)) {
    rows = data.shift_logs.filter(s => s.variance < 0).map(s => {
      const cashier = data.users.find(u => u.id === s.cashier_id);
      const branch = data.branches.find(b => b.id === s.branch_id);
      return {
        ...s,
        cashier_name: cashier ? cashier.username : 'Unknown',
        branch_name: branch ? branch.name : 'Unknown'
      };
    }).sort((a, b) => new Date(b.closing_time).getTime() - new Date(a.closing_time).getTime()).slice(0, 50);
  }
  
  // --- WRITE OPERATONS ---
  // --- 18. INSERT active_sessions ---
  else if (/insert\s+into\s+active_sessions/i.test(sql)) {
    const [user_id, device_identifier, token] = params;
    const existingIdx = data.active_sessions.findIndex(s => s.user_id === user_id);
    const sessionObj = {
      id: crypto.randomUUID(),
      user_id,
      device_identifier,
      token,
      last_active_at: new Date().toISOString()
    };
    if (existingIdx !== -1) {
      data.active_sessions[existingIdx] = sessionObj;
    } else {
      data.active_sessions.push(sessionObj);
    }
    writeDb(data);
  }
  // --- 19. INSERT audit_logs ---
  else if (/insert\s+into\s+audit_logs/i.test(sql)) {
    const [user_id, action, details] = params;
    data.audit_logs.push({
      id: crypto.randomUUID(),
      user_id,
      action,
      details,
      created_at: new Date().toISOString()
    });
    writeDb(data);
  }
  // --- 20. DELETE active_sessions ---
  else if (/delete\s+from\s+active_sessions\s+where\s+user_id/i.test(sql)) {
    const userId = params[0];
    data.active_sessions = data.active_sessions.filter(s => s.user_id !== userId);
    writeDb(data);
  }
  // --- 21. UPDATE active_sessions last_active_at ---
  else if (/update\s+active_sessions\s+set\s+last_active_at/i.test(sql)) {
    const userId = params[0];
    const session = data.active_sessions.find(s => s.user_id === userId);
    if (session) {
      session.last_active_at = new Date().toISOString();
      writeDb(data);
    }
  }
  // --- 22. INSERT sales ---
  else if (/insert\s+into\s+sales/i.test(sql)) {
    const [id, branch_id, cashier_id, member_id, subtotal, total_discount, grand_total, payment_method, cash_received, cash_change, created_at] = params;
    if (!data.sales.find(s => s.id === id)) {
      data.sales.push({
        id, branch_id, cashier_id, member_id, subtotal, total_discount, grand_total, payment_method, cash_received, cash_change,
        created_at: created_at || new Date().toISOString()
      });
      writeDb(data);
    }
  }
  // --- 23. INSERT sale_items ---
  else if (/insert\s+into\s+sale_items/i.test(sql)) {
    const [id, sale_id, product_id, quantity, price_at_sale, cost_at_sale, discount_percent] = params;
    if (!data.sale_items.find(si => si.id === id)) {
      data.sale_items.push({
        id, sale_id, product_id, quantity, price_at_sale, cost_at_sale, discount_percent
      });
      writeDb(data);
    }
  }
  // --- 24. UPDATE inventories decrement stock ---
  else if (/update\s+inventories\s+set\s+stock\s*=\s*stock\s*-\s*\$1/i.test(sql)) {
    const [qty, product_id, branch_id] = params;
    const inv = data.inventories.find(i => i.product_id === product_id && i.branch_id === branch_id);
    if (inv) {
      inv.stock = Number(inv.stock) - Number(qty);
      writeDb(data);
    }
  }
  // --- 25. UPDATE inventories increment stock ---
  else if (/update\s+inventories\s+set\s+stock\s*=\s*stock\s*\+\s*\$1/i.test(sql)) {
    const [qty, product_id, branch_id] = params;
    const inv = data.inventories.find(i => i.product_id === product_id && i.branch_id === branch_id);
    if (inv) {
      inv.stock = Number(inv.stock) + Number(qty);
      writeDb(data);
    }
  }
  // --- 26. INSERT shift_logs with upsert ---
  else if (/insert\s+into\s+shift_logs/i.test(sql)) {
    const [id, cashier_id, branch_id, opening_time, closing_time, opening_cash, expected_cash, actual_cash, variance, status, created_at] = params;
    const idx = data.shift_logs.findIndex(s => s.id === id);
    const shiftObj = {
      id, cashier_id, branch_id, opening_time, closing_time, opening_cash, expected_cash, actual_cash, variance, status,
      created_at: created_at || new Date().toISOString()
    };
    if (idx !== -1) {
      data.shift_logs[idx] = { ...data.shift_logs[idx], ...shiftObj };
    } else {
      data.shift_logs.push(shiftObj);
    }
    writeDb(data);
  }
  // --- 27. INSERT void_audit_trail ---
  else if (/insert\s+into\s+void_audit_trail/i.test(sql)) {
    const [id, transaction_id, item_id, cashier_id, master_admin_id_authorizer, reason, created_at] = params;
    if (!data.void_audit_trail.find(v => v.id === id)) {
      data.void_audit_trail.push({
        id, transaction_id, item_id, cashier_id, master_admin_id_authorizer, reason,
        created_at: created_at || new Date().toISOString()
      });
      writeDb(data);
    }
  }
  // --- 28. INSERT discount_audit_trail ---
  else if (/insert\s+into\s+discount_audit_trail/i.test(sql)) {
    const [id, transaction_id, cashier_id, discount_percentage, master_admin_id_authorizer, created_at] = params;
    if (!data.discount_audit_trail.find(d => d.id === id)) {
      data.discount_audit_trail.push({
        id, transaction_id, cashier_id, discount_percentage, master_admin_id_authorizer,
        created_at: created_at || new Date().toISOString()
      });
      writeDb(data);
    }
  }
  // --- 29. INSERT stock_claims ---
  else if (/insert\s+into\s+stock_claims/i.test(sql)) {
    const [id, product_id, branch_id, quantity, reason, notes, photo_evidence, status, created_at] = params;
    if (!data.stock_claims.find(c => c.id === id)) {
      data.stock_claims.push({
        id, product_id, branch_id, quantity, reason, notes, photo_evidence,
        status: status || 'PENDING_APPROVAL',
        created_at: created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      writeDb(data);
    }
  }
  // --- 30. UPDATE stock_claims status ---
  else if (/update\s+stock_claims\s+set\s+status/i.test(sql)) {
    const [status, claim_id] = params;
    const claim = data.stock_claims.find(c => c.id === claim_id);
    if (claim) {
      claim.status = status;
      claim.updated_at = new Date().toISOString();
      writeDb(data);
    }
  }
  // --- 31. INSERT stock_transfers ---
  else if (/insert\s+into\s+stock_transfers/i.test(sql)) {
    const [id, product_id, from_branch_id, to_branch_id, quantity, status, created_at] = params;
    if (!data.stock_transfers.find(t => t.id === id)) {
      data.stock_transfers.push({
        id, product_id, from_branch_id, to_branch_id, quantity, status,
        created_at: created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      writeDb(data);
    }
  }
  // --- 32. UPDATE stock_transfers status ---
  else if (/update\s+stock_transfers\s+set\s+status/i.test(sql)) {
    const [status, id] = params;
    const transfer = data.stock_transfers.find(t => t.id === id);
    if (transfer) {
      transfer.status = status;
      transfer.updated_at = new Date().toISOString();
      writeDb(data);
    }
  }
  // --- 33. INSERT inventories with conflict (increment) ---
  else if (/insert\s+into\s+inventories/i.test(sql)) {
    const [product_id, branch_id, stock] = params;
    const inv = data.inventories.find(i => i.product_id === product_id && i.branch_id === branch_id);
    if (inv) {
      inv.stock = Number(inv.stock) + Number(stock);
    } else {
      data.inventories.push({ product_id, branch_id, stock });
    }
    writeDb(data);
  }
  // --- 34. INSERT users (create user) ---
  else if (/insert\s+into\s+users/i.test(sql)) {
    const [username, password_hash, pin_hash, role, branch_id] = params;
    const newUser = {
      id: crypto.randomUUID(),
      username,
      password_hash,
      pin_hash,
      role,
      branch_id: branch_id || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.users.push(newUser);
    writeDb(data);
    rows = [newUser];
  }

  return {
    rows,
    rowCount: rows.length
  };
};

// Mock PostgreSQL pool
export const pool = {
  connect: async () => {
    return {
      query: async (text: string, params: any[] = []) => {
        return query(text, params);
      },
      release: () => {}
    };
  },
  query: async (text: string, params: any[] = []) => {
    return query(text, params);
  }
};
