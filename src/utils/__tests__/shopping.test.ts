/// <reference types="jest" />

import {
  shoppingActionFor,
  shoppingBadgeCount,
  splitShopping,
  timeAgo,
  type ShoppingItem,
} from "@/utils/shopping";

const item = (over: Partial<ShoppingItem>): ShoppingItem => ({
  id: "x",
  name: "Sapu",
  note: null,
  created_by: "author",
  created_at: "2026-10-24T01:00:00Z",
  status: "open",
  bought_by: null,
  item_photo: null,
  receipt_photo: null,
  submitted_at: null,
  reject_note: null,
  resolved_at: null,
  ...over,
});

describe("shoppingActionFor", () => {
  it("lets anyone buy an open item, including the author", () => {
    expect(shoppingActionFor(item({}), "someone")).toBe("buy");
    expect(shoppingActionFor(item({}), "author")).toBe("buy");
  });

  it("only the author reviews a submitted proof", () => {
    const i = item({ status: "submitted", bought_by: "buyer" });
    expect(shoppingActionFor(i, "author")).toBe("review");
    expect(shoppingActionFor(i, "buyer")).toBeNull();
  });

  it("only the same buyer re-uploads a rejected proof", () => {
    const i = item({ status: "rejected", bought_by: "buyer" });
    expect(shoppingActionFor(i, "buyer")).toBe("resubmit");
    expect(shoppingActionFor(i, "other")).toBeNull();
  });

  it("nothing to do once done", () => {
    expect(shoppingActionFor(item({ status: "done" }), "author")).toBeNull();
  });
});

describe("shoppingBadgeCount", () => {
  it("counts items waiting on the user", () => {
    const items = [
      item({ id: "1" }),
      item({ id: "2", status: "submitted", bought_by: "buyer" }),
      item({ id: "3", status: "rejected", bought_by: "buyer" }),
      item({ id: "4", status: "done" }),
    ];
    expect(shoppingBadgeCount(items, "author")).toBe(2);
    expect(shoppingBadgeCount(items, "buyer")).toBe(2);
    expect(shoppingBadgeCount(items, "other")).toBe(1);
  });
});

describe("splitShopping", () => {
  it("puts the oldest active first and the latest finished first", () => {
    const { active, done } = splitShopping([
      item({ id: "new", created_at: "2026-10-24T03:00:00Z" }),
      item({ id: "old", created_at: "2026-10-23T03:00:00Z", status: "rejected" }),
      item({ id: "d1", status: "done", resolved_at: "2026-10-22T00:00:00Z" }),
      item({ id: "d2", status: "done", resolved_at: "2026-10-23T00:00:00Z" }),
    ]);
    expect(active.map((i) => i.id)).toEqual(["old", "new"]);
    expect(done.map((i) => i.id)).toEqual(["d2", "d1"]);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  it("formats minutes, hours and days", () => {
    expect(timeAgo("2026-10-24T09:59:40Z", now)).toBe("baru saja");
    expect(timeAgo("2026-10-24T09:55:00Z", now)).toBe("5 mnt lalu");
    expect(timeAgo("2026-10-24T07:00:00Z", now)).toBe("3 jam lalu");
    expect(timeAgo("2026-10-22T09:00:00Z", now)).toBe("2 hari lalu");
  });
});
