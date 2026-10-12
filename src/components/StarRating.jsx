import { Star } from 'lucide-react';

/**
 * Five stars filled to `value` (0–5). Fractions fill a partial star, so an
 * average like 4.3 shows 4 full stars and a third of the fifth.
 */
export default function StarRating({ value = 0, size = 'w-3.5 h-3.5', className = '' }) {
  const clamped = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${clamped.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, clamped - i));
        return (
          <span key={i} className={`relative inline-block ${size}`}>
            <Star className={`absolute inset-0 ${size} text-slate-300`} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${size} text-amber-400 fill-amber-400`} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
