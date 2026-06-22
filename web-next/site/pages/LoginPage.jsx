import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAdminToken } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';

export function LoginPage() {
  const navigate = useNavigate();
  const { setLang } = useLanguage();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLang('ar');
    if (localStorage.getItem('crevo-admin-token')) {
      navigate('/admin', { replace: true });
    }
  }, [navigate, setLang]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(form);
      setAdminToken(data.token);
      navigate('/admin', { replace: true });
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
            <p className="text-xs uppercase tracking-[0.35em] text-white/35">لوحة كريڤو</p>
            <h1 className="mt-2 text-3xl font-bold text-cream">تسجيل الدخول</h1>
            <p className="mt-2 text-sm text-white/60">{t('ar', 'loginHint')}</p>
            <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
              بيانات الدخول الافتراضية:
              <span className="font-semibold text-white"> admin / admin123</span>
            </p>
          </div>

          {error ? <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-white/70">اسم المستخدم</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
              />
              <span className="block text-xs text-white/45">استخدم بيانات المدير الموجودة في إعدادات البيئة.</span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-white/70">كلمة المرور</span>
              <input
                type="password"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
              <span className="block text-xs text-white/45">هذه البيانات تفتح لوحة التحكم بعد تسجيل الدخول بنجاح.</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gold px-5 py-4 text-sm font-bold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
