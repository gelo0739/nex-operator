// Shared look for the selects / date inputs inside a FilterField.
export const FILTER_CONTROL_CLASS =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

/** Labelled filter control (select / date input) for the report filter bars. */
export default function FilterField({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
