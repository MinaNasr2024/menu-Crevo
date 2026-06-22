export function StatCard({ label, value, detail }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-white/40">{label}</p>
      <div className="mt-3 text-3xl font-bold text-cream">{value}</div>
      {detail ? <p className="mt-2 text-sm text-white/60">{detail}</p> : null}
    </div>
  );
}
