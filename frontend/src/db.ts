import Dexie, { type Table } from 'dexie';

// --- Interface Definitions ---

export interface User {
  id: string;
  username: string;
  password_hash: string;
  pin_hash: string; // bcrypt or PBKDF2 hash of 6-digit PIN
  role: 'MASTER_ADMIN' | 'CASHIER';
  branch_id: string | null;
  is_active: number; // 1 = true, 0 = false
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  selling_price: number;
  cost_price: number; // Moving Average Cost
  max_discount: number; // default 10.00
  updated_at: string;
  created_at?: string; // Tanggal Masuk Barang
}

export interface Inventory {
  product_id: string;
  branch_id: string;
  stock: number;
}

export interface Sale {
  id: string; // Format: TX-BRANCH_ID-DEVICE_ID-YYYYMMDDHHMMSS-RAND
  branch_id: string;
  cashier_id: string;
  member_id: string | null;
  subtotal: number;
  total_discount: number;
  grand_total: number;
  payment_method: 'CASH' | 'QRIS' | 'DEBIT' | 'RECEIVABLE';
  cash_received: number;
  cash_change: number;
  created_at: string;
  synced: number; // 0 = false, 1 = true
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price_at_sale: number;
  cost_at_sale: number;
  discount_percent: number;
}

export interface ShiftLog {
  id: string;
  cashier_id: string;
  branch_id: string;
  opening_time: string;
  closing_time: string | null;
  opening_cash: number;
  expected_cash: number | null;
  actual_cash: number | null;
  variance: number | null;
  status: 'OPEN' | 'CLOSED';
  synced: number; // 0 = false, 1 = true
}

export interface VoidAuditTrail {
  id: string;
  transaction_id: string;
  item_id: string | null; // NULL if voiding whole transaction
  cashier_id: string;
  master_admin_id_authorizer: string;
  reason: string;
  created_at: string;
  synced: number; // 0 = false, 1 = true
}

export interface DiscountAuditTrail {
  id: string;
  transaction_id: string;
  cashier_id: string;
  discount_percentage: number;
  master_admin_id_authorizer: string;
  created_at: string;
  synced: number; // 0 = false, 1 = true
}

export interface StockClaim {
  id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  reason: string; // 'DAMAGED' | 'LOST' | 'EXPIRED'
  notes: string;
  photo_evidence: string | null; // base64 or local blob URI
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  created_at: string;
  synced: number; // 0 = false, 1 = true
}

export interface StockTransfer {
  id: string;
  product_id: string;
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
  status: 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED';
  created_at: string;
  synced: number; // 0 = false, 1 = true
}

export interface MutationQueue {
  id: string; // UUID
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string; // JSON stringified data
  created_at: string;
}

// --- Dexie Database Class ---

export class LocalPOSDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  inventories!: Table<Inventory>;
  sales!: Table<Sale>;
  sale_items!: Table<SaleItem>;
  shift_logs!: Table<ShiftLog>;
  void_audit_trail!: Table<VoidAuditTrail>;
  discount_audit_trail!: Table<DiscountAuditTrail>;
  stock_claims!: Table<StockClaim>;
  stock_transfers!: Table<StockTransfer>;
  mutation_queue!: Table<MutationQueue>;

  constructor() {
    super('LocalPOSDatabase');
    this.version(1).stores({
      users: 'id, username, role, branch_id',
      products: 'id, &barcode, name, category',
      inventories: '[product_id+branch_id], product_id, branch_id',
      sales: 'id, branch_id, cashier_id, created_at, synced',
      sale_items: 'id, sale_id, product_id',
      shift_logs: 'id, cashier_id, branch_id, status, synced',
      void_audit_trail: 'id, transaction_id, cashier_id, synced',
      discount_audit_trail: 'id, transaction_id, cashier_id, synced',
      stock_claims: 'id, product_id, branch_id, status, synced',
      stock_transfers: 'id, product_id, from_branch_id, to_branch_id, status, synced',
      mutation_queue: 'id, table_name, action, created_at'
    });
  }
}

export const db = new LocalPOSDatabase();
