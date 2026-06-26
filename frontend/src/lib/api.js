const runtimeEnv = typeof process !== 'undefined' ? process.env : {};
const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

function normalizeBase(value) {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

function normalizeSessionValue(value) {
  const session = String(value ?? '').trim();
  if (!session || session === 'null' || session === 'undefined') return '';
  return session;
}

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function getQrGatewayBase() {
  const explicit =
    runtimeEnv.NEXT_PUBLIC_QR_URL ||
    runtimeEnv.VITE_QR_URL ||
    viteEnv.VITE_QR_URL ||
    '';
  if (explicit) return normalizeBase(explicit);
  if (typeof window !== 'undefined') {
    if (isLocalhost(window.location.hostname)) {
      return `${window.location.protocol}//${window.location.hostname}:5173`;
    }
    return 'https://menu.crevo-eg.com';
  }
  return 'https://menu.crevo-eg.com';
}

function resolveApiBase() {
  const explicit =
    runtimeEnv.NEXT_PUBLIC_API_URL ||
    runtimeEnv.VITE_API_URL ||
    viteEnv.VITE_API_URL ||
    '';
  if (typeof window !== 'undefined') {
    if (isLocalhost(window.location.hostname)) {
      return `${window.location.protocol}//127.0.0.1:4006`;
    }
    if (explicit) return normalizeBase(explicit);
    return 'https://api-menu.crevo-eg.com';
  }
  if (explicit) return normalizeBase(explicit);
  return 'https://api-menu.crevo-eg.com';
}

function resolveSocketBase() {
  const explicit =
    runtimeEnv.NEXT_PUBLIC_SOCKET_URL ||
    runtimeEnv.VITE_SOCKET_URL ||
    viteEnv.VITE_SOCKET_URL ||
    viteEnv.VITE_API_URL ||
    '';
  if (typeof window !== 'undefined') {
    if (isLocalhost(window.location.hostname)) {
      return `${window.location.protocol}//127.0.0.1:4006`;
    }
    if (explicit) return normalizeBase(explicit);
    return 'https://api-menu.crevo-eg.com';
  }
  if (explicit) return normalizeBase(explicit);
  return 'https://api-menu.crevo-eg.com';
}

const API_BASE = resolveApiBase();
const SOCKET_BASE = resolveSocketBase();

const SESSION_KEY = 'crevo-admin-session';
const LEGACY_TOKEN_KEY = 'crevo-admin-token';
let memorySession = null;
let memoryLegacyToken = '';

function normalizeRole(role) {
  return role === 'cashier' ? 'seller' : role;
}

function getBrowserStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

function syncSessionDebug(session, token) {
  try {
    if (typeof window !== 'undefined') {
      window.__crevoAdminSessionDebug = session ?? null;
      window.__crevoAdminTokenDebug = token ?? '';
    }
  } catch {
    // Ignore debug sync failures.
  }
}

function readSession() {
  const storage = getBrowserStorage();
  try {
    const raw = storage?.getItem(SESSION_KEY) ?? null;
    const session = raw ? JSON.parse(raw) : null;
    syncSessionDebug(session, session?.token ?? memoryLegacyToken ?? '');
    return session;
  } catch {
    syncSessionDebug(memorySession, memorySession?.token ?? memoryLegacyToken ?? '');
    return memorySession;
  }
}

function getAdminToken() {
  const session = readSession();
  if (session?.token) return session.token;
  const storage = getBrowserStorage();
  return storage?.getItem(LEGACY_TOKEN_KEY) ?? memoryLegacyToken ?? '';
}

export function getAdminRole() {
  const session = readSession();
  return normalizeRole(String(session?.user?.role ?? '').trim()) || null;
}

export function getAdminSession() {
  const session = readSession();
  if (session?.token) {
    syncSessionDebug(session, session.token);
    return session;
  }
  const storage = getBrowserStorage();
  const token = storage?.getItem(LEGACY_TOKEN_KEY) ?? memoryLegacyToken;
  const legacySession = token ? { token, user: { role: 'admin' } } : null;
  syncSessionDebug(legacySession, token);
  return legacySession;
}

export function setAdminSession(session) {
  const storage = getBrowserStorage();
  if (session?.token) {
    memorySession = session;
    memoryLegacyToken = session.token;
    try {
      storage?.setItem(SESSION_KEY, JSON.stringify(session));
      storage?.setItem(LEGACY_TOKEN_KEY, session.token);
    } catch {
      // Ignore storage failures and keep the in-memory session.
    }
    syncSessionDebug(session, session.token);
    return;
  }
  memorySession = null;
  memoryLegacyToken = '';
  try {
    storage?.removeItem(SESSION_KEY);
    storage?.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
  syncSessionDebug(null, '');
}

export function setAdminToken(token) {
  const storage = getBrowserStorage();
  if (token) {
    memoryLegacyToken = token;
    try {
      storage?.setItem(LEGACY_TOKEN_KEY, token);
    } catch {
      // Ignore storage failures and keep token in memory.
    }
    syncSessionDebug(memorySession, token);
  } else {
    memoryLegacyToken = '';
    memorySession = null;
    try {
      storage?.removeItem(LEGACY_TOKEN_KEY);
      storage?.removeItem(SESSION_KEY);
    } catch {
      // Ignore storage failures.
    }
    syncSessionDebug(null, '');
  }
}

function adminHeaders(headers = {}) {
  const token = getAdminToken();
  return token ? { ...headers, 'x-admin-token': token } : headers;
}

async function requestBlob(path, options = {}) {
  const { headers: optionHeaders, ...restOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    cache: 'no-store',
    headers: {
      ...(optionHeaders ?? {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error?.message ?? `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.blob();
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

  const responseText = await response.text().catch(() => '');
  let payload = {};
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { raw: responseText };
    }
  }
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
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'raw')) {
    return payload.raw;
  }
  return payload;
}

async function requestForm(path, body = {}, options = {}) {
  const formBody = new URLSearchParams();
  Object.entries(body ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formBody.set(key, String(value));
    }
  });
  const { headers: optionHeaders, ...restOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    cache: 'no-store',
    method: restOptions.method ?? 'POST',
    body: formBody.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      ...(optionHeaders ?? {})
    }
  });

  const responseText = await response.text().catch(() => '');
  let payload = {};
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { raw: responseText };
    }
  }
  if (!response.ok || payload.success === false) {
    const validationDetails = payload?.error?.details;
    const detailText = validationDetails ? ` ${JSON.stringify(validationDetails)}` : '';
    const error = new Error(`${payload?.error?.message ?? `Request failed: ${response.status}`}${detailText}`);
    error.details = validationDetails;
    error.status = response.status;
    throw error;
  }
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'raw')) {
    return payload.raw;
  }
  return payload;
}

export const api = {
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  publicSiteSettings: () => request('/api/public/site-settings'),
  publicOffers: () => request('/api/public/offers'),
  siteSettings: () => request('/api/admin/site-settings', { headers: adminHeaders() }),
  updateSiteSettings: (body) => request('/api/admin/site-settings', { method: 'PUT', body: JSON.stringify(body), headers: adminHeaders() }),
  menu: (params) => {
    const search = new URLSearchParams();
    if (params?.table) search.set('table', params.table);
    const normalizedSession = normalizeSessionValue(params?.session);
    if (normalizedSession) search.set('session', normalizedSession);
    if (params?.lang) search.set('lang', params.lang);
    return request(`/api/public/menu?${search.toString()}`);
  },
  resolveTable: (uuid, session) => {
    const search = new URLSearchParams();
    search.set('uuid', uuid);
    const normalizedSession = normalizeSessionValue(session);
    if (normalizedSession) search.set('session', normalizedSession);
    return request(`/api/public/table/resolve?${search.toString()}`);
  },
  openTable: (body) => requestForm('/api/public/table/open', body),
  closeTable: (body) => requestForm('/api/public/table/close', body),
  placeOrder: (body) => request('/api/public/orders', { method: 'POST', body: JSON.stringify(body) }),
  callWaiter: (body) => requestForm('/api/public/waiter-calls', body),
  requestInvoice: async (body) => {
    const paths = [
      '/api/public/invoice-requests',
      '/api/public/invoice-request',
      '/api/public/request-invoice'
    ];
    let lastError = null;
    for (const path of paths) {
      try {
        return await requestForm(path, body);
      } catch (error) {
        lastError = error;
        if (error?.status !== 404) {
          throw error;
        }
      }
    }
    throw lastError ?? new Error('Request failed');
  },
  logProductView: (body) => request('/api/public/product-views', { method: 'POST', body: JSON.stringify(body) }),
  upload: (body) => request('/api/admin/uploads', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  adminSummary: () => request('/api/admin/dashboard/summary', { headers: adminHeaders() }),
  categories: (scope = 'menu') => request(`/api/admin/categories?${new URLSearchParams({ scope }).toString()}`, { headers: adminHeaders() }),
  createCategory: (body) => request('/api/admin/categories', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateCategory: (id, body) => request(`/api/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteCategory: (id) => request(`/api/admin/categories/${id}`, { method: 'DELETE', headers: adminHeaders() }),
  transferCategoryProducts: (id, targetCategoryId) => request(`/api/admin/categories/${id}/transfer-products`, {
    method: 'POST',
    body: JSON.stringify({ targetCategoryId }),
    headers: adminHeaders()
  }),
  products: (scope = 'menu') => request(`/api/admin/products?${new URLSearchParams({ scope }).toString()}`, { headers: adminHeaders() }),
  createProduct: (body) => request('/api/admin/products', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateProduct: (id, body) => request(`/api/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteProduct: (id, force = false) => request(`/api/admin/products/${id}${force ? '?force=true' : ''}`, { method: 'DELETE', headers: adminHeaders() }),
  offers: () => request('/api/admin/offers', { headers: adminHeaders() }),
  createOffer: (body) => request('/api/admin/offers', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateOffer: (id, body) => request(`/api/admin/offers/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteOffer: (id) => request(`/api/admin/offers/${id}`, { method: 'DELETE', headers: adminHeaders() }),
  validateOfferSelection: (id, body) => request(`/api/admin/offers/${id}/validate-selection`, { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  studioCategories: () => request(`/api/admin/categories?${new URLSearchParams({ scope: 'studio' }).toString()}`, { headers: adminHeaders() }),
  studioProducts: () => request(`/api/admin/products?${new URLSearchParams({ scope: 'studio' }).toString()}`, { headers: adminHeaders() }),
  tables: () => request('/api/admin/tables', { headers: adminHeaders() }),
  createTable: (body) => request('/api/admin/tables', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  saveTableQr: (body) => request('/api/admin/tables', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateTable: (id, body) => request(`/api/admin/tables/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteTable: (id) => request(`/api/admin/tables/${id}`, { method: 'DELETE', headers: adminHeaders() }),
  rotateTableQr: (id) => request(`/api/admin/tables/${id}/rotate-qr`, { method: 'POST', headers: adminHeaders() }),
  branches: () => request('/api/admin/branches', { headers: adminHeaders() }),
  orders: () => request('/api/admin/orders', { headers: adminHeaders() }),
  updateOrderStatus: (id, status) => request(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), headers: adminHeaders() }),
  updateOrderStatusWithReason: (id, status, reason) => request(`/api/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
    headers: adminHeaders()
  }),
  updateOrderItemStatus: (id, status, reason = '') => request(`/api/admin/order-items/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
    headers: adminHeaders()
  }),
  previousOrders: () => request('/api/admin/orders/previous', { headers: adminHeaders() }),
  waiterCalls: () => request('/api/admin/waiter-calls', { headers: adminHeaders() }),
  waiterComplaints: () => request('/api/admin/waiter-complaints', { headers: adminHeaders() }),
  customerReviews: () => request('/api/admin/customer-reviews', { headers: adminHeaders() }),
  vipCustomers: () => request('/api/admin/vip-customers', { headers: adminHeaders() }),
  resetVipCustomers: () => request('/api/admin/vip-customers/reset', { method: 'POST', headers: adminHeaders() }),
  vipSummary: (phone, subtotal = 0) => {
    const search = new URLSearchParams();
    search.set('phone', String(phone ?? ''));
    search.set('subtotal', String(subtotal ?? 0));
    return request(`/api/admin/vip-summary?${search.toString()}`, { headers: adminHeaders() });
  },
  createWaiterComplaint: (body) => request('/api/admin/waiter-complaints', { method: 'POST', body: JSON.stringify(body), headers: adminHeaders() }),
  updateWaiterComplaint: (id, body) => request(`/api/admin/waiter-complaints/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: adminHeaders() }),
  deleteWaiterComplaint: (id) => request(`/api/admin/waiter-complaints/${id}`, { method: 'DELETE', headers: adminHeaders() }),
  createCustomerReview: (body) => requestForm('/api/public/customer-reviews', body),
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
  biInventory: (range) => request(`/api/bi/inventory?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biExpenses: (range) => request(`/api/bi/expenses?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biFinancial: (range) => request(`/api/bi/financial?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biAudit: (range) => request(`/api/bi/audit?${new URLSearchParams(range ?? {}).toString()}`, { headers: adminHeaders() }),
  biExport: (report, format = 'csv') => `${API_BASE}/api/bi/export/${encodeURIComponent(report)}?format=${encodeURIComponent(format)}`
};

export async function downloadBiExport(report, format = 'csv') {
  const blob = await requestBlob(`/api/bi/export/${encodeURIComponent(report)}?format=${encodeURIComponent(format)}`, {
    headers: adminHeaders()
  });
  const extension = format === 'xlsx' ? 'xls' : format === 'print' ? 'html' : format;
  const fileName = `${report}.${extension}`;
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function getApiBase() {
  return API_BASE;
}

export function getSocketBase() {
  return SOCKET_BASE;
}
