/** Key prefix of the empty outlined slots that pad the zone to its size. */
export const SLOT_PREFIX = "__slot";
export const isSlot = (key: string) => key.startsWith(SLOT_PREFIX);

/**
 * Grid order for a pinned zone followed by the rest: the locked tile (if
 * any), the pinned items, empty slots up to `zoneSize`, then `available`.
 */
export function zoneLayout<K extends string>(
  pinned: K[],
  available: K[],
  zoneSize: number,
  locked?: K,
): string[] {
  const head: string[] = locked ? [locked, ...pinned] : [...pinned];
  const slots = Array.from(
    { length: Math.max(0, zoneSize - head.length) },
    (_, i) => `${SLOT_PREFIX}${i}`,
  );
  return [...head, ...slots, ...available.filter((k) => !pinned.includes(k))];
}

/**
 * The pinned list after a drag ends, from the grid's new order. Whatever sits
 * in the first `zoneSize` cells counts, except tiles that only slid in because
 * something else moved: an item becomes pinned only if it was pinned before or
 * is the one that was dragged. So dropping a page into a full zone pushes the
 * last pinned one out, and dragging a pinned page down never pulls another in.
 */
export function pinnedAfterDrop<K extends string>({
  order,
  dragged,
  pinned,
  zoneSize,
  locked,
}: {
  order: string[];
  dragged: string;
  pinned: K[];
  zoneSize: number;
  locked?: K;
}): K[] {
  return order
    .slice(0, zoneSize)
    .filter(
      (k): k is K =>
        !isSlot(k) && k !== locked && (pinned.includes(k as K) || k === dragged),
    );
}
