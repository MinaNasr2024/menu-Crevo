import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../lib/api';
import { getApiBase, getSocketBase } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

function playPing() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  context.resume?.().catch(() => {});

  const scheduleTone = (startTime, frequency, duration = 0.18, volume = 0.12) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  };

  const now = context.currentTime;
  scheduleTone(now, 1040, 0.16, 0.14);
  scheduleTone(now + 0.18, 1320, 0.16, 0.14);
  scheduleTone(now + 0.36, 980, 0.22, 0.16);
}

export function WaiterLiveMonitor({ calls, onNewCall, onCompleteCall }) {
  const { lang } = useLanguage();
  const socketRef = useRef(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const socket = io(getSocketBase() || getApiBase(), { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('waiter:call:new', (payload) => {
      playPing();
      onNewCall(payload);
    });
    socket.emit('join:admin');
    return () => socket.disconnect();
  }, [onNewCall]);

  async function markDone(callId) {
    try {
      setBusyId(callId);
      await api.completeCall(callId);
      onCompleteCall?.(callId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {calls.map((call) => (
        <div key={call.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cream">
                {lang === 'ar'
                  ? `الطاولة ${call.table?.tableNumber ?? call.tableNumber}`
                  : `Table ${call.table?.tableNumber ?? call.tableNumber}`}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.3em] text-white/40">
                {lang === 'ar'
                  ? ({ pending: 'قيد الانتظار', acknowledged: 'تم الاستلام', completed: 'مكتمل' }[call.status] ?? call.status)
                  : call.status}
              </p>
            </div>
            <button
              type="button"
              onClick={() => markDone(call.id)}
              disabled={busyId === call.id}
              className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyId === call.id ? '...' : 'تم'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
