import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Reusable pop-up shell: dimmed backdrop + centered white card with an icon
 * header and close button. Closes on Escape or a backdrop click.
 */
export default function Modal({ icon: Icon, iconClassName = 'bg-blue-50 text-blue-600', title, subtitle, onClose, maxWidth = 'max-w-lg', children }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className={`w-full ${maxWidth} bg-white rounded-3xl shadow-2xl border border-slate-100`}>
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-0">
          {Icon && (
            <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${iconClassName}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -m-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
