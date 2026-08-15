import { useEffect, useRef, useState } from 'react';

/**
 * Tracks which items' watched value just changed since the previous render
 * — used to briefly highlight a table card when its occupancy moves from a
 * Firestore write on another device, so "watching mesas fill up live" is
 * visibly true instead of numbers silently jumping.
 */
export function useChangedIds(items, getValue, holdMs = 900) {
  const prev = useRef(new Map());
  const [changed, setChanged] = useState(() => new Set());

  useEffect(() => {
    const next = new Set();
    for (const item of items) {
      const v = getValue(item);
      if (prev.current.has(item.id) && prev.current.get(item.id) !== v) next.add(item.id);
      prev.current.set(item.id, v);
    }
    if (next.size === 0) return;
    setChanged(next);
    const t = setTimeout(() => setChanged(new Set()), holdMs);
    return () => clearTimeout(t);
  }, [items, getValue, holdMs]);

  return changed;
}
