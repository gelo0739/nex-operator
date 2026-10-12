/** Micro-labelled block in the details pop-ups ("Comment", "Contact", …). */
export default function DetailSection({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {children}
    </div>
  );
}
