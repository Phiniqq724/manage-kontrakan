import type { Database } from "./supabase-types";

export type ShoppingItem = Database["public"]["Tables"]["shopping_items"]["Row"];
export type ShoppingStatus = "open" | "submitted" | "rejected" | "done";

/** What the signed-in user can do with an item right now. */
export type ShoppingAction = "buy" | "review" | "resubmit" | null;

/**
 * The one action available to `userId` on `item`: anyone can buy an open
 * item, only the author reviews a submitted proof, only the same buyer
 * re-uploads a rejected one.
 */
export function shoppingActionFor(item: ShoppingItem, userId: string): ShoppingAction {
  switch (item.status) {
    case "open":
      return "buy";
    case "submitted":
      return item.created_by === userId ? "review" : null;
    case "rejected":
      return item.bought_by === userId ? "resubmit" : null;
    default:
      return null;
  }
}

/** How many items are waiting on this user (navbar badge). */
export const shoppingBadgeCount = (items: ShoppingItem[], userId: string) =>
  items.filter((i) => shoppingActionFor(i, userId) !== null).length;

/**
 * Splits the list into still-active items (oldest first, so the longest
 * waiting is on top) and finished ones (most recent first).
 */
export function splitShopping(items: ShoppingItem[]) {
  const active = items
    .filter((i) => i.status !== "done")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const done = items
    .filter((i) => i.status === "done")
    .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""));
  return { active, done };
}

/** Short relative time: "baru saja", "5 mnt lalu", "3 jam lalu", "2 hari lalu". */
export function timeAgo(iso: string, now: Date): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}
