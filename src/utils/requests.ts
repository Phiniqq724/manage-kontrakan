import { requestVotesApi, requestsApi } from "../services/api";
import { sendPush } from "./notifications";
import type { Database } from "./supabase-types";

type RequestRow = Database["public"]["Tables"]["requests"]["Row"];

/** Creates a request and notifies every other member. */
export async function createRequestAndNotify(
  input: { title: string; description: string },
  creator: { id: string; fullname: string },
): Promise<RequestRow> {
  const { data, error } = await requestsApi.create({
    ...input,
    creator_id: creator.id,
  });
  if (error) throw error;

  await sendPush({
    recipients: "all_except_me",
    type: "request",
    title: "Request Baru",
    body: `${creator.fullname}: "${input.title}"`,
    data: { requestId: data.id },
  });
  return data;
}

/**
 * Casts an up/downvote. Tapping the same value again retracts the vote
 * (deletes the row), giving the full reddit-style toggle; tapping the
 * opposite value switches it via upsert.
 */
export async function castRequestVote(
  requestId: string,
  userId: string,
  value: 1 | -1,
  currentVote: 1 | -1 | null,
): Promise<void> {
  if (currentVote === value) {
    const { error } = await requestVotesApi.retract(requestId, userId);
    if (error) throw error;
    return;
  }
  const { error } = await requestVotesApi.cast(requestId, userId, value);
  if (error) throw error;
}

type RequestVoteRow = Database["public"]["Tables"]["request_votes"]["Row"];
export type RequestSort = "top" | "new" | "mine";

/** Net score shown for a request, floored at 0 so it never reads negative. */
export const requestScore = (votes: RequestVoteRow[] = []) =>
  Math.max(0, votes.reduce((sum, v) => sum + v.vote_value, 0));

/**
 * The vote list after `userId` taps `value`, mirroring castRequestVote:
 * the same value retracts, the other value switches. Used to update the
 * screen before the server answers.
 */
export const applyRequestVote = (
  votes: RequestVoteRow[] = [],
  requestId: string,
  userId: string,
  value: 1 | -1,
): RequestVoteRow[] => {
  const others = votes.filter((v) => v.user_id !== userId);
  const mine = votes.find((v) => v.user_id === userId);
  if (mine?.vote_value === value) return others;
  return [
    ...others,
    { ...(mine ?? ({} as RequestVoteRow)), request_id: requestId, user_id: userId, vote_value: value },
  ];
};

/**
 * Requests for the chosen tab: "top" by score then newest, "new" by date,
 * "mine" only the user's own (newest first).
 */
export const sortRequests = (
  requests: RequestRow[],
  votes: Record<string, RequestVoteRow[]>,
  sort: RequestSort,
  userId?: string,
) => {
  const newest = (a: RequestRow, b: RequestRow) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  if (sort === "mine") return requests.filter((r) => r.creator_id === userId).sort(newest);
  if (sort === "new") return [...requests].sort(newest);
  return [...requests].sort(
    (a, b) => requestScore(votes[b.id]) - requestScore(votes[a.id]) || newest(a, b),
  );
};
