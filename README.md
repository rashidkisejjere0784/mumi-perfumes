# Mumi Perfumes POS System

A comprehensive Point of Sale (POS) system built with Next.js, TypeScript, and SQLite for managing perfume retail operations.

## 🔐 Login Required

The system now includes **user authentication**. You'll need to login before accessing any features.

**Default Admin Account:**
- Username: `admin`
- Password: `admin123`

⚠️ **IMPORTANT SECURITY NOTES:**
- The default password is NOT displayed on the login page for security
- Change the default password immediately after first login
- Keep your credentials secure and confidential

## Features

### 🔐 Authentication & User Management
- Secure login with JWT tokens
- Role-based access control (Admin/User)
- User management (admin only)
- Password encryption with bcrypt
- Session management

### 1. Inventory Management
- Add and manage perfume products with details (name, volume, estimated decants)
- **Shipment-based stock management:** Add multiple perfumes in one purchase with shared transport costs
- Track stock in groups/batches with purchase costs and expenses
- Monitor remaining stock levels
- Track actual decants and bottles sold per stock group
- Edit perfume details and delete unused perfumes
- View detailed stock history

### 2. Sales Management
- Record full bottle and decant sales
- Multiple payment methods (Cash, Mobile Money, Bank Transfer, Credit)
- Credit/debt tracking with payment history
- Automatic stock deduction
- Customer information recording

### 3. Financial Tracking
- Real-time financial dashboard
- Total investment calculation (stock costs + manual investments)
- Revenue tracking (actual payments received)
- Profit and loss calculations
- Outstanding debt monitoring
- Daily and monthly income reports
- Net position (profit/loss relative to investment)

### 4. Reports & Analytics
- Interactive charts and visualizations
- Daily revenue trends
- Monthly revenue analysis
- Profit vs expenses comparison
- Best-selling perfumes
- Sales type distribution (bottles vs decants)

### 5. Data Export
- Complete database backup
- CSV exports for:
  - Sales reports
  - Profit & loss statements
  - Debt reports
  - Investment reports

## Technology Stack

- **Frontend & Backend**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date Utilities**: date-fns

## Installation

1. Clone or download the project
2. Install dependencies:
```bash
npm install
```

3. (Optional) Configure environment variables:
```bash
# Create .env.local and add:
JWT_SECRET=your-secret-key-here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

6. Login with default admin credentials:
   - Username: `admin`
   - Password: `admin123`

**Important:** The default credentials are not shown on the login page for security. Please change the default password immediately after first login by going to Users → Edit admin user.

## Database Schema

### Tables

1. **users** - System users and authentication
2. **perfumes** - Perfume product catalog
3. **stock_groups** - Stock purchase batches
4. **sales** - Sales transactions
5. **sale_items** - Individual items in each sale
6. **decant_tracking** - Tracks decants and bottles sold per stock group
7. **debt_payments** - Debt repayment records
8. **expenses** - Additional business expenses
9. **investments** - Manual investment tracking

### Key Relationships

- Stock groups belong to perfumes
- Sale items reference sales, perfumes, and stock groups
- Decant tracking links to stock groups
- Debt payments link to sales

## Financial Calculations

### Total Investment
```
Stock Costs + Manual Investments
```

### Total Revenue
```
Sum of all amounts actually paid (excludes outstanding debts)
```

### Gross Profit
```
Total Sales Amount - Cost of Goods Sold (Stock Costs)
```

### Net Profit
```
Total Revenue - Total Expenses (Stock + Additional)
```

### Net Position
```
Total Returns - Total Investment
(Shows profit/loss relative to capital invested)
```

## API Routes

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout  
- `GET /api/auth/me` - Get current user

### User Management (Admin Only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users` - Update user
- `DELETE /api/users?id=<id>` - Delete user

### Perfumes
- `GET /api/perfumes` - List all perfumes
- `POST /api/perfumes` - Create perfume
- `PUT /api/perfumes` - Update perfume
- `DELETE /api/perfumes?id=<id>` - Delete perfume

