# Quick Start Guide - Mumi Perfumes POS

## Getting Started in 3 Steps

### 1. Install Dependencies (First Time Only)
```bash
npm install
```

### 2. Start the Application
```bash
npm run dev
```

### 3. Open in Browser
Navigate to [http://localhost:3000](http://localhost:3000)

You'll see a clean login page. Use these credentials to login:
- **Username:** `admin`
- **Password:** `admin123`

**Note:** For security, the default credentials are not shown on the login page.

## First Time Setup

### Step 1: Add Your First Perfume
1. Click **Inventory** in the sidebar
2. Click **Add Perfume**
3. Enter:
   - Perfume name (e.g., "Dior Sauvage")
   - Volume in ml (e.g., 100)
   - Estimated decants per bottle (e.g., 10)
4. Click **Add Perfume**

### Step 2: Add Stock
1. Still in **Inventory**, click **Add Stock**
2. Select the perfume you just added
3. Enter:
   - Quantity of bottles purchased (e.g., 3)
   - Buying cost per bottle (e.g., 150000)
   - Additional expenses like transport (optional)
   - Purchase date
4. Click **Add Stock**
5. The system calculates total cost automatically

### Step 3: Make Your First Sale
1. Click **Sales** in the sidebar
2. Click **New Sale**
3. Add sale items:
   - Click **Add Item**
   - Select perfume and stock group
   - Choose sale type (Full Bottle or Decant)
   - Enter quantity and selling price
4. Enter payment details:
   - Amount paid (can be less than total for credit)
   - Payment method
   - Customer name (optional)
5. Click **Complete Sale**

## Daily Usage

### Recording Sales
- Go to **Sales** → **New Sale**
- For credit sales, enter amount paid less than total
- Track debt payments via **Pay Debt** button

### Checking Financial Status
- **Dashboard** shows overall summary
- **Reports** shows detailed financial analysis
- View daily, monthly, and overall performance

### Managing Expenses
- Click **Expenses** to record operational costs
- Add manual investments for capital tracking
- Both contribute to profit calculations

### Data Export
- Click **Export** to download:
  - Database backups (recommended weekly)
  - Sales reports (CSV format)
  - Financial statements
  - Debt tracking reports

## Common Tasks

### Check Today's Sales
1. Go to **Dashboard**
2. See "Today's Income" card

### View Outstanding Debts
1. Go to **Sales**
2. Look for sales with red debt amounts
3. Click **Pay Debt** to record payments

### See Best Selling Products
1. Go to **Dashboard**
2. Scroll to "Best Selling Perfumes" section

### Export Sales Data
1. Go to **Export**
2. Click on desired export type
3. File downloads automatically

## Understanding Financial Metrics

### Total Investment
- All money you put into the business
- Includes stock costs and manual investments

### Total Revenue
- Money actually received from customers
- Does not include outstanding debts

### Net Position
- Total Returns - Total Investment
- Shows if you're in profit or loss

### Outstanding Debts
- Money owed by customers
- Track and collect via Sales page

## Tips for Success

1. **Regular Backups**: Export database weekly
2. **Stock Management**: Add stock as soon as you purchase
3. **Debt Tracking**: Record customer names for credit sales
4. **Accurate Pricing**: Set prices to cover costs + profit margin
5. **Review Reports**: Check reports weekly to understand trends

## Keyboard Shortcuts

- Use Tab to navigate form fields quickly
- Enter to submit forms
- Esc to close modals

## Mobile Usage

The system is fully responsive:
- Use hamburger menu (☰) in top-left on mobile
- All features work on phones and tablets
- Tables scroll horizontally on small screens

## Getting Help

Check these files in your project:
- `README.md` - Complete documentation
- `ARCHITECTURE.md` - Technical details

## Production Deployment

For production use:
```bash
npm run build
npm start
```

The app runs on port 3000 by default.

---

**Support**: For technical issues, refer to the README or contact your system administrator.

**Version**: 1.0.0
**Last Updated**: February 2026
