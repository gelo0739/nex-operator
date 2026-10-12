import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import DetailSection from './DetailSection';
import { resolvePhotoUrl } from '../utils/photos';

/**
 * Loads one private (`path`) or legacy public (`legacyUrl`) report photo and
 * shows it as a tile that opens full size. `purged` = removed by the photo
 * retention job (functions/photoRetention.js).
 */
export default function PhotoTile({
  label,
  path,
  legacyUrl,
  purged = false,
  alt = label,
  aspect = 'aspect-[4/3]',
  emptyText = 'Not attached',
  purgedText = 'Deleted (retention policy).',
  hint = null,
}) {
  const [state, setState] = useState({ status: 'loading', url: null });
  const has = Boolean(path || legacyUrl);

  useEffect(() => {
    if (!has) return undefined;
    let cancelled = false;
    resolvePhotoUrl(path, legacyUrl)
      .then((url) => !cancelled && setState({ status: url ? 'ready' : 'none', url }))
      .catch((error) => {
        console.error(`Failed to load ${label}:`, error);
        if (!cancelled) setState({ status: 'error', url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [has, path, legacyUrl, label]);

  const status = has ? state.status : 'none';
  return (
    <DetailSection label={label}>
      <div className={`${aspect} w-full rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center`}>
        {status === 'loading' && <Loader2 className="w-6 h-6 animate-spin text-blue-600" />}
        {status === 'ready' && (
          <a href={state.url} target="_blank" rel="noopener noreferrer" title="Open full size" className="block w-full h-full">
            <img src={state.url} alt={alt} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
          </a>
        )}
        {(status === 'none' || status === 'error') && (
          <div className="flex flex-col items-center gap-1.5 text-center px-3 text-slate-400">
            <ImageOff className="w-6 h-6" />
            <p className="text-[11px]">{status === 'error' ? 'Couldn’t load the photo.' : purged ? purgedText : emptyText}</p>
          </div>
        )}
      </div>
      {status === 'ready' && hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </DetailSection>
  );
}
