/// <reference types="jest" />

import { pinnedAfterDrop, zoneLayout } from "@/utils/drag-zone";

describe("zoneLayout", () => {
  it("pads the zone with slots after the locked tile and pinned items", () => {
    expect(zoneLayout(["a"], ["a", "b", "c"], 4, "home")).toEqual([
      "home",
      "a",
      "__slot0",
      "__slot1",
      "b",
      "c",
    ]);
  });

  it("has no slots when the zone is full", () => {
    expect(zoneLayout(["a", "b"], ["c"], 2)).toEqual(["a", "b", "c"]);
  });
});

describe("pinnedAfterDrop", () => {
  const base = { zoneSize: 4, locked: "home" };

  it("pins an item dragged into an empty slot", () => {
    expect(
      pinnedAfterDrop({
        ...base,
        order: ["home", "a", "c", "__slot0", "__slot1", "b"],
        dragged: "c",
        pinned: ["a"],
      }),
    ).toEqual(["a", "c"]);
  });

  it("pushes the last pinned item out when the zone is full", () => {
    expect(
      pinnedAfterDrop({
        ...base,
        order: ["home", "x", "a", "b", "c", "d"],
        dragged: "x",
        pinned: ["a", "b", "c"],
      }),
    ).toEqual(["x", "a", "b"]);
  });

  it("removes an item dragged out without pulling a neighbour in", () => {
    expect(
      pinnedAfterDrop({
        ...base,
        order: ["home", "b", "c", "d", "a"],
        dragged: "a",
        pinned: ["a", "b", "c"],
      }),
    ).toEqual(["b", "c"]);
  });

  it("reorders inside the zone", () => {
    expect(
      pinnedAfterDrop({
        zoneSize: 3,
        order: ["c", "a", "b", "z"],
        dragged: "c",
        pinned: ["a", "b", "c"],
      }),
    ).toEqual(["c", "a", "b"]);
  });
});
