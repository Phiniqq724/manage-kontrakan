import { applyRequestVote, requestScore, sortRequests } from "../requests";

jest.mock("../../services/api", () => ({}));
jest.mock("../notifications", () => ({}));

const vote = (user_id: string, vote_value: number) =>
  ({ request_id: "r", user_id, vote_value }) as any;
const req = (id: string, creator_id: string, created_at: string) =>
  ({ id, creator_id, created_at }) as any;

describe("requestScore", () => {
  it("sums votes and floors at zero", () => {
    expect(requestScore([vote("a", 1), vote("b", 1), vote("c", -1)])).toBe(1);
    expect(requestScore([vote("a", -1)])).toBe(0);
    expect(requestScore()).toBe(0);
  });
});

describe("applyRequestVote", () => {
  it("adds, switches and retracts", () => {
    const added = applyRequestVote([], "r", "a", 1);
    expect(added.map((v) => v.vote_value)).toEqual([1]);
    const switched = applyRequestVote(added, "r", "a", -1);
    expect(switched.map((v) => v.vote_value)).toEqual([-1]);
    expect(applyRequestVote(switched, "r", "a", -1)).toEqual([]);
  });

  it("leaves other users' votes alone", () => {
    const out = applyRequestVote([vote("b", 1)], "r", "a", 1);
    expect(out).toHaveLength(2);
  });
});

describe("sortRequests", () => {
  const requests = [
    req("old", "me", "2026-01-01"),
    req("new", "x", "2026-03-01"),
    req("mid", "me", "2026-02-01"),
  ];
  const votes = { old: [vote("a", 1), vote("b", 1)], mid: [vote("a", 1)] };

  it("sorts top by score, then newest", () => {
    expect(sortRequests(requests, votes, "top").map((r) => r.id)).toEqual(["old", "mid", "new"]);
  });
  it("sorts new by date", () => {
    expect(sortRequests(requests, votes, "new").map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });
  it("filters mine", () => {
    expect(sortRequests(requests, votes, "mine", "me").map((r) => r.id)).toEqual(["mid", "old"]);
  });
});
