import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, MessageSquare, Route as RouteIcon, UserRound } from 'lucide-react';
import Modal from './Modal';
import DetailSection from './DetailSection';
import PhotoTile from './PhotoTile';
import StarRating from './StarRating';
import CategoryPill from './CategoryPill';
import FeedbackStatusBadge from './FeedbackStatusBadge';
import { useAuth } from '../context/AuthContext';
import {
  FEEDBACK_STATUSES,
  MAX_OPERATOR_NOTE_LENGTH,
  feedbackCategories,
  feedbackStatus,
  getSubmitterEmail,
  updateFeedbackReview,
} from '../utils/feedback';
import { formatDateLong, formatDateTime } from '../utils/format';

/**
 * Full review of one passenger feedback, including the private ticket photo,
 * plus the operator's review (status + note). `onReviewSaved(patch)` lets the
 * caller update its copy of the row without refetching.
 */
export default function FeedbackDetailsModal({ feedback, onClose, onReviewSaved }) {
  const { user } = useAuth();
  const [reviewStatus, setReviewStatus] = useState(feedbackStatus(feedback));
  const [note, setNote] = useState(feedback.operatorNote ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const reviewDirty = reviewStatus !== feedbackStatus(feedback) || note.trim() !== (feedback.operatorNote ?? '').trim();

  const saveReview = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const patch = await updateFeedbackReview(feedback.id, { status: reviewStatus, note }, user);
      onReviewSaved?.(patch);
      setSavedAt(Date.now());
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const [submitter, setSubmitter] = useState({ state: 'loading', email: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!feedback.userId) return undefined;
    let cancelled = false;
    getSubmitterEmail(feedback.userId)
      .then((email) => !cancelled && setSubmitter({ state: 'ready', email }))
      .catch(() => !cancelled && setSubmitter({ state: 'ready', email: null }));
    return () => {
      cancelled = true;
    };
  }, [feedback.userId]);

  const submitterText = feedback.userDeleted
    ? 'Deleted account (anonymized)'
    : !feedback.userId
      ? 'Unknown'
      : submitter.state === 'loading'
        ? 'Loading…'
        : submitter.email || 'Deleted account';

  const categories = feedbackCategories(feedback);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(feedback.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the id is still selectable.
    }
  };

  return (
    <Modal
      icon={MessageSquare}
      title="Feedback Details"
      subtitle={formatDateLong(feedback.createdAt)}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-6 p-6 max-h-[70vh] overflow-y-auto">
        <div className="flex flex-col gap-5 min-w-0">
          <DetailSection label="Rating">
            <div className="flex items-center gap-3">
              <StarRating value={feedback.rating} size="w-5 h-5" />
              <span className="text-lg font-black text-slate-950">{feedback.rating ?? '—'}</span>
              <span className="text-sm text-slate-400">/ 5</span>
            </div>
          </DetailSection>

          <DetailSection label="Categories">
            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((tag) => (
                  <CategoryPill key={tag} label={tag} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">None selected</p>
            )}
          </DetailSection>

          <DetailSection label="Route">
            <div className="flex items-center gap-2 text-sm text-slate-800">
              <RouteIcon className="w-4 h-4 text-slate-400 shrink-0" />
              {feedback.routeName || <span className="text-slate-400">Not specified</span>}
            </div>
          </DetailSection>

          <DetailSection label="Comment">
            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words rounded-xl bg-slate-50 border border-slate-100 p-4">
              {feedback.comment || <span className="text-slate-400">No comment</span>}
            </p>
          </DetailSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailSection label="Submitted by">
              <div className="flex items-center gap-2 text-sm text-slate-800 min-w-0">
                <UserRound className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{submitterText}</span>
              </div>
            </DetailSection>
            <DetailSection label="Feedback ID">
              <button
                type="button"
                onClick={copyId}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-600 hover:text-blue-600 cursor-pointer min-w-0"
                title="Copy ID"
              >
                <span className="truncate">{feedback.id}</span>
                {copied ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
              </button>
            </DetailSection>
          </div>
        </div>

        <PhotoTile
          label="Ticket Photo"
          path={feedback.ticketPhotoPath}
          legacyUrl={feedback.ticketPhotoUrl}
          purged={Boolean(feedback.photosPurgedAt)}
          alt="Bus ticket attached to this feedback"
          aspect="aspect-[3/4]"
          emptyText="No ticket attached"
          purgedText="Ticket photo deleted after 6 months (retention policy)."
          hint="Click to open full size."
        />
      </div>

      {/* REVIEW */}
      <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Review</p>
          {feedback.statusUpdatedAt && (
            <p className="text-[11px] text-slate-500">
              Last updated by {feedback.statusUpdatedByEmail || 'an operator'} · {formatDateTime(feedback.statusUpdatedAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Review status">
          {FEEDBACK_STATUSES.map((option) => {
            const active = reviewStatus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setReviewStatus(option.value)}
                disabled={saving}
                className={`rounded-xl border px-3 py-1.5 transition-colors cursor-pointer ${
                  active ? 'border-blue-500 bg-white ring-2 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <FeedbackStatusBadge status={option.value} />
              </button>
            );
          })}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="sr-only">Operator note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, MAX_OPERATOR_NOTE_LENGTH))}
            rows={3}
            placeholder="Add a note for your team (e.g. action taken, driver informed)…"
            disabled={saving}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-y focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <span className="text-[11px] text-slate-400 text-right">
            {note.length}/{MAX_OPERATOR_NOTE_LENGTH}
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
        {savedAt && !reviewDirty && (
          <span className="mr-auto flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <Check className="w-4 h-4" />
            Review saved
          </span>
        )}
        <button
          type="button"
          onClick={saveReview}
          disabled={saving || !reviewDirty}
          className="flex items-center gap-2 text-xs font-semibold text-slate-700 px-5 py-2.5 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Review
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
