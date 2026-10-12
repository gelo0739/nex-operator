import { useEffect, useState } from 'react';
import { BusFront, CalendarCheck, Clock, Flag, Gauge, Info, Mail, MapPinned, Route as RouteIcon, Timer, UserRound } from 'lucide-react';
import Modal from './Modal';
import TripMap from './TripMap';
import {
  getConductorProfile,
  tripRef,
} from '../utils/trips';
import { formatDateLong, formatDuration } from '../utils/format';

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 flex items-start gap-3 min-w-0">
      <div className="w-9 h-9 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-base font-bold text-slate-950 truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-b-0">
      <Icon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      <p className="w-28 shrink-0 text-xs font-semibold text-slate-500">{label}</p>
      <div className="min-w-0 text-sm text-slate-900 break-words">{children}</div>
    </div>
  );
}

/**
 * Full end-of-trip report: completion time, route, average speed, duration,
 * distance, bus and conductor. `conductorName` comes from the page's conductor
 * list; the email is looked up here.
 */
export default function TripReportModal({ trip, conductorName, onClose }) {
  const [conductor, setConductor] = useState({ loaded: false, profile: null });

  useEffect(() => {
    let cancelled = false;
    getConductorProfile(trip.conductorId)
      .then((profile) => !cancelled && setConductor({ loaded: true, profile }))
      .catch(() => !cancelled && setConductor({ loaded: true, profile: null }));
    return () => {
      cancelled = true;
    };
  }, [trip.conductorId]);

  const name = conductorName || conductor.profile?.name || (conductor.loaded ? 'Unknown conductor' : 'Loading…');
  const email = conductor.profile?.email;
  const distance = typeof trip.totalDistanceKm === 'number' ? trip.totalDistanceKm : null;
  const speed = typeof trip.averageSpeedKmh === 'number' ? trip.averageSpeedKmh : null;
  const noDistance = distance === 0;

  return (
    <Modal
      icon={MapPinned}
      title={`Trip ${tripRef(trip.id)}`}
      subtitle={`Completed ${formatDateLong(trip.endTime)}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
        <div className="h-64 shrink-0 rounded-xl overflow-hidden border border-slate-200">
          <TripMap trip={trip} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon={Timer} label="Trip Duration" value={formatDuration(trip.durationSeconds)} />
          <Stat icon={Gauge} label="Average Speed" value={speed === null ? '—' : `${speed.toFixed(1)} km/h`} />
          <Stat icon={RouteIcon} label="Distance" value={distance === null ? '—' : `${distance.toFixed(2)} km`} />
        </div>

        {noDistance && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-800">
            <Info className="w-4 h-4 shrink-0 mt-px" />
            No distance was recorded for this trip — the phone’s GPS may not have moved (e.g. a test trip), so the
            average speed is 0.
          </div>
        )}

        <div className="rounded-xl border border-slate-100 px-4">
          <Row icon={CalendarCheck} label="Completed">
            {formatDateLong(trip.endTime)}
          </Row>
          <Row icon={Clock} label="Started">
            {formatDateLong(trip.startTime)}
          </Row>
          <Row icon={Flag} label="Route">
            {trip.route || <span className="text-slate-400">Not recorded</span>}
          </Row>
          <Row icon={BusFront} label="Bus">
            {trip.busId && trip.busId !== 'UNKNOWN' ? trip.busId : <span className="text-slate-400">Not recorded</span>}
          </Row>
          <Row icon={UserRound} label="Conductor">
            <span className="font-semibold">{name}</span>
            {email && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </span>
            )}
          </Row>
        </div>

        <p className="text-[11px] text-slate-400 font-mono">Trip ID: {trip.id}</p>
      </div>

      <div className="flex justify-end px-6 py-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-white px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
