import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api, setAdminToken } from '../lib/api';
import { getApiBase, getSocketBase } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

export function AdminShell({ title, children }) {
  const navigate = useNavigate();
  const { setLang } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [orderAlert, setOrderAlert] = useState(null);

  useEffect(() => {
    setLang('ar');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, [setLang]);

  useEffect(() => {
    const socket = io(getSocketBase() || getApiBase(), { transports: ['websocket'] });
    let audioContext;

    function playPattern(pattern) {
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

    const handleOrder = (payload) => {
      playPattern([
        { frequency: 740, duration: 0.16, delay: 0, volume: 0.42, type: 'sawtooth' },
        { frequency: 932, duration: 0.16, delay: 0.18, volume: 0.46, type: 'sawtooth' },
        { frequency: 1175, duration: 0.22, delay: 0.36, volume: 0.5, type: 'triangle' }
      ]);
      setOrderAlert({
        kind: 'order',
        title: 'طلب جديد',
        description: `الطاولة ${payload?.tableNumber ?? '-'} رقم الطلب ${payload?.orderId ?? '-'}`,
        tableNumber: payload?.tableNumber ?? '-',
        orderId: payload?.orderId ?? '-'
      });
      window.setTimeout(() => setOrderAlert(null), 5000);
    };
    const handleWaiter = (payload) => {
      playPattern([
        { frequency: 880, duration: 0.08, delay: 0, volume: 0.48, type: 'sine' },
        { frequency: 880, duration: 0.08, delay: 0.12, volume: 0.48, type: 'sine' }
      ]);
      setOrderAlert({
        kind: 'waiter',
        title: 'طلب نادل جديد',
        description: `الطاولة ${payload?.tableNumber ?? '-'}`,
        tableNumber: payload?.tableNumber ?? '-',
        orderId: '-'
      });
      window.setTimeout(() => setOrderAlert(null), 5000);
    };
    socket.on('order:new', handleOrder);
    socket.on('waiter:call:new', handleWaiter);
    socket.emit('join:admin');
    return () => {
      socket.disconnect();
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, []);

  const navItems = useMemo(
    () => [
      { to: '/admin', label: 'لوحة التحكم' },
      { to: '/admin/categories', label: 'الأقسام' },
      { to: '/admin/products', label: 'المنتجات' },
      { to: '/settings', label: 'الإعدادات' },
      { to: '/orders', label: 'الطلبات' },
      { to: '/admin/qr', label: 'QR الطاولات' },
      { to: '/employees', label: 'الموظفون' },
      { to: '/reports/daily', label: 'التقارير اليومية' },
      { to: '/reports', label: 'التقارير' },
      { to: '/menu', label: 'قائمة العميل' }
    ],
    []
  );

  function logout() {
    setAdminToken('');
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-ui min-h-screen bg-[#090a0d] text-white" data-admin-theme="dark">
      {orderAlert ? (
        <div className="fixed inset-x-0 top-4 z-[90] flex justify-center px-4">
          <div className={`w-full max-w-[760px] rounded-[28px] px-6 py-5 text-white shadow-[0_30px_90px_rgba(249,115,22,0.35)] ${
            orderAlert.kind === 'waiter'
              ? 'border border-sky-300/40 bg-gradient-to-r from-sky-500 to-cyan-500'
              : 'border border-amber-300/40 bg-gradient-to-r from-amber-500 to-orange-500'
          }`}>
            <div className="text-xs font-bold uppercase tracking-[0.35em] opacity-90">
              {orderAlert.kind === 'waiter' ? 'Waiter Call' : 'New Order'}
            </div>
            <div className="mt-2 text-3xl font-black">{orderAlert.title}</div>
            <div className="mt-2 text-lg font-semibold">{orderAlert.description}</div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col lg:flex-row">
        <aside
          className={`border-b border-white/10 bg-black/30 p-3 backdrop-blur-xl transition-all sm:p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r ${
            collapsed ? 'lg:w-24' : 'lg:w-72'
          }`}
        >
          <div className="flex flex-col gap-3 lg:items-stretch">
            <div className={`flex items-center justify-between gap-3 lg:flex-col lg:items-stretch ${collapsed ? 'lg:justify-center' : ''}`}>
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
              className="self-end rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 lg:self-start"
              aria-label={collapsed ? 'فتح القائمة' : 'طي القائمة'}
            >
              {collapsed ? '→' : '←'}
            </button>
          </div>

          <nav className="mt-4 flex max-h-[calc(100vh-210px)] gap-2 overflow-y-auto overflow-x-hidden pb-2 pr-1 sm:gap-3 lg:flex-col lg:max-h-[calc(100vh-220px)]">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `admin-nav-link inline-flex shrink-0 items-center justify-center rounded-2xl px-4 py-3 text-sm transition ${
                    isActive ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 text-white/75 hover:bg-white/5'
                  } ${collapsed ? 'lg:justify-center lg:px-3' : ''}`
                }
              >
                <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                <span className={`hidden font-bold ${collapsed ? 'lg:block' : 'lg:hidden'}`}>
                  {item.label.slice(0, 1)}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 grid gap-3">
            <button type="button" onClick={logout} className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
              {collapsed ? '↩' : 'تسجيل الخروج'}
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 text-white sm:p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
