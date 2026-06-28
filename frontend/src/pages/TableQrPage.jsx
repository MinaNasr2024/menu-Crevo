import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { api, getQrGatewayBase } from '../lib/api';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

function getTableSortValue(tableNumber) {
  const parsed = Number.parseInt(String(tableNumber ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function getNextTableNumber(tables) {
  const maxNumber = tables.reduce((max, table) => {
    const current = getTableSortValue(table.tableNumber ?? table.table_number);
    return current > max ? current : max;
  }, 0);
  return String(maxNumber + 1);
}

function getMissingTableNumbers(tables) {
  const values = tables
    .map((table) => getTableSortValue(table.tableNumber ?? table.table_number))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!values.length) return [];
  const existing = new Set(values);
  const maxNumber = values[values.length - 1];
  const missing = [];
  for (let i = 1; i <= maxNumber; i += 1) {
    if (!existing.has(i)) missing.push(String(i));
  }
  return missing;
}

function formatTableLabel(table) {
  const stateLabel = (table.currentPhone ?? table.current_phone) ? 'مفتوحة' : 'مقفولة';
  return `طاولة رقم ${table.tableNumber ?? table.table_number ?? ''} • ${stateLabel}`;
}

function parseError(error) {
  const match = String(error?.message ?? '').match(/\{.*\}$/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function getTableTargetUrl(table) {
  const origin = getQrGatewayBase();
  return new URL(`/menu?table=${encodeURIComponent(table.qrCodeUuid ?? table.qr_code_uuid ?? '')}`, origin).toString();
}

export function TableQrPage() {
  const [tables, setTables] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [toast, setToast] = useState(null);
  const [generatePrompt, setGeneratePrompt] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const refreshSeqRef = useMemo(() => ({ current: 0 }), []);
  const closedTableAtRef = useMemo(() => ({ current: new Map() }), []);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedId) ?? null,
    [tables, selectedId]
  );
  const sortedTables = useMemo(
    () => [...tables].sort((a, b) => getTableSortValue(a.tableNumber) - getTableSortValue(b.tableNumber)),
    [tables]
  );
  const nextTableNumber = useMemo(() => getNextTableNumber(tables), [tables]);
  const missingTableNumbers = useMemo(() => getMissingTableNumbers(tables), [tables]);

  function normalizeTableState(table) {
    if (!table?.id) return table;
    const closedAt = closedTableAtRef.current.get(String(table.id));
    if (!closedAt) return table;

    const openedAtMs = table.openedAt || table.opened_at
      ? new Date(table.openedAt ?? table.opened_at).getTime()
      : null;
    const hasCurrentPhone = Boolean(String(table.currentPhone ?? table.current_phone ?? '').trim());

    if (!hasCurrentPhone) {
      closedTableAtRef.current.delete(String(table.id));
      return table;
    }

    if (openedAtMs && openedAtMs > closedAt) {
      closedTableAtRef.current.delete(String(table.id));
      return table;
    }

    return {
      ...table,
      currentPhone: '',
      current_phone: '',
      openedAt: null,
      opened_at: null,
      invoiceRequestedAt: null,
      invoice_requested_at: null
    };
  }

  async function refresh(preferredId = null) {
    const refreshSeq = ++refreshSeqRef.current;
    const data = (await api.tables()).map((table) => normalizeTableState(table));
    if (refreshSeq !== refreshSeqRef.current) return;
    setTables(data);
    if (preferredId !== null) {
      const nextSelected = data.find((table) => table.id === preferredId) ?? null;
      setSelectedId(nextSelected?.id ?? null);
    } else {
      setSelectedId((currentSelectedId) => (
        currentSelectedId ? data.some((table) => table.id === currentSelectedId) ? currentSelectedId : null : null
      ));
    }
  }

  useEffect(() => {
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, []);

  useWindowDataChanged(() => {
    refresh(selectedId).catch(() => {});
  });

  useEffect(() => {
    if (!selectedTable) {
      setQrUrl('');
      return undefined;
    }

    const targetUrl = getTableTargetUrl(selectedTable);
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

  async function createQrForNumber(tableNumber) {
    try {
      const created = await api.createTable({ tableNumber });
      setToast({ type: 'success', title: 'تم توليد QR جديد' });
      await refresh(created.id);
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
    if (missingTableNumbers.length) {
      setGeneratePrompt({
        missingNumbers: missingTableNumbers,
        fallbackNumber: nextTableNumber
      });
      return;
    }
    await createQrForNumber(nextTableNumber);
  }

  async function startAdd() {
    await regenerateQr();
  }

  async function deleteTable() {
    if (!confirmId) return;
    const targetTable = tables.find((table) => table.id === confirmId) ?? null;
    if (targetTable?.currentPhone) {
      setToast({ type: 'error', title: 'خطأ', description: 'الرجاء إغلاق الطاولة أولًا ثم حذف الـ QR' });
      setConfirmId(null);
      return;
    }

    try {
      await api.deleteTable(confirmId);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setConfirmId(null);
      if (selectedId === confirmId) {
        setSelectedId(null);
      }
      await refresh();
    } catch (error) {
      setConfirmId(null);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function closeTable(table) {
    const tableUuid = table?.qrCodeUuid ?? table?.qr_code_uuid ?? '';
    const currentPhone = table?.currentPhone ?? table?.current_phone ?? '';
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
              current_phone: '',
              openedAt: null,
              opened_at: null,
              invoiceRequestedAt: null,
              invoice_requested_at: null
            }
          : item
      )));
      await api.closeTable({
        uuid: tableUuid,
        phone: currentPhone || undefined
      });
      closedTableAtRef.current.set(String(table.id), Date.now());
      setToast({ type: 'success', title: 'تم إغلاق الطاولة' });
      setTables((current) => current.map((item) => (
        String(item.id) === String(table.id)
          ? {
              ...item,
              currentPhone: '',
              current_phone: '',
              openedAt: null,
              opened_at: null,
              invoiceRequestedAt: null,
              invoice_requested_at: null,
              sessionUuid: item.sessionUuid ?? table.sessionUuid ?? table.session_uuid,
              session_uuid: item.session_uuid ?? table.sessionUuid ?? table.session_uuid
            }
          : item
      )));
      if (selectedId === table.id) {
        setSelectedId(table.id);
      }
      refresh(table.id).catch((refreshError) => {
        console.warn('[TableQrPage] refresh after close failed', refreshError);
      });
    } catch (error) {
      try {
        await api.closeTable({
          uuid: tableUuid,
          phone: currentPhone || undefined
        });
        closedTableAtRef.current.set(String(table.id), Date.now());
        setToast({ type: 'success', title: 'تم إغلاق الطاولة' });
        refresh(table.id).catch((refreshError) => {
          console.warn('[TableQrPage] refresh after retry close failed', refreshError);
        });
        return;
      } catch (retryError) {
        console.error('[TableQrPage] closeTable retry failed', retryError);
      }
      console.error('[TableQrPage] closeTable failed', error);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
      await refresh(table.id).catch(() => {});
    } finally {
      setClosingId((current) => (current === table.id ? null : current));
    }
  }

  async function downloadSelected() {
    if (!qrUrl || !selectedTable) return;
    const anchor = document.createElement('a');
    anchor.href = qrUrl;
    anchor.download = `table-${selectedTable.tableNumber ?? selectedTable.table_number ?? ''}-qr.png`;
    anchor.click();
  }

  async function downloadTable(table) {
    try {
      const url = getTableTargetUrl(table);
      const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 1, scale: 24 });
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = `table-${table.tableNumber ?? table.table_number ?? ''}-qr.png`;
      anchor.click();
    } catch (error) {
      console.error('[TableQrPage] closeTable failed', error);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  return (
    <AdminShell title="مولد QR للطاولات">
      <div className="space-y-6 text-right">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">QR</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">إدارة QR للطاولات</h1>
              <p className="mt-2 text-sm text-white/65">
                اختر طاولة موجودة من القائمة أو أنشئ طاولة جديدة تلقائيًا بدون كتابة رقم يدويًا.
              </p>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-cream">QR الطاولات</h2>
              <p className="mt-1 text-xs text-white/45">
                توليد QR جديد الآن سيستخدم أول رقم ناقص إن وجد، أو آخر رقم + 1 إذا لم توجد فجوات.
              </p>
            </div>
            <button
              type="button"
              onClick={regenerateQr}
              className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink"
            >
              توليد QR جديد
            </button>
          </div>

          {selectedTable ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
              <div className="font-semibold text-white">الطاولة الحالية</div>
              <div className="mt-1 break-all text-xs text-white/55">{getTableTargetUrl(selectedTable)}</div>
            </div>
          ) : null}

          <div className="mt-4 inline-flex rounded-[20px] bg-white p-0">
            {qrUrl ? (
              <img src={qrUrl} alt="QR code" className="h-[200px] w-[200px] rounded-[20px] object-contain" />
            ) : (
              <div className="flex h-[200px] w-[200px] items-center justify-center rounded-[20px] bg-slate-100 text-sm text-slate-500">
                اضغط توليد QR جديد
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={downloadSelected}
            disabled={!qrUrl}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            تنزيل QR
          </button>
        </section>

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-cream">QR الطاولات</h2>
            <span className="text-xs text-white/50">{tables.length} طاولة</span>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {sortedTables.map((table, index) => (
              <div key={table.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-white/45">#{index + 1}</div>
                    <div className="mt-1 font-semibold text-white">طاولة رقم {table.tableNumber ?? table.table_number ?? ''}</div>
                    <div className="mt-1 text-xs text-white/45">{table.qrCodeUuid ?? table.qr_code_uuid ?? ''}</div>
                  </div>
                  {table.currentPhone ?? table.current_phone ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                      مفتوحة
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/55">
                      مقفولة
                    </span>
                  )}
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs break-all text-white/60">
                  {getTableTargetUrl(table)}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => closeTable(table)}
                    disabled={closingId === table.id}
                    className="rounded-xl border border-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    إغلاق
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTable(table)}
                    className="rounded-xl border border-sky-400/20 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    تنزيل QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(table.id)}
                    className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-[860px] border-separate border-spacing-y-3 text-right">
              <thead>
                <tr className="text-xs uppercase tracking-[0.25em] text-white/40">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">رقم الطاولة</th>
                  <th className="px-3 py-2">الحالة</th>
                  <th className="px-3 py-2">الربط</th>
                  <th className="px-3 py-2">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {sortedTables.map((table, index) => (
                  <tr key={table.id} className="rounded-2xl bg-white/5 text-sm text-white/80">
                    <td className="rounded-r-2xl px-3 py-4 font-semibold text-white">{index + 1}</td>
                    <td className="px-3 py-4 font-semibold text-white">طاولة رقم {table.tableNumber ?? table.table_number ?? ''}</td>
                    <td className="px-3 py-4">
                      {table.currentPhone ?? table.current_phone ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                          مفتوحة حاليًا
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/55">
                          مقفولة
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
                          onClick={() => closeTable(table)}
                          disabled={closingId === table.id}
                          className="rounded-xl border border-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          إغلاق الطاولة
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadTable(table)}
                          className="rounded-xl border border-sky-400/20 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          تنزيل QR
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
        title="هل تريد حذف هذا الـ QR؟"
        description="إذا كانت الطاولة مفتوحة، أغلقها أولًا ثم احذف الـ QR."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={deleteTable}
        onCancel={() => setConfirmId(null)}
      />

      <ConfirmDialog
        open={Boolean(generatePrompt)}
        title="أرقام محذوفة موجودة"
        description={generatePrompt ? `وجدت أرقامًا محذوفة: ${generatePrompt.missingNumbers.join('? ')}. هل تريد توليد أول رقم مفقود الآن؟` : ''}
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={async () => {
          const prompt = generatePrompt;
          setGeneratePrompt(null);
          if (!prompt) return;
          await createQrForNumber(prompt.missingNumbers[0] ?? prompt.fallbackNumber);
        }}
        onCancel={async () => {
          const prompt = generatePrompt;
          setGeneratePrompt(null);
          if (!prompt) return;
          await createQrForNumber(prompt.fallbackNumber);
        }}
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



