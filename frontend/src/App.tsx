/**
 * Root component and route map.
 *
 * /login is public-only (authed users are bounced to the dashboard). Everything
 * else is behind ProtectedRoute and rendered inside the AppShell (sidebar +
 * header). Unknown authenticated routes render a 404 within the shell.
 * See docs/requirements.md §5.
 */
import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SplashScreen } from './components/brand/SplashScreen.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';
import { PublicOnlyRoute } from './components/auth/PublicOnlyRoute.js';
import { AppShell } from './components/layout/AppShell.js';
import { LoginPage } from './pages/LoginPage/index.js';
import { DashboardPage } from './pages/DashboardPage/index.js';
import { SalaryPage } from './pages/SalaryPage/index.js';
import { StatementPage } from './pages/StatementPage/index.js';
import { TransactionsPage } from './pages/TransactionsPage.js';
import { CategoryPage } from './pages/CategoryPage/index.js';
import { SpendingPage } from './pages/SpendingPage/index.js';
import { ManualExpensesPage } from './pages/ManualExpensesPage/index.js';
import { CashTrackingPage } from './pages/CashTrackingPage/index.js';
import { SettingsPage } from './pages/SettingsPage/index.js';
import { GoalsPage } from './pages/GoalsPage.js';
import { IssuesPage } from './pages/IssuesPage.js';
import { SarsGuidancePage } from './pages/SarsGuidancePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1400);
    return () => clearTimeout(t);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="salary" element={<SalaryPage />} />
          <Route path="statements" element={<StatementPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="categories" element={<CategoryPage />} />
          <Route path="spending" element={<SpendingPage />} />
          <Route path="expenses" element={<ManualExpensesPage />} />
          <Route path="cash" element={<CashTrackingPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="sars" element={<SarsGuidancePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
