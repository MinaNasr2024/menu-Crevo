import { useEffect, useRef, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const emptyForm = {
  tableNumber: '',
  complaint: ''
};

function formatDateTime(value) {
  if (!value) return 'غير متاح';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function WaiterComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState(null);
  const formRef = useRef(null);

  async function refresh() {
    const data = await api.waiterComplaints();
    setComplaints(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, []);

  useWindowDataChanged(() => {
    refresh().catch(() => {});
  });

  function scrollToForm() {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }

  function startAdd() {
    setSelectedId(null);
    setForm(emptyForm);
    scrollToForm();
  }

  function startEdit(item) {
    setSelectedId(item.id);
    setForm({
      tableNumber: item.tableNumber ?? '',
      complaint: item.complaint ?? ''
    });
    scrollToForm();
  }

  async function saveComplaint() {
    try {
      const payload = {
        tableNumber: String(form.tableNumber ?? '').trim(),
        complaint: String(form.complaint ?? '').trim()
      };
      if (!payload.tableNumber) {
        setToast({ type: 'error', title: 'خطأ', description: 'رقم الطاولة مطلوب' });
        return;
      }
      if (!payload.complaint) {
        setToast({ type: 'error', title: 'خطأ', description: 'الشكوى مطلوبة' });
        return;
      }

      if (selectedId) {
        await api.updateWaiterComplaint(selectedId, payload);
        setToast({ type: 'success', title: 'تم التعديل بنجاح' });
      } else {
        await api.createWaiterComplaint(payload);
        setToast({ type: 'success', title: 'تم الحفظ بنجاح' });
      }

      setForm(emptyForm);
      setSelectedId(null);
      await refresh();
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function deleteComplaint() {
    if (!confirmId) return;
    try {
      await api.deleteWaiterComplaint(confirmId);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setConfirmId(null);
      if (selectedId === confirmId) {
        setSelectedId(null);
        setForm(emptyForm);
      }
      await refresh();
    } catch (error) {
      setConfirmId(null);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  return (
    <AdminShell title="صفحة النادل">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إدارة شكاوى النادل</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">صفحة النادل</h1>
            </div>
            <button type="button" onClick={startAdd} className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
              شكوى جديدة
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-5">
          <div ref={formRef} className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-cream">
                {selectedId ? 'تعديل الشكوى' : 'إضافة شكوى'}
              </h2>
              {selectedId ? <span className="text-xs uppercase tracking-[0.3em] text-gold">ON</span> : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white/75">رقم الطاولة</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-gold"
                  value={form.tableNumber}
                  onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
                  placeholder="مثال: 12"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white/75">الشكوى</span>
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-gold"
                  value={form.complaint}
                  onChange={(e) => setForm({ ...form, complaint: e.target.value })}
                  placeholder="اكتب الشكوى هنا..."
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={saveComplaint} className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
                {selectedId ? 'حفظ التعديل' : 'حفظ'}
              </button>
              <button type="button" onClick={startAdd} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white">
                إلغاء
              </button>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-cream">الشكاوى الحالية</h2>
            <span className="text-xs text-white/50">{complaints.length} شكوى</span>
          </div>

          <div className="mt-4 space-y-3">
            {complaints.map((item, index) => (
              <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs text-white/45">#{index + 1}</div>
                    <div className="mt-1 font-semibold text-white">طاولة رقم {item.tableNumber}</div>
                    <div className="mt-2 max-w-3xl text-sm leading-7 text-white/70">{item.complaint}</div>
                    <div className="mt-2 text-xs text-white/45">{formatDateTime(item.createdAt)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(item.id)}
                      className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="هل أنت متأكد أنك تريد حذف هذه الشكوى؟"
        description="سيتم حذف سجل الشكوى نهائيًا."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={deleteComplaint}
        onCancel={() => setConfirmId(null)}
      />

      <Toast
        open={Boolean(toast)}
        tone={toast?.type ?? 'success'}
        title={toast?.title}
        description={toast?.description}
        durationMs={5000}
        onClose={() => setToast(null)}
      />
    </AdminShell>
  );
}
