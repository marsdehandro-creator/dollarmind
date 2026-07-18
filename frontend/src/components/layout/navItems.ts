/**
 * Shared navigation model for the sidebar and bottom nav.
 */
export interface NavItem {
  to: string;
  label: string;
  short: string;
  end?: boolean;
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', end: true },
  { to: '/salary', label: 'Salary', short: 'Salary' },
  { to: '/statements', label: 'Statements', short: 'Stmts' },
  { to: '/transactions', label: 'Transactions', short: 'Txns' },
  { to: '/categories', label: 'Categories', short: 'Cats' },
  { to: '/expenses', label: 'Manual Expenses', short: 'Cash+' },
  { to: '/cash', label: 'Cash Tracking', short: 'Cash' },
  { to: '/spending', label: 'Spending', short: 'Spend' },
  { to: '/goals', label: 'Goals', short: 'Goals' },
  { to: '/issues', label: 'Issues', short: 'Issues' },
  { to: '/sars', label: 'SARS', short: 'SARS' },
  { to: '/settings', label: 'Settings', short: 'Settings' },
  { to: '/sessions', label: 'Sessions', short: 'Sess' },
];
