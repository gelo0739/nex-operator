const TONES = {
  blue: { pill: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  amber: { pill: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  emerald: { pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  slate: { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
};

/** Small rounded status pill with a colored dot (feedback / lost-item statuses). */
export default function StatusPill({ tone = 'slate', label }) {
  const { pill, dot } = TONES[tone] ?? TONES.slate;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
