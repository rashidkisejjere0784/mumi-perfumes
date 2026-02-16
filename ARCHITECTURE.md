# Mumi Perfumes POS - System Architecture

## Overview

The Mumi Perfumes POS system is a full-stack web application built using Next.js with server-side API routes and SQLite database. It follows a modern, scalable architecture with clear separation of concerns.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│  (Browser - React Components with Tailwind CSS)            │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │Dashboard │ │Inventory │ │  Sales   │ │ Reports  │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│       │             │             │             │          │
│       └─────────────┴─────────────┴─────────────┘          │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                    HTTP/HTTPS
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                         ▼                                   │
│                   API LAYER (Next.js)                       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │           API Routes (/app/api/*)                  │   │
│  │                                                     │   │
│  │  /perfumes    /stock      /sales    /debt-payments│   │
│  │  /expenses    /investments /dashboard /export     │   │
│  └────────────────────────────────────────────────────┘   │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │          SQLite Database (mumi_perfumes.db)         │ │
│  │                                                      │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │
│  │  │ perfumes │  │  stock_  │  │  sales   │         │ │
│  │  │          │  │  groups  │  │          │         │ │
│  │  └──────────┘  └──────────┘  └──────────┘         │ │
│  │                                                      │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │
│  │  │  sale_   │  │ decant_  │  │  debt_   │         │ │
│  │  │  items   │  │ tracking │  │ payments │         │ │
│  │  └──────────┘  └──────────┘  └──────────┘         │ │
│  │                                                      │ │
│  │  ┌──────────┐  ┌──────────┐                        │ │
│  │  │ expenses │  │investments│                        │ │
│  │  └──────────┘  └──────────┘                        │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema Design

### Entity Relationship Diagram

```
┌──────────────┐
│   perfumes   │
│──────────────│
│ id (PK)      │
│ name         │◄────────┐
│ volume_ml    │         │
│ estimated_   │         │
│  decants     │         │
└──────────────┘         │
                         │
                         │
┌──────────────┐         │
│ stock_groups │         │
│──────────────│         │
│ id (PK)      │         │
│ perfume_id ──┼─────────┘
│ quantity     │
│ buying_cost  │◄────────┐
│ additional_  │         │
│  expenses    │         │
│ total_cost   │         │
│ purchase_date│         │
│ remaining_qty│         │
└──────────────┘         │
      │                  │
      │                  │
      ▼                  │
┌──────────────┐         │
│ decant_      │         │
│  tracking    │         │
│──────────────│         │
│ id (PK)      │         │
│ stock_group_ │         │
│  id (FK)     │         │
│ perfume_id   │         │
│ decants_sold │         │
│ bottles_sold │         │
└──────────────┘         │
                         │
┌──────────────┐         │
│    sales     │         │
│──────────────│         │
│ id (PK)      │         │
│ customer_name│         │
│ payment_     │         │
│  method      │         │
│ total_amount │         │
│ amount_paid  │         │
│ debt_amount  │         │
│ sale_date    │         │
└──────────────┘         │
      │                  │
      │                  │
      ├──────────────────┼────────┐
      │                  │        │
      ▼                  │        ▼
┌──────────────┐         │  ┌──────────────┐
│  sale_items  │         │  │ debt_        │
│──────────────│         │  │  payments    │
│ id (PK)      │         │  │──────────────│
│ sale_id (FK) │         │  │ id (PK)      │
│ perfume_id ──┼─────────┘  │ sale_id (FK) │
│ stock_group_ │            │ amount_paid  │
│  id (FK) ────┼────────────┘ payment_date │
│ sale_type    │            │ payment_     │
│ quantity     │            │  method      │
│ unit_price   │            └──────────────┘
│ subtotal     │
└──────────────┘

┌──────────────┐       ┌──────────────┐
│   expenses   │       │ investments  │
│──────────────│       │──────────────│
│ id (PK)      │       │ id (PK)      │
│ description  │       │ description  │
│ amount       │       │ amount       │
│ category     │       │ investment_  │
│ expense_date │       │  date        │
└──────────────┘       └──────────────┘
```

## API Route Structure

### Authentication & Authorization
Currently, the system operates without authentication. For production deployment, consider adding:
- User authentication (login/logout)
- Role-based access control
- Session management

### API Endpoints

#### Inventory Management
```typescript
GET    /api/perfumes              // List all perfumes
POST   /api/perfumes              // Create new perfume
PUT    /api/perfumes              // Update perfume
DELETE /api/perfumes?id={id}      // Delete perfume

GET    /api/stock                 // List all stock groups
GET    /api/stock?perfume_id={id} // Filter by perfume
POST   /api/stock                 // Add stock group
```

#### Sales Management
```typescript
GET    /api/sales                      // List all sales
GET    /api/sales?with_debt=true       // Filter sales with debt
GET    /api/sales?start_date=...&end_date=... // Filter by date
POST   /api/sales                      // Create new sale

GET    /api/debt-payments?sale_id={id} // List payments for sale
POST   /api/debt-payments              // Record debt payment
```

#### Financial Management
```typescript
GET    /api/expenses                   // List expenses
POST   /api/expenses                   // Create expense
DELETE /api/expenses?id={id}           // Delete expense

GET    /api/investments                // List investments
POST   /api/investments                // Create investment
```

#### Dashboard & Reporting
```typescript
GET    /api/dashboard/financial        // Financial summary
GET    /api/dashboard/sales-stats      // Sales statistics
GET    /api/dashboard/charts?type={type}&days={n} // Chart data

// Chart types: daily, monthly, profit-expense
```

#### Data Export
```typescript
GET    /api/export?type={type}         // Export data

// Export types: database, sales, profit-loss, debt, investment
```

## Financial Calculation Logic

### Total Investment Calculation
```typescript
const stockCosts = SUM(stock_groups.total_cost)
const manualInvestments = SUM(investments.amount)
const totalInvestment = stockCosts + manualInvestments
```

### Revenue Calculation
```typescript
// Only counts money actually received
const totalRevenue = SUM(sales.amount_paid)
// Excludes outstanding debts
```

### Profit Calculations

#### Gross Profit
```typescript
const totalSalesAmount = SUM(sales.total_amount)
const costOfGoodsSold = SUM(stock_groups.total_cost)
const grossProfit = totalSalesAmount - costOfGoodsSold
```

#### Net Profit
```typescript
const totalRevenue = SUM(sales.amount_paid)
const stockCosts = SUM(stock_groups.total_cost)
const additionalExpenses = SUM(expenses.amount)
const netProfit = totalRevenue - stockCosts - additionalExpenses
```

#### Net Position
```typescript
const totalReturns = totalRevenue // Money received back
const totalInvestment = stockCosts + manualInvestments
const netPosition = totalReturns - totalInvestment
// Positive = Profit, Negative = Loss
```

### Outstanding Debts
```typescript
const outstandingDebts = SUM(sales.debt_amount WHERE debt_amount > 0)
```

## Component Structure

### Page Components
- `app/page.tsx` - Dashboard with summary and charts
- `app/inventory/page.tsx` - Inventory management
- `app/sales/page.tsx` - Sales recording and viewing
- `app/expenses/page.tsx` - Expense and investment tracking
- `app/reports/page.tsx` - Detailed financial reports
- `app/export/page.tsx` - Data export interface

### Shared Components
- `components/Navigation.tsx` - Sidebar navigation
- `components/DashboardLayout.tsx` - Page layout wrapper

### Modal Components
Each page contains inline modal components for forms:
- `PerfumeModal` - Add/edit perfumes
- `StockModal` - Add stock groups
- `SaleModal` - Create sales
- `DebtPaymentModal` - Record debt payments
- `ExpenseModal` - Add expenses
- `InvestmentModal` - Record investments

## Data Flow

### Example: Creating a Sale

1. **User Action**: User fills out sale form with items
2. **Client Validation**: Form validates required fields
3. **API Request**: POST to `/api/sales` with sale data
4. **Server Processing**:
   ```typescript
   - Calculate total amount from items
   - Calculate debt (total - amount_paid)
   - Insert into sales table
   - Insert each item into sale_items
   - Update stock_groups.remaining_quantity
   - Update decant_tracking for each stock group
   ```
5. **Response**: Return complete sale with items
6. **UI Update**: Refresh sales list and close modal

### Example: Financial Dashboard

1. **Component Mount**: Dashboard page loads
2. **Parallel API Calls**:
   - GET `/api/dashboard/financial`
   - GET `/api/dashboard/sales-stats`
   - GET `/api/dashboard/charts?type=daily`
   - GET `/api/dashboard/charts?type=monthly`
3. **Server Calculations**:
   - Aggregate data from multiple tables
   - Calculate financial metrics
   - Format chart data
4. **Client Rendering**:
   - Display summary cards
   - Render charts with Recharts
   - Show best-selling products

## Stock Management Logic

### Stock Group Tracking

When adding stock:
```typescript
1. Create stock_group record
2. Set remaining_quantity = quantity
3. Initialize decant_tracking with 0 decants/bottles sold
```

When selling full bottles:
```typescript
1. Deduct from stock_group.remaining_quantity
2. Increment decant_tracking.bottles_sold
```

When selling decants:
```typescript
1. Do NOT deduct from remaining_quantity (bottle still exists)
2. Increment decant_tracking.decants_sold
```

This allows tracking of:
- How many bottles remain unsold
- How many bottles were sold whole
- How many decants were sold from bottles

## Security Considerations

### Current Implementation
- No authentication (suitable for single-user local deployment)
- Input validation on client and server
- SQL injection prevention via parameterized queries
- XSS protection via React's built-in escaping

### Production Recommendations
1. Add user authentication
2. Implement role-based access control
3. Add API rate limiting
4. Use HTTPS in production
5. Implement CSRF protection
6. Add audit logging
7. Regular database backups

## Performance Optimization

### Database
- Indexes on foreign keys and date columns
- WAL mode for better concurrent access
- Prepared statements for frequently used queries

### Frontend
- Client-side caching of reference data
- Lazy loading of large lists
- Debounced search inputs
- Optimistic UI updates

### API
- Efficient SQL queries with proper JOINs
- Minimal data transfer
- Proper HTTP status codes and error handling

## Scalability Path

For growth, consider:

1. **Multi-user Support**: Add authentication and user management
2. **Multiple Locations**: Add store/branch management
3. **Cloud Database**: Migrate from SQLite to PostgreSQL/MySQL
4. **API Separation**: Split into dedicated backend API
5. **Microservices**: Separate inventory, sales, reporting services
6. **Caching Layer**: Add Redis for frequently accessed data
7. **Real-time Updates**: WebSocket for live data sync

## Deployment

### Local Deployment
```bash
npm run build
npm start
```

### Production Deployment Options
1. **Self-hosted**: Deploy on VPS with Node.js
2. **Vercel**: Deploy Next.js app (note: SQLite limitations)
3. **Docker**: Containerize for consistent deployment
4. **Desktop App**: Package with Electron for offline use

## Maintenance

### Regular Tasks
- Weekly database backups
- Monitor disk space for database growth
- Review and clean old records periodically
- Update dependencies for security patches

### Monitoring
- Track database size
- Monitor API response times
- Log errors for debugging
- Track user activity patterns

---

This architecture provides a solid foundation for a retail POS system with room for growth and enhancement based on business needs.
