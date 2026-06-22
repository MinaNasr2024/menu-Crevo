export function LineBars({ items, labelKey, valueKey }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] ?? 0)));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item[labelKey] ?? item.name_ar ?? item.name_en ?? item.label ?? item.branch_name ?? item.customer_name} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>{item[labelKey] ?? item.name_ar ?? item.name_en ?? item.label ?? item.branch_name ?? item.customer_name}</span>
            <span>{item[valueKey]}</span>
          </div>
          <div className="h-2 rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-gold to-emerald" style={{ width: `${(Number(item[valueKey] ?? 0) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
