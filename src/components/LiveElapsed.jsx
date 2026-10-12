import { useEffect, useState } from 'react';

/**
 * Text that re-renders itself every second: `format(secondsSince(since))`.
 * Keeping the 1-second tick inside this tiny component means the parent
 * (e.g. the fleet map and its pop-up) doesn't re-render every second.
 */
export default function LiveElapsed({ since, format, fallback = '—' }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(since)) return undefined;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // refresh straight away when `since` changes
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [since]);

  if (!Number.isFinite(since)) return fallback;
  return format(Math.max(0, (now - since) / 1000));
}
