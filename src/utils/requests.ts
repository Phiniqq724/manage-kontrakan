import { requestVotesApi, requestsApi } from "../services/api";
import { getAllTokensExcept, sendPushNotification } from "./notifications";
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

  const tokens = await getAllTokensExcept(creator.id);
  await Promise.all(
    tokens.map((token) =>
      sendPushNotification(
        token,
        "Request Baru",
        `${creator.fullname}: "${input.title}"`,
        { data: { requestId: data.id } },
      ),
    ),
  );
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
