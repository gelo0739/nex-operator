import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Bus, CheckCheck, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useNewFeedback from '../hooks/useNewFeedback';
import useUnavailableBuses from '../hooks/useUnavailableBuses';
import { hasPosition } from '../utils/unavailableBuses';
import StarRating from './StarRating';
import CategoryPill from './CategoryPill';
import { feedbackCategories } from '../utils/feedback';
import { formatDateTime } from '../utils/format';
import { clearNotifications } from '../utils/notificationServices';

const PREVIEW_COUNT = 5;

/**
 * Header bell: live alerts for buses on the line marked unavailable by a
 * conductor (RTDB unavailableBuses) + "new" passenger feedback, with a preview
 * popover. An unavailable alert opens the bus's reported location on the
 * Fleet Overview map. "Clear" dismisses the current notifications for this
 * operator only (stored as `notificationsClearedAt` on their profile); the
 * feedback stays "New" and the bus stays unavailable (on the map) until
 * someone acts on it.
 */
export default function NotificationBell() {
  const { user, profile, busLine } = useAuth();
  const clearedAt = profile?.notificationsClearedAt ?? null;
  const { items, count: feedbackCount, capped } = useNewFeedback(busLine, clearedAt);
  const clearedMs = clearedAt?.toMillis?.() ?? 0;
  const unavailable = useUnavailableBuses(busLine).filter((bus) => (bus.unavailableAt ?? 0) > clearedMs);
  const count = feedbackCount + unavailable.length;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState(null);
  const containerRef = useRef(null);

  const handleClear = async () => {
    setClearing(true);
    setClearError(null);
    try {
      await clearNotifications(user.uid);
    } catch (error) {
      setClearError(error.message);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const countLabel = capped ? `${count}+` : String(count);
  const feedbackCountLabel = capped ? `${feedbackCount}+` : String(feedbackCount);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `${countLabel} new notifications` : 'Notifications'}
        aria-expanded={open}
        className="p-2 text-slate-600 hover:bg-slate-200/60 rounded-full relative transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#f4f6fa]">
            {countLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-2xl border border-slate-200/70 shadow-xl shadow-slate-900/10 overflow-hidden z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-950">Notifications</p>
              {count > 0 && <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">{countLabel}</span>}
            </div>
            {count > 0 && (
              <button
                onClick={handleClear}
                disabled={clearing}
                title="Dismiss these notifications (feedback stays New and unavailable buses stay on the map)"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                Clear
              </button>
            )}
          </div>
          {clearError && <p className="px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border-b border-red-100">{clearError}</p>}

          {count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCheck className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-900">You’re all caught up</p>
              <p className="text-xs text-slate-500">Unavailable buses and new passenger feedback will show up here.</p>
            </div>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
              {unavailable.map((bus) => (
                <li key={`unavailable-${bus.busId}`}>
                  <button
                    onClick={() => go(`/dashboard?unavailable=${encodeURIComponent(bus.busId)}`)}
                    className="w-full text-left px-4 py-3 bg-red-50/40 hover:bg-red-50 transition-colors cursor-pointer flex items-start gap-3"
                  >
                    <div className="w-8 h-8 shrink-0 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                      <Bus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-red-700">{bus.busId} marked unavailable</p>
                        <span className="text-[11px] text-slate-400 shrink-0">{formatDateTime(bus.unavailableAt)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 truncate">
                        {bus.source === 'operator'
                          ? 'Set unavailable by an operator'
                          : `${bus.conductorName || 'A conductor'}${bus.routeName ? ` · ${bus.routeName}` : ''}`}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                        <MapPin className="w-3 h-3" />
                        {hasPosition(bus) ? 'View location on map' : 'Location unknown · view on Fleet Overview'}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
              {items.slice(0, PREVIEW_COUNT).map((feedback) => {
                const [firstTag] = feedbackCategories(feedback);
                return (
                  <li key={feedback.id}>
                    <button
                      onClick={() => go(`/feedback?open=${feedback.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StarRating value={feedback.rating} size="w-3 h-3" />
                        <span className="text-[11px] text-slate-400">{formatDateTime(feedback.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700 line-clamp-2">{feedback.comment || '—'}</p>
                      {firstTag && (
                        <div className="mt-1.5">
                          <CategoryPill label={firstTag} />
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            onClick={() => go(feedbackCount > 0 ? '/feedback?status=new' : '/feedback')}
            className="w-full flex items-center justify-center gap-1 px-4 py-3 text-xs font-semibold text-blue-700 bg-slate-50 hover:bg-blue-50 border-t border-slate-100 cursor-pointer"
          >
            {feedbackCount > 0 ? `View all new feedback (${feedbackCountLabel})` : 'Open Passenger Feedback'}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
