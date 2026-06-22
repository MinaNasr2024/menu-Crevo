import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getApiBase, getSocketBase, setAdminToken, getAdminRole } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { notifyLiveChange } from '../lib/liveSync';

function ShellIcon({ name }) {
  const common = 'h-5 w-5 shrink-0 text-current';
  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 13.5h7V4H4v9.5Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 20h7V10.5h-7V20Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 4h7v4.5h-7V4Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 20h7v-4.5H4V20Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'categories':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 6h7v7H4V6Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 6h7v4.5h-7V6Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 12.5h7V18h-7v-5.5Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 15h7v3H4v-3Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'products':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M5 7h14v10H5V7Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 11h6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 15h4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M12 8.2A3.8 3.8 0 1 0 12 15.8 3.8 3.8 0 0 0 12 8.2Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19 12a7.2 7.2 0 0 0-.1-1l2-1.5-2-3.5-2.4 1A7.6 7.6 0 0 0 15.8 6L15.5 3h-4l-.3 3a7.6 7.6 0 0 0-1.7.4l-2.4-1-2 3.5L7.1 11a7.2 7.2 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.2 1.1.3 1.7.4l.3 3h4l.3-3c.6-.1 1.2-.2 1.7-.4l2.4 1 2-3.5-2-1.5c.1-.3.1-.6.1-1Z" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'orders':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M6 4h12l-1 16H7L6 4Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 7h6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 11h6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 15h4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'qr':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 4h6v6H4V4Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M14 4h6v6h-6V4Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 14h6v6H4v-6Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M14 14h3v3h-3v-3Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M18 14h2v2h-2v-2Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M14 18h2v2h-2v-2Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'employees':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M5 5h14v14H5V5Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 15l2-3 2 2 3-5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 9h8" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'reviews':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M6 5h12v9H9l-3 3V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10 8h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 11h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 16l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4L12 16Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'vip':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 9l3 2 5-7 5 7 3-2-2 10H6L4 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'waiter':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M8 20h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 20V9.5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2V20" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.5 8.5C9.7 6.7 11 6 12 6c1 0 2.3.7 3.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'daily':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M7 3v3M17 3v3M4 8h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M5 6h14v14H5V6Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'menu':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M5 6h14M5 12h14M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'offers':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 8h16v8H4V8Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 8V6h8v2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M10 15h4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'studio':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6 17V7l6-3 6 3v10" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 17v-5h6v5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    default:
      return null;
  }
}

