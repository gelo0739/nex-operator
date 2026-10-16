import { Bus, TriangleAlert } from 'lucide-react';

/**
 * Custom map pin designs, rendered inside <AdvancedMarker>.
 * Variants:
 *  - 'start'      blue-ring dot   (use anchor="center")
 *  - 'waypoint'   numbered dot    (use anchor="center")
 *  - 'end'        red teardrop    (anchor="bottom")
 *  - 'bus'        blue label pill (anchor="bottom"). `active` lifts it off the
 *                 map with a spring (focused bus); `dimmed` fades it (another
 *                 bus is focused).
 *  - 'inoperable' red label pill with a warning icon (anchor="bottom") — a bus
 *                 marked inoperable. `active` / `dimmed` as for 'bus'.
 */
export default function MapPin({ variant, label, draggable = false, active = false, dimmed = false }) {
  const grab = draggable ? 'cursor-grab active:cursor-grabbing' : '';

  if (variant === 'inoperable') {
    return (
      <div className={`relative flex flex-col items-center pb-1 transition-opacity duration-300 ${dimmed ? 'opacity-55' : 'opacity-100'}`}>
        <div
          className={`flex flex-col items-center origin-bottom transition-transform duration-300 motion-reduce:transition-none ${
            active ? '-translate-y-2 scale-110 motion-reduce:translate-y-0 motion-reduce:scale-100' : ''
          }`}
        >
          <div
            className={`flex items-center gap-1.5 text-white text-[11px] font-bold pl-1.5 pr-2.5 py-1 rounded-full whitespace-nowrap ${
              active
                ? 'bg-red-700 ring-4 ring-red-500/30 shadow-2xl shadow-red-900/40'
                : 'bg-red-600 shadow-lg shadow-red-600/30 hover:bg-red-700'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <TriangleAlert className="w-3 h-3" />
            </span>
            {label} · Inoperable
          </div>
          <div className={`w-2 h-2 -mt-1 rotate-45 ${active ? 'bg-red-700' : 'bg-red-600'}`} />
        </div>
        <div aria-hidden className="absolute bottom-0 w-3 h-1.5 rounded-full bg-slate-900 blur-[2px] opacity-30" />
      </div>
    );
  }

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

  // 'bus' — the pin and its ground shadow animate together: when `active`, the
  // pin springs up (and grows a little) while the shadow under its tip spreads
  // and softens, so it reads as lifting off the map. Reversing `active` lets
  // it settle back down. Reduced-motion users get the colour/ring change only.
  const spring = 'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none';
  return (
    <div className={`relative flex flex-col items-center pb-1 transition-opacity duration-300 ${dimmed ? 'opacity-55' : 'opacity-100'}`}>
      <div
        className={`flex flex-col items-center origin-bottom ${spring} ${
          active ? '-translate-y-2 scale-110 motion-reduce:translate-y-0 motion-reduce:scale-100' : 'translate-y-0 scale-100'
        }`}
      >
        <div
          className={`flex items-center gap-1.5 text-white text-[11px] font-bold pl-1.5 pr-2.5 py-1 rounded-full whitespace-nowrap ${spring} ${
            active
              ? 'bg-blue-700 ring-4 ring-blue-500/30 shadow-2xl shadow-blue-900/40'
              : 'bg-blue-600 shadow-lg shadow-blue-600/30 hover:bg-blue-700'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
            <Bus className="w-3 h-3" />
          </span>
          {label}
        </div>
        <div className={`w-2 h-2 -mt-1 rotate-45 ${spring} ${active ? 'bg-blue-700' : 'bg-blue-600'}`} />
      </div>
      {/* Ground shadow under the tip */}
      <div
        aria-hidden
        className={`absolute bottom-0 h-1.5 rounded-full bg-slate-900 blur-[2px] ${spring} ${
          active ? 'w-9 opacity-25' : 'w-3 opacity-30'
        }`}
      />
    </div>
  );
}
