import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';

const emptyForm = {
  name: '',
  tableNumber: ''
};

function parseError(error) {
  const match = String(error?.message ?? '').match(/\{.*\}$/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export function TableQrPage() {
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [toast, setToast] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const formRef = useRef(null);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedId) ?? null,
    [tables, selectedId]
  );
  async function refresh(preferredId = null) {
    const data = await api.tables();
    setTables(data);
    const nextSelected = preferredId !== null
      ? data.find((table) => table.id === preferredId) ?? null
      : null;
    setSelectedId(nextSelected?.id ?? null);
    setForm(emptyForm);
  }

  useEffect(() => {
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, []);

  useEffect(() => {
    if (!selectedTable) {
      setQrUrl('');
      return undefined;
    }
    const targetUrl = `${window.location.origin}/t/${selectedTable.qrCodeUuid}?session=${encodeURIComponent(selectedTable.sessionUuid ?? '')}`;
    let active = true;
    QRCode.toDataURL(targetUrl, { errorCorrectionLevel: 'H', margin: 1, scale: 24 })
      .then((dataUrl) => {
        if (active) setQrUrl(dataUrl);
      })
      .catch((error) => {
        if (active) setToast({ type: 'error', title: 'خطأ', description: error.message });
      });
    return () => {
      active = false;
    };
  }, [selectedTable]);

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

  function startEdit(table) {
    setSelectedId(table.id);
    setForm({
      name: table.name ?? '',
      tableNumber: table.tableNumber ?? ''
    });
    scrollToForm();
  }

  async function saveTable() {
    try {
      if (!String(form.tableNumber ?? '').trim()) {
        setToast({ type: 'error', title: 'خطأ', description: 'رقم الطاولة مطلوب' });
        return;
      }
      const payload = {
        name: String(form.name ?? '').trim(),
        tableNumber: String(form.tableNumber ?? '').trim()
      };
      if (selectedId) {
        const updated = await api.updateTable(selectedId, payload);
        setToast({ type: 'success', title: 'تم التعديل بنجاح' });
        await refresh(updated.id);
      } else {
        const created = await api.createTable(payload);
        setToast({ type: 'success', title: 'تم الحفظ بنجاح' });
        await refresh(created.id);
      }
    } catch (error) {
      const details = parseError(error);
      setToast({
        type: 'error',
        title: 'خطأ',
        description: details ? JSON.stringify(details) : error.message
      });
    }
  }

  async function regenerateQr() {
    if (!selectedId) return;
    try {
      const rotated = await api.rotateTableQr(selectedId);
      setToast({ type: 'success', title: 'تم توليد QR جديد' });
      await refresh(rotated.id);
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function deleteTable() {
    if (!confirmId) return;
    try {
      await api.deleteTable(confirmId);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setConfirmId(null);
      if (selectedId === confirmId) {
        startAdd();
      }
      await refresh();
    } catch (error) {
      setConfirmId(null);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function closeTable(table) {
    const tableUuid = table?.qrCodeUuid ?? '';
    const currentPhone = table?.currentPhone ?? '';
    const sessionUuid = table?.sessionUuid ?? '';
    if (!tableUuid) {
      setToast({ type: 'error', title: 'خطأ', description: 'بيانات QR غير مكتملة' });
      return;
    }

    if (closingId === table.id) return;
    setClosingId(table.id);
    try {
      setTables((current) => current.map((item) => (
        String(item.id) === String(table.id)
          ? {
              ...item,
              currentPhone: '',
              openedAt: null
            }
          : item
      )));
      await api.closeTable({
        uuid: tableUuid,
        ...(currentPhone ? { phone: currentPhone } : {}),
        ...(sessionUuid ? { session: sessionUuid } : {})
      });
      setToast({ type: 'success', title: 'تم إغلاق الطاولة' });
      await refresh(table.id);
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
      await refresh(table.id).catch(() => {});
    } finally {
      setClosingId((current) => (current === table.id ? null : current));
    }
  }

  function download() {
    if (!qrUrl || !selectedTable) return;
    const anchor = document.createElement('a');
    anchor.href = qrUrl;
    anchor.download = `table-${selectedTable.tableNumber}-qr.png`;
    anchor.click();
  }

  const targetUrl = selectedTable
    ? `${window.location.origin}/t/${selectedTable.qrCodeUuid}?session=${encodeURIComponent(selectedTable.sessionUuid ?? '')}`
    : '';

  function getTableTargetUrl(table) {
    return `${window.location.origin}/t/${table.qrCodeUuid}?session=${encodeURIComponent(table.sessionUuid ?? '')}`;
  }

  return (
    <AdminShell title="مولد QR للطاولات">
      <div className="space-y-6 text-right">
        <section className="glass-panel rounded-[32px] p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">QR</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">إدارة QR للطاولات</h1>
              <p className="mt-2 text-sm text-white/65">أضف اسم الطاولة ورقمها، ثم ولّد الرابط أو غيّره عند الإغلاق.</p>
            </div>
            <button
              type="button"
              onClick={startAdd}
              className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink"
            >
              طاولة جديدة
            </button>
          </div>
        </section>

        <section ref={formRef} className="glass-panel rounded-[32px] p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-cream">
                {selectedId ? 'تعديل QR' : 'إضافة QR'}
              </h2>
              {selectedId ? <span className="text-xs uppercase tracking-[0.3em] text-gold">ON</span> : null}
            </div>

            <div className="mt-4 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white/75">اسم الـ QR</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-gold"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: طاولة النافذة"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white/75">رقم الطاولة</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-gold"
                  value={form.tableNumber}
                  onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
                  placeholder="مثال: 12"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={saveTable} className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
                  {selectedId ? 'حفظ التعديل' : 'حفظ و توليد'}
                </button>
                <button type="button" onClick={regenerateQr} disabled={!selectedId} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                  توليد QR جديد
                </button>
              </div>

              {selectedTable ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
                  <div className="font-semibold text-white">الرابط الحالي</div>
                  <div className="mt-1 break-all text-xs text-white/55">{targetUrl}</div>
                </div>
              ) : null}

              <div className="inline-flex rounded-[20px] bg-white">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR code" className="h-[200px] w-[200px] rounded-[20px] object-contain" />
                ) : (
                  <div className="flex h-[200px] w-[200px] items-center justify-center rounded-[20px] bg-slate-100 text-sm text-slate-500">
                    اختر طاولة أو احفظ طاولة جديدة
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={download}
                disabled={!qrUrl}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                تنزيل QR
              </button>
            </div>
        </section>

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-cream">كل QR الطاولات</h2>
            <span className="text-xs text-white/50">{tables.length} طاولة</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-y-3 text-right">
              <thead>
                <tr className="text-xs uppercase tracking-[0.25em] text-white/40">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">اسم الـ QR</th>
                  <th className="px-3 py-2">رقم الطاولة</th>
                  <th className="px-3 py-2">الحالة</th>
                  <th className="px-3 py-2">الرابط</th>
                  <th className="px-3 py-2">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((table, index) => (
                  <tr key={table.id} className="rounded-2xl bg-white/5 text-sm text-white/80">
                    <td className="rounded-r-2xl px-3 py-4 font-semibold text-white">{index + 1}</td>
                    <td className="px-3 py-4">
                      <div className="font-semibold text-white">{table.name || table.tableNumber}</div>
                      <div className="mt-1 text-xs text-white/45">{table.qrCodeUuid}</div>
                    </td>
                    <td className="px-3 py-4">{table.tableNumber}</td>
                    <td className="px-3 py-4">
                      {table.currentPhone ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                          مفتوحة حاليًا
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/55">
                          مغلقة
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <div className="max-w-[280px] truncate text-xs text-white/60">{getTableTargetUrl(table)}</div>
                    </td>
                    <td className="rounded-l-2xl px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(table)}
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => closeTable(table)}
                          disabled={closingId === table.id || !table.currentPhone}
                          className="rounded-xl border border-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          إغلاق الطاولة
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(table.id)}
                          className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="هل أنت متأكد أنك تريد حذف هذا الـ QR؟"
        description="سيتم حذف الطاولة والـ QR المرتبط بها."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={deleteTable}
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
