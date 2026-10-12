import StatusPill from './StatusPill';
import { FEEDBACK_STATUSES } from '../utils/feedback';

const TONES = { new: 'blue', reviewed: 'slate', resolved: 'emerald' };

/** Review status pill for passenger feedback (New / Reviewed / Resolved). */
export default function FeedbackStatusBadge({ status = 'new' }) {
  const known = FEEDBACK_STATUSES.find((s) => s.value === status);
  return <StatusPill tone={known ? TONES[status] : TONES.new} label={known?.label ?? 'New'} />;
}
