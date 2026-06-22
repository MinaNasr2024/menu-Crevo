const runtimeEnv = typeof process !== 'undefined' ? process.env : {};
const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const API_BASE =
  runtimeEnv.NEXT_PUBLIC_API_URL ||
  runtimeEnv.VITE_API_URL ||
  viteEnv.VITE_API_URL ||
  'http://127.0.0.1:4006';

const SOCKET_BASE = runtimeEnv.NEXT_PUBLIC_SOCKET_URL || runtimeEnv.VITE_SOCKET_URL || viteEnv.VITE_SOCKET_URL || viteEnv.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname.match(/^(localhost|127\.0\.0\.1)$/)
    ? 'http://127.0.0.1:4006'
    : ''
);

function getAdminToken() {
  return localStorage.getItem('crevo-admin-token') ?? '';
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem('crevo-admin-token', token);
  } else {
    localStorage.removeItem('crevo-admin-token');
  }
}

function adminHeaders(headers = {}) {
  const token = getAdminToken();
  return token ? { ...headers, 'x-admin-token': token } : headers;
}

async function request(path, options = {}) {
  const { headers: optionHeaders, ...restOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(optionHeaders ?? {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const validationDetails = payload?.error?.details;
    const detailText = validationDetails
      ? ` ${JSON.stringify(validationDetails)}`
      : '';
    const error = new Error(`${payload?.error?.message ?? `Request failed: ${response.status}`}${detailText}`);
    error.details = validationDetails;
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

export const api = {
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  publicSiteSettings: () => request('/api/public/site-settings'),
  siteSettings: () => request('/api/admin/site-settings', { headers: adminHeaders() }),
  updateSiteSettings: (body) => request('/api/admin/site-settings', { method: 'PUT', body: JSON.stringify(body), headers: adminHeaders() }),
  menu: (params) => {
    const search = new URLSearchParams();
    if (params?.table) search.set('table', params.table);
    if (params?.session) search.set('session', params.session);
    if (params?.lang) search.set('lang', params.lang);
    return request(`/api/public/menu?${search.toString()}`);
  },
  resolveTable: (uuid, session) => {
    const search = new URLSearchParams();
    search.set('uuid', uuid);
    if (session) search.set('session', session);
    return request(`/api/public/table/resolve?${search.toString()}`);
  },
  openTable: (body) => request('/api/public/table/open', { method: 'POST', body: JSON.stringify(body) }),
  closeTable: (body) => request('/api/public/table/close', { method: 'POST', body: JSON.stringify(body) }),
  placeOrder: (body) => request('/api/public/orders', { method: 'POST', body: JSON.stringify(body) }),
  callWaiter: (body) => request('/api/public/waiter-calls', { method: 'POST', body: JSON.stringify(body) }),
  logProductView: (body) => request('/api/public/product-views', { method: 'POST', body: JSON.stringify(body) }),
  upload: (body) => request('/api/admin/uploads', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  adminSummary: () => request('/api/admin/dashboard/summary', { headers: adminHeaders() }),
  categories: () => request('/api/admin/categories', { headers: adminHeaders() }),
  createCategory: (body) => request('/api/admin/categories', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateCategory: (id, body) => request(`/api/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteCategory: (id) => request(`/api/admin/categories/${id}`, { method: 'DELETE', headers: adminHeaders() }),
  products: () => request('/api/admin/products', { headers: adminHeaders() }),
  createProduct: (body) => request('/api/admin/products', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateProduct: (id, body) => request(`/api/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteProduct: (id) => request(`/api/admin/products/${id}`, { method: 'DELETE', headers: adminHeaders() }),
  tables: () => request('/api/admin/tables', { headers: adminHeaders() }),
  createTable: (body) => request('/api/admin/tables', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  saveTableQr: (body) => request('/api/admin/tables', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateTable: (id, body) => request(`/api/admin/tables/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteTable: (id) => request(`/api/admin/tables/${id}`, { method: 'DELETE', headers: adminHeaders() }),
  rotateTableQr: (id) => request(`/api/admin/tables/${id}/rotate-qr`, { method: 'POST', headers: adminHeaders() }),
  branches: () => request('/api/admin/branches', { headers: adminHeaders() }),
  orders: () => request('/api/admin/orders', { headers: adminHeaders() }),
  updateOrderStatus: (id, status) => request(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), headers: adminHeaders() }),
  waiterCalls: () => request('/api/admin/waiter-calls', { headers: adminHeaders() }),
  employees: () => request('/api/admin/employees', { headers: adminHeaders() }),
  createEmployee: (body) => request('/api/admin/employees', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateEmployee: (id, body) => request(`/api/admin/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteEmployee: (id) => request(`/api/admin/employees/${id}`, { method: 'DELETE', headers: adminHeaders() }),
  refreshReports: () => request('/api/admin/reports/refresh', { method: 'POST', headers: adminHeaders() }),
  acknowledgeCall: (id) => request(`/api/admin/waiter-calls/${id}/acknowledge`, { method: 'POST', headers: adminHeaders() }),
  completeCall: (id) => request(`/api/admin/waiter-calls/${id}/complete`, { method: 'POST', headers: adminHeaders() }),
  topProducts: (range) => request(`/api/admin/analytics/top-products?${new URLSearchParams(range).toString()}`, { headers: adminHeaders() }),
  peakHours: (range) => request(`/api/admin/analytics/peak-hours?${new URLSearchParams(range).toString()}`, { headers: adminHeaders() }),
  revenue: (range) => request(`/api/admin/analytics/revenue?${new URLSearchParams(range).toString()}`, { headers: adminHeaders() }),
  biExecutive: (range) => request(`/api/bi/executive?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biSales: (range) => request(`/api/bi/sales?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biProducts: (range) => request(`/api/bi/products?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biCategories: (range) => request(`/api/bi/categories?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biBranches: (range) => request(`/api/bi/branches?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biTables: (range) => request(`/api/bi/tables?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biWaiters: (range) => request(`/api/bi/waiters?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biEmployees: (range) => request(`/api/bi/employees?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biCustomers: (range) => request(`/api/bi/customers?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biTime: (range) => request(`/api/bi/time?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biOffers: (range) => request(`/api/bi/offers?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biInventory: (range) => request(`/api/bi/inventory?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biExpenses: (range) => request(`/api/bi/expenses?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biFinancial: (range) => request(`/api/bi/financial?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biAudit: (range) => request(`/api/bi/audit?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biExport: (report, format = 'csv') => `${API_BASE}/api/bi/export/${encodeURIComponent(report)}?format=${encodeURIComponent(format)}`
};

export function getApiBase() {
  return API_BASE;
}

export function getSocketBase() {
  return SOCKET_BASE;
}
