import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Armchair,
  Check,
  Loader2,
  Mail,
  PackageSearch,
  Phone,
  Route as RouteIcon,
  Tag,
  UserRound,
} from 'lucide-react';
import Modal from './Modal';
import DetailSection from './DetailSection';
import PhotoTile from './PhotoTile';
import LostItemStatusBadge from './LostItemStatusBadge';
import { useAuth } from '../context/AuthContext';
import {
  LOST_ITEM_STATUSES,
  MAX_LOST_ITEM_NOTE_LENGTH,
  getReporterEmail,
  isResolvedStatus,
  lostItemRef,
  lostItemStatus,
  updateLostItemStatus,
} from '../utils/lostItems';
import { formatDateLong, formatDateTime24 } from '../utils/format';

function InfoRow({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-800 min-w-0">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

/**
 * Full lost-item report (item + contact details, private photos) and the
 * operator's resolution: status + note. `onStatusSaved(patch)` lets the caller
 * update its copy of the row without refetching.
 */
export default function LostItemDetailsModal({ report, onClose, onStatusSaved }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(lostItemStatus(report));
  const [note, setNote] = useState(report.operatorNote ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [reporter, setReporter] = useState({ loaded: false, email: null });

  const dirty = status !== lostItemStatus(report) || note.trim() !== (report.operatorNote ?? '').trim();
  const purged = Boolean(report.photosPurgedAt);

  useEffect(() => {
    if (!report.userId) return undefined;
    let cancelled = false;
    getReporterEmail(report.userId)
      .then((email) => !cancelled && setReporter({ loaded: true, email }))
      .catch(() => !cancelled && setReporter({ loaded: true, email: null }));
    return () => {
      cancelled = true;
    };
  }, [report.userId]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const patch = await updateLostItemStatus(report.id, { status, note }, user);
      onStatusSaved?.(patch);
      setSavedAt(Date.now());
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const reporterText = !report.userId
    ? 'Not recorded (older report)'
    : !reporter.loaded
      ? 'Loading…'
      : reporter.email || 'Deleted account';

  return (
    <Modal
      icon={PackageSearch}
      iconClassName="bg-amber-50 text-amber-600"
      title={`ID: #${lostItemRef(report.id)}`}
      subtitle={`Reported ${formatDateLong(report.createdAt)}`}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px] gap-6 p-6 max-h-[62vh] overflow-y-auto">
        <div className="flex flex-col gap-5 min-w-0">
          <DetailSection label="Item Description">
            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words rounded-xl bg-slate-50 border border-slate-100 p-4">
              {report.description || <span className="text-slate-400">No description</span>}
            </p>
          </DetailSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailSection label="Category">
              <InfoRow icon={Tag}>{report.category || '—'}</InfoRow>
            </DetailSection>
            <DetailSection label="Seat Location">
              <InfoRow icon={Armchair}>{report.seatLocation || 'Not specified'}</InfoRow>
            </DetailSection>
            <div className="sm:col-span-2">
              <DetailSection label="Trip / Route">
                <InfoRow icon={RouteIcon}>{report.routeName || 'Not specified'}</InfoRow>
              </DetailSection>
            </div>
          </div>

          <DetailSection label="Contact">
            <div className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3">
              <InfoRow icon={UserRound}>{report.contactName || '—'}</InfoRow>
              {report.contactPhone ? (
                <a href={`tel:${report.contactPhone}`} className="flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline w-fit">
                  <Phone className="w-4 h-4 shrink-0" />
                  {report.contactPhone}
                </a>
              ) : (
                <InfoRow icon={Phone}>—</InfoRow>
              )}
              <InfoRow icon={Mail}>{reporterText}</InfoRow>
            </div>
          </DetailSection>
        </div>

        <div className="flex flex-col gap-4">
          <PhotoTile label="Item Photo" path={report.photoPath} legacyUrl={report.photoUrl} purged={purged} />
          <PhotoTile label="Bus Ticket" path={report.ticketPhotoPath} legacyUrl={report.ticketPhotoUrl} purged={purged} />
        </div>
      </div>

      {/* RESOLUTION */}
      <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resolution</p>
          {report.statusUpdatedAt && (
            <p className="text-[11px] text-slate-500">
              Last updated by {report.statusUpdatedByEmail || 'an operator'} · {formatDateTime24(report.statusUpdatedAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Report status">
          {LOST_ITEM_STATUSES.map((option) => {
            const active = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStatus(option.value)}
                disabled={saving}
                className={`rounded-xl border px-3 py-1.5 transition-colors cursor-pointer ${
                  active ? 'border-blue-500 bg-white ring-2 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <LostItemStatusBadge status={option.value} />
              </button>
            );
          })}
        </div>
        {isResolvedStatus(status) && !isResolvedStatus(lostItemStatus(report)) && (
          <p className="text-[11px] text-slate-500">
            Resolving starts the 6-month retention period — this report’s photos are deleted automatically afterwards.
          </p>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="sr-only">Operator note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, MAX_LOST_ITEM_NOTE_LENGTH))}
            rows={2}
            placeholder="Add a note (e.g. where the item was found, who picked it up)…"
            disabled={saving}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-y focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <span className="text-[11px] text-slate-400 text-right">
            {note.length}/{MAX_LOST_ITEM_NOTE_LENGTH}
          </span>
        </label>
        {saveError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs font-medium text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            {saveError}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
        {savedAt && !dirty && (
          <span className="mr-auto flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <Check className="w-4 h-4" />
            Status saved
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-2 text-xs font-semibold text-slate-700 px-5 py-2.5 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Status
        </button>
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