### Stock
- `GET /api/stock` - List stock groups
- `GET /api/stock?perfume_id=<id>` - List stock for specific perfume
- `POST /api/stock` - Add stock group

### Sales
- `GET /api/sales` - List all sales
- `GET /api/sales?with_debt=true` - List sales with debt
- `POST /api/sales` - Create sale

### Debt Payments
- `GET /api/debt-payments?sale_id=<id>` - List payments for sale
- `POST /api/debt-payments` - Record payment

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `DELETE /api/expenses?id=<id>` - Delete expense

### Investments
- `GET /api/investments` - List investments
- `POST /api/investments` - Create investment

### Dashboard
- `GET /api/dashboard/financial` - Financial summary
- `GET /api/dashboard/sales-stats` - Sales statistics
- `GET /api/dashboard/charts?type=<type>` - Chart data

### Export
- `GET /api/export?type=<type>` - Export data (database, sales, profit-loss, debt, investment)

## Usage Guide

### Adding Inventory

1. Navigate to **Inventory** page
2. Click **Add Perfume** to create a new perfume product
3. Click **Add Stock** to record a stock purchase
4. Enter quantity, cost per bottle, and any additional expenses
5. System automatically calculates total cost

### Making a Sale

1. Navigate to **Sales** page
2. Click **New Sale**
3. Add sale items (select perfume, stock group, type, quantity, price)
4. Enter amount paid (can be less than total for credit sales)
5. System automatically updates stock and tracks debts

### Recording Debt Payments

1. Go to **Sales** page
2. Find sale with outstanding debt
3. Click **Pay Debt**
4. Enter payment amount and details
5. System updates debt balance automatically

### Managing Expenses

1. Navigate to **Expenses** page
2. Click **Add Expense** for operational costs
3. Click **Add Investment** for capital investments
4. Both are tracked separately in financial calculations

### Viewing Reports

1. **Dashboard** - Overview with key metrics and charts
2. **Reports** - Detailed financial analysis and trends
3. **Export** - Download data for external analysis

## Responsive Design

The system is fully responsive and optimized for:
- Mobile phones (portrait and landscape)
- Tablets
- Laptops
- Desktop screens

Navigation automatically adapts with a mobile menu on smaller screens.

## Data Backup

**Important**: Regularly backup your database by:
1. Going to **Export** page
2. Clicking **Export** on "Database Backup"
3. Store the `.db` file safely

The database file is also located at: `mumi_perfumes.db` in the project root.

## Development

### Project Structure

```
├── app/
│   ├── api/           # API routes
│   ├── inventory/     # Inventory page
│   ├── sales/         # Sales page
│   ├── expenses/      # Expenses page
│   ├── reports/       # Reports page
│   ├── export/        # Export page
│   ├── layout.tsx     # Root layout
│   ├── page.tsx       # Dashboard
│   └── globals.css    # Global styles
├── components/
│   ├── Navigation.tsx
│   └── DashboardLayout.tsx
├── lib/
│   ├── database.ts    # Database initialization
│   └── types.ts       # TypeScript types
└── mumi_perfumes.db   # SQLite database (generated)
```

### Building for Production

```bash
npm run build
npm start
```

## Notes

- Decants are estimated values - the system tracks actual decants sold
- Stock can have discrepancies due to spillage or loss
- All amounts are in Ugandan Shillings (UGX)
- Date format: YYYY-MM-DD
- Database uses WAL mode for better performance

## Support

For issues or questions, refer to this documentation or check the code comments in the source files.

Additional documentation:
- `AUTHENTICATION.md` - Login and user management
- `ARCHITECTURE.md` - System architecture
- `QUICKSTART.md` - Quick start guide
- `SHIPMENT_MANAGEMENT.md` - Stock shipment feature guide

## License

Proprietary - Mumi Perfumes

---

Built with ❤️ for Mumi Perfumes
