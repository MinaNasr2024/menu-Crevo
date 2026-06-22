import { Navigate } from 'react-router-dom';

export function RequireAdmin({ children }) {
  const token = localStorage.getItem('crevo-admin-token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
