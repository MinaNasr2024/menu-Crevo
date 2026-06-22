import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { api } from '../lib/api';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const emptyEmployee = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'seller',
  branchId: '',
  isActive: true
};

const roleOptions = [
  { value: 'seller', label: 'بائع', description: 'يشاهد صفحة الطلبات فقط' },
  { value: 'manager', label: 'مدير', description: 'يضيف المنتجات والأسعار' },
  { value: 'waiter', label: 'نادل', description: 'يشاهد صفحة النادل فقط' },
  { value: 'admin', label: 'أدمن', description: 'كل الصلاحيات: إضافة وحذف وتعديل' }
];

function normalizeRole(role) {
  return role === 'cashier' ? 'seller' : role;
}

export function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyEmployee);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [employeeData, branchData] = await Promise.all([api.employees(), api.branches()]);
    setEmployees(employeeData);
    setBranches(branchData);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  useWindowDataChanged(() => {
    refresh().catch(() => {});
  });

  const selectedRole = useMemo(
    () => roleOptions.find((option) => option.value === form.role),
    [form.role]
  );

  async function saveEmployee() {
    try {
      const payload = {
        fullName: String(form.fullName ?? '').trim(),
        phone: String(form.phone ?? '').trim(),
        email: String(form.email ?? '').trim(),
        role: form.role,
        branchId: form.branchId ? Number(form.branchId) : null,
        isActive: Boolean(form.isActive)
      };

      if (!payload.fullName) throw new Error('اسم الموظف مطلوب');
      if (!payload.phone) throw new Error('رقم الهاتف مطلوب');

      if (editingId) {
        if (form.password.trim() || form.confirmPassword.trim()) {
          if (!form.password.trim()) throw new Error('كلمة المرور مطلوبة عند التعديل');
          if (form.password !== form.confirmPassword) throw new Error('تأكيد كلمة المرور غير متطابق');
          payload.password = form.password;
          payload.confirmPassword = form.confirmPassword;
        }
        await api.updateEmployee(editingId, payload);
      } else {
        if (!form.password.trim()) throw new Error('كلمة المرور مطلوبة');
        if (form.password !== form.confirmPassword) throw new Error('تأكيد كلمة المرور غير متطابق');
        payload.password = form.password;
        payload.confirmPassword = form.confirmPassword;
        await api.createEmployee(payload);
      }

      setForm(emptyEmployee);
      setEditingId(null);
      setMessage('تم حفظ الموظف بنجاح');
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <AdminShell title="الموظفون">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إدارة الموظفين</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">الموظفون</h1>
            </div>
          </div>
          {message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">{message}</p> : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="glass-panel rounded-[32px] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold">{editingId ? 'تعديل موظف' : 'إضافة موظف'}</h2>
              {editingId ? <span className="text-xs uppercase tracking-[0.3em] text-gold">جاري التعديل</span> : null}
            </div>

            <form
              className="mt-4 space-y-4"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                saveEmployee();
              }}
            >
              <label className="block space-y-2">
                <span className="text-sm text-white/70">اسم الموظف *</span>
                <input
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                  value={form.fullName}
                  onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
                  placeholder="مثال: أحمد محمد"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-white/70">رقم الهاتف *</span>
                <input
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                  value={form.phone}
                  onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                  placeholder="01xxxxxxxxx"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-white/70">البريد الإلكتروني (اختياري)</span>
                <input
                  type="email"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                  placeholder="name@example.com"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-white/70">كلمة المرور *</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                    value={form.password}
                    onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                    placeholder={editingId ? 'اتركها فارغة إذا لا تريد تغييرها' : '********'}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-white/70">تأكيد كلمة المرور *</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                    value={form.confirmPassword}
                    onChange={(e) => setForm((current) => ({ ...current, confirmPassword: e.target.value }))}
                    placeholder="********"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm text-white/70">الصلاحيات *</span>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                  value={form.role}
                  onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedRole ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                  {selectedRole.description}
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm text-white/70">الفرع</span>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-gold"
                  value={form.branchId}
                  onChange={(e) => setForm((current) => ({ ...current, branchId: e.target.value }))}
                >
                  <option value="">بدون فرع</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.nameAr}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
                />
                موظف نشط
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
                  حفظ الموظف
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm"
                  onClick={() => {
                    setForm(emptyEmployee);
                    setEditingId(null);
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold">قائمة الموظفين</h2>
            <div className="mt-4 space-y-3">
              {employees.map((employee) => {
                const mappedRole = normalizeRole(employee.role);
                const roleLabel = roleOptions.find((item) => item.value === mappedRole)?.label ?? employee.role;
                return (
                  <div key={employee.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-cream">{employee.fullName}</p>
                        <p className="mt-1 text-xs text-white/60">
                          {roleLabel}
                          {employee.phone ? ` • ${employee.phone}` : ''}
                          {employee.branch?.nameAr ? ` • ${employee.branch.nameAr}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {employee.email ? employee.email : 'لا يوجد بريد إلكتروني'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          employee.isActive
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {employee.isActive ? 'نشط' : 'مغلق'}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs"
                        onClick={() => {
                          setEditingId(employee.id);
                          setForm({
                            fullName: employee.fullName,
                            phone: employee.phone ?? '',
                            email: employee.email ?? '',
                            password: '',
                            confirmPassword: '',
                            role: normalizeRole(employee.role),
                            branchId: employee.branchId ?? '',
                            isActive: employee.isActive
                          });
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-red-400/20 px-3 py-2 text-xs text-red-200"
                        onClick={async () => {
                          await api.deleteEmployee(employee.id);
                          await refresh();
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
