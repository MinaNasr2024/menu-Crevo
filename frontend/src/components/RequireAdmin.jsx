import { Navigate } from 'react-router-dom';
import { getAdminRole, getAdminSession } from '../lib/api';

function normalizeRole(role) {
  return role === 'cashier' ? 'seller' : role;
}

function fallbackPath(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'seller') return '/orders';
  if (normalizedRole === 'waiter') return '/admin/waiter-complaints';
  if (normalizedRole === 'manager') return '/admin';
  return '/admin';
}

export function RequireAdmin({ children, roles = [] }) {
  const session = getAdminSession();
  const role = normalizeRole(getAdminRole());

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length && !roles.includes(role)) {
    return <Navigate to={fallbackPath(role)} replace />;
  }

  return children;
}
