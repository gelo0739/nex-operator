import StatusPill from './StatusPill';
import { LOST_ITEM_STATUSES } from '../utils/lostItems';

const TONES = { PENDING: 'amber', FOUND: 'blue', RETURNED: 'emerald', CLOSED: 'slate' };

/** Resolution status pill for a lost-item report. */
export default function LostItemStatusBadge({ status = 'PENDING' }) {
  const label = LOST_ITEM_STATUSES.find((s) => s.value === status)?.label ?? status;
  return <StatusPill tone={TONES[status] ?? TONES.CLOSED} label={label} />;
}
