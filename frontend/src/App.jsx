// frontend/src/App.jsx
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAdmin } from './components/RequireAdmin';

function lazyPage(loader) {
  return lazy(() => loader().then((mod) => ({
    default: (mod ?? {}).default
      ?? (mod ?? {}).MenuPage
      ?? (mod ?? {}).AdminDashboardPage
      ?? (mod ?? {}).LoginPage
      ?? (mod ?? {}).EmployeesPage
      ?? (mod ?? {}).OrdersPage
      ?? (mod ?? {}).PreviousOrdersPage
      ?? (mod ?? {}).TableQrPage
      ?? (mod ?? {}).InsightsPage
      ?? (mod ?? {}).CategoriesPage
      ?? (mod ?? {}).ProductsPage
      ?? (mod ?? {}).ProductCreatePage
      ?? (mod ?? {}).TableEntryPage
      ?? (mod ?? {}).SettingsPage
      ?? (mod ?? {}).DailyReportsPage
      ?? (mod ?? {}).WaiterComplaintsPage
      ?? (mod ?? {}).OffersPage
      ?? (mod ?? {}).CustomerReviewsPage
      ?? (mod ?? {}).VIPCustomersPage
      ?? (() => null)
  })));
}

const MenuPage = lazyPage(() => import('./pages/MenuPage'));
const AdminDashboardPage = lazyPage(() => import('./pages/AdminDashboardPage'));
const LoginPage = lazyPage(() => import('./pages/LoginPage'));
const EmployeesPage = lazyPage(() => import('./pages/EmployeesPage'));
const OrdersPage = lazyPage(() => import('./pages/OrdersPage'));
const PreviousOrdersPage = lazyPage(() => import('./pages/PreviousOrdersPage'));
const TableQrPage = lazyPage(() => import('./pages/TableQrPage'));
const InsightsPage = lazyPage(() => import('./pages/InsightsPage'));
const CategoriesPage = lazyPage(() => import('./pages/CategoriesPage'));
const ProductsPage = lazyPage(() => import('./pages/ProductsPage'));
const ProductCreatePage = lazyPage(() => import('./pages/ProductCreatePage'));
const TableEntryPage = lazyPage(() => import('./pages/TableEntryPage'));
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'));
const DailyReportsPage = lazyPage(() => import('./pages/DailyReportsPage'));
const WaiterComplaintsPage = lazyPage(() => import('./pages/WaiterComplaintsPage'));
const OffersPage = lazyPage(() => import('./pages/OffersPage'));
const CustomerReviewsPage = lazyPage(() => import('./pages/CustomerReviewsPage'));
const VIPCustomersPage = lazyPage(() => import('./pages/VIPCustomersPage'));

export function App() {
  try {
    if (typeof window !== 'undefined') {
      window.__crevoAppRendered = true;
    }
  } catch {
    // Ignore debug failures.
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--site-bg)]" />}>
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/qr/:uuid" element={<TableEntryPage />} />
        <Route path="/t/:uuid" element={<TableEntryPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/admin" element={<RequireAdmin roles={['admin', 'manager']}><AdminDashboardPage /></RequireAdmin>} />
        <Route path="/admin/categories" element={<RequireAdmin roles={['admin', 'manager']}><CategoriesPage /></RequireAdmin>} />
        <Route path="/admin/products" element={<RequireAdmin roles={['admin', 'manager']}><ProductsPage /></RequireAdmin>} />
        <Route path="/admin/products/new" element={<RequireAdmin roles={['admin', 'manager']}><ProductCreatePage /></RequireAdmin>} />
        <Route path="/admin/offers" element={<RequireAdmin roles={['admin', 'manager']}><OffersPage /></RequireAdmin>} />
        <Route path="/admin/qr" element={<RequireAdmin roles={['admin', 'manager']}><TableQrPage /></RequireAdmin>} />
        <Route path="/settings" element={<RequireAdmin roles={['admin']}><SettingsPage /></RequireAdmin>} />
        <Route path="/orders" element={<RequireAdmin roles={['admin', 'manager', 'seller']}><OrdersPage /></RequireAdmin>} />
        <Route path="/orders/previous" element={<RequireAdmin roles={['admin', 'manager']}><PreviousOrdersPage /></RequireAdmin>} />
        <Route path="/employees" element={<RequireAdmin roles={['admin']}><EmployeesPage /></RequireAdmin>} />
        <Route path="/reports/daily" element={<RequireAdmin roles={['admin']}><DailyReportsPage /></RequireAdmin>} />
        <Route path="/reports" element={<RequireAdmin roles={['admin']}><InsightsPage /></RequireAdmin>} />
        <Route path="/insights" element={<RequireAdmin roles={['admin']}><InsightsPage /></RequireAdmin>} />
        <Route path="/admin/customer-reviews" element={<RequireAdmin roles={['admin']}><CustomerReviewsPage /></RequireAdmin>} />
        <Route path="/admin/vip" element={<RequireAdmin roles={['admin', 'manager']}><VIPCustomersPage /></RequireAdmin>} />
        <Route path="/admin/waiter-complaints" element={<RequireAdmin roles={['admin', 'manager', 'waiter']}><WaiterComplaintsPage /></RequireAdmin>} />
      </Routes>
    </Suspense>
  );
}
