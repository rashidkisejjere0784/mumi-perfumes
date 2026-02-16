// Database Types
export interface Perfume {
  id: number;
  name: string;
  volume_ml: number;
  estimated_decants_per_bottle: number;
  is_out_of_stock?: number;
  created_at: string;
}

export interface StockGroup {
  id: number;
  shipment_id: number;
  perfume_id: number;
  quantity: number;
  buying_cost_per_bottle: number;
  subtotal_cost: number;
  remaining_quantity: number;
  created_at: string;
}

export interface StockShipment {
  id: number;
  shipment_name?: string;
  transport_cost: number;
  other_expenses: number;
  total_additional_expenses: number;
  purchase_date: string;
  /** 'sales' = re-investment (from sales); 'capital' = new capital (recorded in investments) */
  funded_from: 'sales' | 'capital';
  created_at: string;
}

export interface Sale {
  id: number;
  customer_name?: string;
  payment_method: string;
  total_amount: number;
  amount_paid: number;
  debt_amount: number;
  sale_date: string;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  perfume_id: number;
  stock_group_id: number;
  sale_type: 'full_bottle' | 'decant';
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface DebtPayment {
  id: number;
  sale_id: number;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  created_at: string;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  category?: string;
  expense_date: string;
  created_at: string;
}

export interface Investment {
  id: number;
  description: string;
  amount: number;
  investment_date: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  password_hash?: string;
  full_name: string;
  role: string;
  is_active: number;
  created_at: string;
  last_login?: string;
}

export interface DecantTracking {
  id: number;
  stock_group_id: number;
  perfume_id: number;
  decants_sold: number;
  bottles_sold: number;
  bottles_done?: number;
  created_at: string;
}

export interface DeletedBottleRecord {
  id: number;
  stock_group_id: number;
  perfume_id: number;
  perfume_name: string;
  shipment_name?: string;
  purchase_date?: string;
  quantity_removed: number;
  reason: string;
  note?: string;
  removed_at: string;
}

export interface CustomInventoryItem {
  id: number;
  name: string;
  category: string;
  unit_label?: string;
  default_ml?: number | null;
  is_active: number;
  created_at: string;
}

export interface CustomInventoryCategory {
  id: number;
  name: string;
  description?: string | null;
  is_active: number;
  created_at: string;
}

export interface CustomInventoryStockEntry {
  id: number;
  shipment_id?: number | null;
  item_id: number;
  quantity_added: number;
  remaining_quantity: number;
  unit_cost: number;
  purchase_date: string;
  note?: string;
  item_name: string;
  category: string;
  unit_label?: string;
  default_ml?: number | null;
  shipment_name?: string | null;
  shipment_purchase_date?: string | null;
  shipment_transport_cost?: number | null;
  shipment_other_expenses?: number | null;
  shipment_funded_from?: 'sales' | 'capital' | null;
  created_at: string;
}

// API Request Types
export interface CreatePerfumeRequest {
  name: string;
  volume_ml: number;
  estimated_decants_per_bottle: number;
}

export interface CreateStockGroupRequest {
  shipment_name?: string;
  transport_cost: number;
  other_expenses: number;
  purchase_date: string;
  /** 'sales' = funded from sales (re-investment); 'capital' = new capital (recorded as investment) */
  funded_from?: 'sales' | 'capital';
  items: {
    perfume_id: number;
    quantity: number;
    buying_cost_per_bottle: number;
  }[];
}

export interface CreateSaleRequest {
  customer_name?: string;
  payment_method: string;
  amount_paid: number;
  sale_date: string;
  items: {
    perfume_id: number;
    stock_group_id: number;
    sale_type: 'full_bottle' | 'decant';
    decant_bottle_item_id?: number;
    quantity: number;
    unit_price: number;
  }[];
}

export interface CreateDebtPaymentRequest {
  sale_id: number;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
}

export interface CreateExpenseRequest {
  description: string;
  amount: number;
  category?: string;
  expense_date: string;
}

export interface CreateInvestmentRequest {
  description: string;
  amount: number;
  investment_date: string;
}

// Dashboard Types
/** Standard decant size in ml — used as baseline for cost/profit per decant */
export const DECANT_ML = 10;

export interface FinancialSummary {
  /** Liquid cash in system: cash received from sales - recorded expenses */
  total_revenue: number;
  /** Gross sales value (sum of sale total_amount) */
  total_sales_amount: number;
  total_expenses: number;
  /** Total capital (manual investments only) */
  total_capital: number;
  /** Total invested = total capital + re-investment in stock */
  total_investment: number;
  /** Total money in stock (perfume subtotals + shipment expenses) */
  amount_invested_in_stock: number;
  /** Profit from sales only */
  profit_from_sales: number;
  /** Cost of goods sold for items actually sold */
  cost_of_goods_sold: number;
  net_profit: number;
  gross_profit: number;
  outstanding_debts: number;
  daily_income: number;
  monthly_income: number;
  total_returns: number;
  net_position: number;
}

export interface SalesStats {
  total_sales: number;
  full_bottle_sales: number;
  decant_sales: number;
  full_bottles_available: number;
  full_bottles_sold: number;
  decants_available_estimated: number;
  total_sold_units: number;
  best_selling_perfumes: {
    perfume_name: string;
    total_quantity: number;
    total_revenue: number;
  }[];
}

export interface StockWithDetails extends StockGroup {
  perfume_name: string;
  purchase_date: string;
  transport_cost: number;
  other_expenses: number;
  shipment_name?: string;
  funded_from?: 'sales' | 'capital';
  decants_sold?: number;
  bottles_sold?: number;
  bottles_done?: number;
  completed_bottle_decants?: number;
}

export interface SaleWithDetails extends Sale {
  items: (SaleItem & { perfume_name: string })[];
  payments?: DebtPayment[];
}

// Profit tracking (profit = revenue only after bottle/stock cost is recovered)
export interface ProfitItemDetail {
  perfume_name: string;
  perfume_id: number;
  sale_type: 'full_bottle' | 'decant';
  quantity: number;
  unit_price: number;
  subtotal: number;
  /** Amount of this sale's revenue that went to recovering the stock's cost */
  cost: number;
  /** Profit from this line (revenue − cost recovery) */
  profit: number;
  /** Explains how profit was calculated (cost recovery vs profit) */
  calculation_note: string;
}

export interface ProfitBySale {
  sale_id: number;
  sale_date: string;
  customer_name: string | null;
  total_amount: number;
  total_cost: number;
  total_profit: number;
  items: ProfitItemDetail[];
}

export interface ProfitByPerfume {
  perfume_id: number;
  perfume_name: string;
  total_quantity: number;
  total_sales_value: number;
  total_cost: number;
  profit: number;
  full_bottle_qty: number;
  decant_qty: number;
}

export interface ProfitBreakdown {
  total_sales_value: number;
  total_cost: number;
  total_profit: number;
  by_perfume: ProfitByPerfume[];
  by_sale: ProfitBySale[];
}

export interface ShipmentGroup {
  shipment_id: number;
  shipment_name?: string | null;
  purchase_date: string;
  funded_from?: 'sales' | 'capital';
  transport_cost: number;
  other_expenses: number;
  items: StockWithDetails[];
  custom_items: CustomInventoryStockEntry[];
  total_items: number;
  total_remaining: number;
  total_cost: number;
}
