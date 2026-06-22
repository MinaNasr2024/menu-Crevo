import { Navigate, Route, Routes } from 'react-router-dom';
import { MenuPage } from './pages/MenuPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { OrdersPage } from './pages/OrdersPage';
import { TableQrPage } from './pages/TableQrPage';
import { InsightsPage } from './pages/InsightsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductCreatePage } from './pages/ProductCreatePage';
import { TableEntryPage } from './pages/TableEntryPage';
import { SettingsPage } from './pages/SettingsPage';
import { DailyReportsPage } from './pages/DailyReportsPage';
import { RequireAdmin } from './components/RequireAdmin';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/menu" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/t/:uuid" element={<TableEntryPage />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/admin" element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />
      <Route path="/admin/categories" element={<RequireAdmin><CategoriesPage /></RequireAdmin>} />
      <Route path="/admin/products" element={<RequireAdmin><ProductsPage /></RequireAdmin>} />
      <Route path="/admin/products/new" element={<RequireAdmin><ProductCreatePage /></RequireAdmin>} />
      <Route path="/admin/qr" element={<RequireAdmin><TableQrPage /></RequireAdmin>} />
      <Route path="/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
      <Route path="/orders" element={<RequireAdmin><OrdersPage /></RequireAdmin>} />
      <Route path="/employees" element={<RequireAdmin><EmployeesPage /></RequireAdmin>} />
      <Route path="/reports/daily" element={<RequireAdmin><DailyReportsPage /></RequireAdmin>} />
      <Route path="/reports" element={<RequireAdmin><InsightsPage /></RequireAdmin>} />
      <Route path="/insights" element={<RequireAdmin><InsightsPage /></RequireAdmin>} />
    </Routes>
  );
}
