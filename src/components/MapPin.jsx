import { Bus } from 'lucide-react';

/**
 * Custom map pin designs, rendered inside <AdvancedMarker>.
 * Variants:
 *  - 'start'    blue-ring dot   (use anchor="center")
 *  - 'waypoint' numbered dot    (use anchor="center")
 *  - 'end'      red teardrop    (anchor="bottom")
 *  - 'bus'      blue label pill (anchor="bottom")
 */
export default function MapPin({ variant, label, draggable = false }) {
  const grab = draggable ? 'cursor-grab active:cursor-grabbing' : '';

  if (variant === 'start') {
    return (
      <div className={`w-6 h-6 rounded-full bg-white border-[5px] border-blue-700 shadow-md shadow-blue-900/30 transition-transform hover:scale-110 ${grab}`} />
    );
  }

  if (variant === 'waypoint') {
    return (
      <div
        className={`w-6 h-6 rounded-full bg-white border-2 border-slate-700 shadow-md flex items-center justify-center text-[10px] font-extrabold text-slate-800 transition-transform hover:scale-110 hover:ring-4 hover:ring-blue-500/25 ${grab}`}
      >
        {label}
      </div>
    );
  }

  if (variant === 'end') {
    return (
      <svg
        width="30"
        height="40"
        viewBox="0 0 30 40"
        className={`drop-shadow-md transition-transform hover:-translate-y-0.5 ${grab}`}
        aria-hidden
      >
        <path
          d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1z"
          fill="#dc2626"
          stroke="#991b1b"
          strokeWidth="1.5"
        />
        <circle cx="15" cy="15" r="5.5" fill="#ffffff" />
      </svg>
    );
  }

  // 'bus'
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-bold pl-1.5 pr-2.5 py-1 rounded-full shadow-lg shadow-blue-600/30 whitespace-nowrap">
        <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
          <Bus className="w-3 h-3" />
        </span>
        {label}
      </div>
      <div className="w-2 h-2 -mt-1 rotate-45 bg-blue-600" />
    </div>
  );
}
