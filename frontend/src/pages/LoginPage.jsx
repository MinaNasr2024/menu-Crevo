import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAdminSession, getAdminSession, getAdminRole } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

export function LoginPage() {
  try {
    if (typeof window !== 'undefined') {
      window.__crevoLoginRendered = true;
    }
  } catch {
    // Ignore debug failures.
  }

  const navigate = useNavigate();
  const { setLang } = useLanguage();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setLang('ar');
    const session = getAdminSession();
    if (session?.token) {
      const role = getAdminRole();
      navigate(role === 'seller' ? '/orders' : role === 'waiter' ? '/admin/waiter-complaints' : '/admin', { replace: true });
    }
  }, [navigate, setLang]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(form);
      setAdminSession(data);
      const role = String(data?.user?.role ?? '').trim();
      navigate(role === 'seller' ? '/orders' : role === 'waiter' ? '/admin/waiter-complaints' : '/admin', { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <form onSubmit={submit} className="glass-panel w-full space-y-5 rounded-[32px] p-6 shadow-glow sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-700">لوحة كريفو</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">تسجيل الدخول</h1>
          </div>

          {error ? <div className="rounded-2xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-slate-700">اسم المستخدم أو رقم الهاتف أو البريد</span>
              <input
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-gold"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="01000000000 أو الاسم أو البريد"
              />
              <span className="block text-xs text-slate-500">يمكنك الدخول بحساب الأدمن أو بأي موظف تم إنشاؤه من لوحة التحكم.</span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-700">كلمة المرور</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-gold"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 left-3 my-auto flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path fill="currentColor" d="M12 5c5.5 0 9.5 4.5 11 7-1.5 2.5-5.5 7-11 7S2.5 14.5 1 12c1.5-2.5 5.5-7 11-7zm0 2C7.7 7 4.2 10.1 3 12c1.2 1.9 4.7 5 9 5s7.8-3.1 9-5c-1.2-1.9-4.7-5-9-5zm0 1.5A3.5 3.5 0 1 1 12 15a3.5 3.5 0 0 1 0-7zm0 2A1.5 1.5 0 1 0 12 14a1.5 1.5 0 0 0 0-3z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path fill="currentColor" d="M12 5c5.5 0 9.5 4.5 11 7-.6 1-1.4 2.1-2.4 3.1l-1.4-1.4c.8-.7 1.4-1.5 1.8-2C19.8 10.1 16.3 7 12 7c-.8 0-1.6.1-2.3.3L8.1 5.7C9.3 5.2 10.6 5 12 5zM4.7 4.7 3.3 6.1l2.4 2.4C4.2 9.5 3.1 10.7 2 12c1.5 2.5 5.5 7 10 7 1.4 0 2.7-.2 3.9-.7l2.3 2.3 1.4-1.4L4.7 4.7zm6.1 6.1 2.4 2.4a3.5 3.5 0 0 1-2.4-2.4z" />
                    </svg>
                  )}
                </button>
              </div>
              <span className="block text-xs text-slate-500">هذه البيانات تفتح لوحة التحكم بعد تسجيل الدخول بنجاح.</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gold px-5 py-4 text-sm font-bold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
