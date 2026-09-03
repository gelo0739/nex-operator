
/**
 * Temporary empty-state body for pages that are routed and in the nav but not
 * built out yet. Drop this once the real page content lands.
 */
export default function PagePlaceholder({ icon: Icon, title, description }) {
  return (
    <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center p-10">
      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-4">
        {Icon && <Icon className="w-8 h-8" />}
      </div>
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        Coming soon
      </span>
    </div>
  );
}
