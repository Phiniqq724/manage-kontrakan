import { eventVotesApi, eventsApi } from "../services/api";
import { getAllTokensExcept, sendPushNotification } from "./notifications";
import type { Database } from "./supabase-types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

/** Creates an event and notifies every other member. */
export async function createEventAndNotify(
  input: { name: string; location: string; event_time: string },
  creator: { id: string; fullname: string },
): Promise<EventRow> {
  const { data, error } = await eventsApi.create({
    ...input,
    creator_id: creator.id,
  });
  if (error) throw error;

  const tokens = await getAllTokensExcept(creator.id);
  await Promise.all(
    tokens.map((token) =>
      sendPushNotification(
        token,
        "Acara Baru",
        `${creator.fullname} membuat acara baru: ${input.name}`,
        { data: { eventId: data.id } },
      ),
    ),
  );
  return data;
}

/**
 * Casts, switches, or retracts a member's attendance vote. Tapping the same
 * value again retracts it (deletes the row), matching the toggle behavior on
 * Request votes; tapping the opposite value switches it via upsert. Throws if
 * the event has already happened — mirrors the event_votes RLS policy's
 * `event_time > now()` guard, so the UI can surface a clear error instead of
 * a raw Postgres rejection.
 */
export async function castEventVote(
  event: EventRow,
  userId: string,
  isAttending: boolean,
  currentVote: boolean | null,
): Promise<void> {
  if (new Date(event.event_time).getTime() <= Date.now()) {
    throw new Error("Acara sudah berlalu, tidak bisa vote lagi.");
  }
  if (currentVote === isAttending) {
    const { error } = await eventVotesApi.retract(event.id, userId);
    if (error) throw error;
    return;
  }
  const { error } = await eventVotesApi.cast(event.id, userId, isAttending);
  if (error) throw error;
}
