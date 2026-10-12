import { tagTone } from '../utils/feedback';

const TONE_CLASSES = {
  positive: 'bg-emerald-50 text-emerald-700',
  negative: 'bg-amber-50 text-amber-800',
  neutral: 'bg-slate-100 text-slate-600',
};

/** Feedback tag pill — green for compliments, amber for complaints. */
export default function CategoryPill({ label }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${TONE_CLASSES[tagTone(label)]}`}>
      {label}
    </span>
  );
}