export function AdminShell({ title, children }) {
  const navigate = useNavigate();
  const { setLang } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orderAlert, setOrderAlert] = useState(null);
  const role = (getAdminRole() === 'cashier' ? 'seller' : getAdminRole()) ?? 'admin';
  const liveStateRef = useRef({
    initialized: false,
    orderIds: new Set(),
    waiterCallIds: new Set(),
    invoiceByTable: new Map()
  });

  useEffect(() => {
    setLang('ar');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, [setLang]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    let socket = null;
    let audioContext;
    let pollTimer = null;
    let mounted = true;

    function playPattern(pattern) {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext = audioContext || new AudioContextClass();
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }

      const startAt = audioContext.currentTime + 0.02;
      pattern.forEach((step, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = step.type || 'sine';
        oscillator.frequency.value = step.frequency;
        gainNode.gain.setValueAtTime(0.0001, startAt + index * step.delay);
        gainNode.gain.exponentialRampToValueAtTime(step.volume ?? 0.35, startAt + index * step.delay + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + index * step.delay + step.duration);
        oscillator.connect(gainNode).connect(audioContext.destination);
        oscillator.start(startAt + index * step.delay);
        oscillator.stop(startAt + index * step.delay + step.duration + 0.03);
      });
    }

    const emitDataChanged = (payload) => {
      notifyLiveChange(payload ?? null);
    };

    const markSnapshot = ({ orders = [], calls = [], tables = [] } = {}) => {
      const liveState = liveStateRef.current;
      liveState.orderIds = new Set(orders.map((order) => String(order?.id ?? '')).filter(Boolean));
      liveState.waiterCallIds = new Set(calls.map((call) => String(call?.id ?? '')).filter(Boolean));
      liveState.invoiceByTable = new Map(
        tables
          .map((table) => [String(table?.id ?? ''), String(table?.invoiceRequestedAt ?? '')])
          .filter(([tableId]) => Boolean(tableId))
      );
      liveState.initialized = true;
    };

    const handleSocketOrder = (payload = {}) => {
      if (!mounted) return;
      const orderId = String(payload?.orderId ?? '').trim();
      if (orderId) liveStateRef.current.orderIds.add(orderId);
      playPattern([
        { frequency: 740, duration: 0.16, delay: 0, volume: 0.42, type: 'sawtooth' },
        { frequency: 932, duration: 0.16, delay: 0.18, volume: 0.46, type: 'sawtooth' },
        { frequency: 1175, duration: 0.22, delay: 0.36, volume: 0.5, type: 'triangle' }
      ]);
      setOrderAlert({
        kind: 'order',
        title: 'طلب جديد',
        description: `الطاولة ${payload?.tableNumber ?? '-'} رقم الطلب ${payload?.orderId ?? '-'}`
      });
      window.setTimeout(() => setOrderAlert(null), 5000);
      emitDataChanged({ entity: 'order', ...payload });
    };

    const handleSocketWaiter = (payload = {}) => {
      if (!mounted) return;
      const callId = String(payload?.callId ?? '').trim();
      if (callId) liveStateRef.current.waiterCallIds.add(callId);
      playPattern([
        { frequency: 880, duration: 0.08, delay: 0, volume: 0.48, type: 'sine' },
        { frequency: 880, duration: 0.08, delay: 0.12, volume: 0.48, type: 'sine' }
      ]);
      setOrderAlert({
        kind: 'waiter',
        title: 'طلب نادل جديد',
        description: `الطاولة ${payload?.tableNumber ?? '-'}`
      });
      window.setTimeout(() => setOrderAlert(null), 5000);
      emitDataChanged({ entity: 'waiter-call', ...payload });
    };

    const handleSocketInvoice = (payload = {}) => {
      if (!mounted) return;
      const tableId = String(payload?.tableId ?? '').trim();
      if (tableId) {
        liveStateRef.current.invoiceByTable.set(tableId, String(payload?.invoiceRequestedAt ?? Date.now()));
      }
      playPattern([
        { frequency: 660, duration: 0.1, delay: 0, volume: 0.38, type: 'triangle' },
        { frequency: 784, duration: 0.12, delay: 0.14, volume: 0.42, type: 'triangle' },
        { frequency: 659, duration: 0.14, delay: 0.32, volume: 0.4, type: 'triangle' }
      ]);
      setOrderAlert({
        kind: 'invoice',
        title: 'تم طلب الفاتورة',
        description: `هذه الطاولة تتطلب الفاتورة: ${payload?.tableNumber ?? '-'}`
      });
      window.setTimeout(() => setOrderAlert(null), 5000);
      emitDataChanged({ entity: 'invoice', ...payload });
    };

    const pollLiveData = async () => {
      if (!mounted) return;
      try {
        const [orders, calls, tables] = await Promise.all([
          api.orders(),
          api.waiterCalls(),
          api.tables()
        ]);

        if (!mounted) return;

        const normalizedOrders = Array.isArray(orders) ? orders : [];
        const normalizedCalls = Array.isArray(calls) ? calls : [];
        const normalizedTables = Array.isArray(tables) ? tables : [];

        if (!liveStateRef.current.initialized) {
          markSnapshot({ orders: normalizedOrders, calls: normalizedCalls, tables: normalizedTables });
          return;
        }

        const seenOrders = liveStateRef.current.orderIds;
        const newOrder = normalizedOrders.find((order) => {
          const orderId = String(order?.id ?? '').trim();
          return orderId && !seenOrders.has(orderId);
        });
        if (newOrder && (role === 'admin' || role === 'manager' || role === 'seller')) {
          handleSocketOrder({
            entity: 'order',
            orderId: newOrder.id,
            tableNumber: newOrder?.table?.tableNumber ?? '-',
            tableId: newOrder?.tableId ?? newOrder?.table?.id ?? null
          });
        }
        normalizedOrders.forEach((order) => {
          const orderId = String(order?.id ?? '').trim();
          if (orderId) seenOrders.add(orderId);
        });

        const seenCalls = liveStateRef.current.waiterCallIds;
        const newCall = normalizedCalls.find((call) => {
          const callId = String(call?.id ?? '').trim();
          return callId && !seenCalls.has(callId) && String(call?.status ?? '').toLowerCase() !== 'completed';
        });
        if (newCall && (role === 'admin' || role === 'manager' || role === 'waiter')) {
          handleSocketWaiter({
            entity: 'waiter-call',
            callId: newCall.id,
            tableNumber: newCall?.table?.tableNumber ?? newCall?.tableNumber ?? '-',
            tableId: newCall?.tableId ?? newCall?.table?.id ?? null
          });
        }
        normalizedCalls.forEach((call) => {
          const callId = String(call?.id ?? '').trim();
          if (callId) seenCalls.add(callId);
        });

        const seenInvoices = liveStateRef.current.invoiceByTable;
        const invoiceTable = normalizedTables.find((table) => {
          const tableId = String(table?.id ?? '').trim();
          const invoiceAt = String(table?.invoiceRequestedAt ?? '');
          return tableId && invoiceAt && seenInvoices.get(tableId) !== invoiceAt;
        });
        if (invoiceTable && (role === 'admin' || role === 'manager')) {
          handleSocketInvoice({
            entity: 'invoice',
            tableId: invoiceTable.id,
            tableNumber: invoiceTable?.tableNumber ?? '-',
            invoiceRequestedAt: invoiceTable?.invoiceRequestedAt ?? null
          });
        }
        normalizedTables.forEach((table) => {
          const tableId = String(table?.id ?? '').trim();
          if (tableId) seenInvoices.set(tableId, String(table?.invoiceRequestedAt ?? ''));
        });

        if (newOrder || newCall || invoiceTable) {
          emitDataChanged({
            entity: 'live-refresh',
            source: 'poll'
          });
        }
      } catch {
        // Ignore polling failures and keep the UI responsive.
      }
    };

    const handleOrder = (payload) => {
      handleSocketOrder(payload);
    };

    const handleWaiter = (payload) => {
      handleSocketWaiter(payload);
    };

    const handleInvoice = (payload) => {
      handleSocketInvoice(payload);
    };

    try {
      socket = io(getSocketBase() || getApiBase(), { transports: ['websocket'] });
      if (role === 'waiter') {
        socket.on('waiter:call:new', handleWaiter);
      } else if (role === 'seller') {
        socket.on('order:new', handleOrder);
      } else {
        socket.on('order:new', handleOrder);
        socket.on('waiter:call:new', handleWaiter);
        socket.on('invoice:request:new', handleInvoice);
      }
      socket.on('data:changed', emitDataChanged);
      socket.emit('join:admin');
    } catch {
      socket = null;
    }

    pollLiveData();
    pollTimer = window.setInterval(() => {
      pollLiveData().catch(() => {});
    }, 5000);

    return () => {
      mounted = false;
      if (pollTimer) window.clearInterval(pollTimer);
      socket?.disconnect();
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, []);

  const navItems = useMemo(
    () => {
      if (role === 'waiter') {
        return [
          { to: '/admin/waiter-complaints', label: 'صفحة النادل', icon: 'waiter', roles: ['admin', 'manager', 'waiter'] }
        ];
      }

      return [
        { to: '/admin', label: 'لوحة التحكم', icon: 'dashboard', roles: ['admin', 'manager'] },
        { to: '/orders', label: 'الطلبات', icon: 'orders', roles: ['admin', 'manager', 'seller'] },
        { to: '/orders/previous', label: 'الطلبات السابقة', icon: 'orders', roles: ['admin', 'manager'] },
        { to: '/admin/categories', label: 'الأقسام', icon: 'categories', roles: ['admin', 'manager'] },
        { to: '/admin/products', label: 'المنتجات', icon: 'products', roles: ['admin', 'manager'] },
        { to: '/admin/offers', label: 'العروض', icon: 'offers', roles: ['admin', 'manager'] },
        { to: '/reports', label: 'التقارير', icon: 'reports', roles: ['admin'] },
        { to: '/reports/daily', label: 'التقارير اليومية', icon: 'daily', roles: ['admin'] },
        { to: '/admin/customer-reviews', label: 'تقييمات العملاء', icon: 'reviews', roles: ['admin'] },
        { to: '/admin/vip', label: 'العملاء المميزون', icon: 'vip', roles: ['admin', 'manager'] },
        { to: '/employees', label: 'الموظفين', icon: 'employees', roles: ['admin'] },
        { to: '/admin/waiter-complaints', label: 'صفحة النادل', icon: 'waiter', roles: ['admin', 'manager'] },
        { to: '/admin/qr', label: 'QR الطاولات', icon: 'qr', roles: ['admin', 'manager'] },
        { to: '/settings', label: 'الإعدادات', icon: 'settings', roles: ['admin'] },
        { to: '/menu', label: 'قائمة العميل', icon: 'menu', target: '_blank', rel: 'noreferrer', roles: ['admin', 'manager'] }
      ];
    },
    [role]
  );

  function logout() {
    setAdminToken('');
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-ui min-h-screen bg-[#090a0d] text-white" data-admin-theme="dark">
      {orderAlert ? (
        <div className="fixed inset-x-0 top-6 z-[180] flex justify-center px-4">
          <div
            className={`w-full max-w-[860px] rounded-[30px] px-7 py-6 text-white shadow-[0_30px_100px_rgba(249,115,22,0.38)] ${
              orderAlert.kind === 'waiter'
                ? 'border border-sky-300/40 bg-gradient-to-r from-sky-500 to-cyan-500'
                : orderAlert.kind === 'invoice'
                  ? 'border border-violet-300/40 bg-gradient-to-r from-violet-500 to-fuchsia-500'
                : 'border border-amber-300/40 bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-[0.35em] opacity-90">
              {orderAlert.kind === 'waiter' ? 'Waiter Call' : orderAlert.kind === 'invoice' ? 'Invoice Request' : 'New Order'}
            </div>
            <div className="mt-2 text-[2rem] font-black leading-tight">{orderAlert.title}</div>
            <div className="mt-2 text-lg font-semibold opacity-95">{orderAlert.description}</div>
          </div>
        </div>
      ) : null}

      <div
        className={`fixed inset-0 z-[78] bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col lg:flex-row">
        <aside
          className={`fixed inset-y-0 right-0 z-[80] w-[88vw] max-w-[340px] overflow-y-auto border-l border-white/10 bg-black/90 p-3 backdrop-blur-xl transition-transform duration-300 sm:p-4 lg:sticky lg:top-0 lg:h-screen lg:max-w-none lg:translate-x-0 lg:border-b-0 lg:border-r lg:bg-black/30 ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          } ${collapsed ? 'lg:w-24' : 'lg:w-80'}`}
        >
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">لوحة التحكم</p>
              <h1 className="mt-1 text-lg font-bold text-cream">{title}</h1>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85"
              aria-label="إغلاق القائمة"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-3 lg:items-stretch">
            <div className={`hidden items-center justify-between gap-3 lg:flex lg:flex-col lg:items-stretch ${collapsed ? 'lg:justify-center' : ''}`}>
              {!collapsed ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 sm:text-xs">لوحة التحكم</p>
                  <h1 className="mt-1 text-lg font-bold text-cream sm:text-xl">{title}</h1>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="hidden self-end rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 lg:block lg:self-start"
              aria-label={collapsed ? 'فتح القائمة' : 'طي القائمة'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>

          <nav className="mt-4 flex max-h-[calc(100vh-210px)] flex-col gap-2 overflow-y-auto overflow-x-hidden pb-2 pr-1 sm:gap-3 lg:max-h-[calc(100vh-220px)]">
            {navItems.filter((item) => item.roles.includes(role)).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                target={item.target}
                rel={item.rel}
                className={({ isActive }) =>
                  `admin-nav-link inline-flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    isActive ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 text-white/75 hover:bg-white/5'
                  } ${collapsed ? 'lg:justify-center lg:px-3' : ''}`
                }
                title={item.label}
              >
                <ShellIcon name={item.icon} />
                <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 grid gap-3">
            <button type="button" onClick={logout} className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
              {collapsed ? '↩' : 'تسجيل الخروج'}
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 text-white sm:p-4 lg:p-8">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">لوحة التحكم</p>
              <h2 className="mt-1 text-base font-bold text-white">{title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-2xl bg-gold px-4 py-2 text-sm font-bold text-ink"
            >
              القائمة
            </button>
          </div>

          <div className="max-w-full overflow-x-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}

