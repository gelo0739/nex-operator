import { useEffect, useState } from 'react';

/**
 * Numbered pages over a Firestore cursor query.
 *
 * `queryKey` identifies the query (line + filters + reload token); a new key
 * starts over from page 1's cursor. `fetchPage(cursor, pageSize)` resolves to
 * `{ items, lastDoc }`. Results are keyed by the request that produced them, so
 * a late response for an old query can never overwrite a newer one.
 *
 * Returns `{ items, loading, error, knownPages, patchItem }` — `knownPages` is
 * how many pages have a known start cursor (visited pages + the next one).
 */
export default function useCursorPagination({ enabled, queryKey, page, pageSize, fetchPage, label }) {
  const pageKey = `${queryKey}|${page}`;

  // cursors[i] = last doc of page i (page i + 1 starts after it); [0] = null.
  const [cursorState, setCursorState] = useState({ key: null, list: [null] });
  const cursors = cursorState.key === queryKey ? cursorState.list : [null];
  const pageCursor = cursors[page - 1];

  const [pageState, setPageState] = useState({ key: null, items: [], error: null });
  useEffect(() => {
    if (!enabled || pageCursor === undefined) return undefined;
    let cancelled = false;
    fetchPage(pageCursor, pageSize)
      .then(({ items, lastDoc }) => {
        if (cancelled) return;
        setPageState({ key: pageKey, items, error: null });
        if (items.length === pageSize) {
          setCursorState((prev) => {
            const list = prev.key === queryKey ? [...prev.list] : [null];
            list[page] = lastDoc;
            return { key: queryKey, list };
          });
        }
      })
      .catch((error) => {
        console.error(`Failed to load ${label}:`, error);
        if (!cancelled) setPageState({ key: pageKey, items: [], error });
      });
    return () => {
      cancelled = true;
    };
    // fetchPage's inputs (filters) and page are encoded in queryKey / pageKey.
  }, [enabled, pageKey, pageCursor]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = pageState.key !== pageKey;

  // Merge a saved change into a row on screen.
  const patchItem = (id, patch) =>
    setPageState((prev) => ({ ...prev, items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));

  return {
    items: loading ? [] : pageState.items,
    loading,
    error: loading ? null : pageState.error,
    knownPages: cursors.length,
    patchItem,
  };
}
