import { supabase } from "../utils/supabase";
import { Database } from "../utils/supabase-types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// KAMAR API
export const kamarApi = {
  getAll: async () =>
    await supabase
      .from("kamar")
      .select("*, users(id, fullname, username, avatar_url)")
      .order("room_code"),
  getByUser: async (userId: string) =>
    await supabase.from("kamar").select("*").eq("user_id", userId).single(),
  assignUser: async (roomId: string, userId: string | null) =>
    await supabase
      .from("kamar")
      .update({ user_id: userId })
      .eq("id", roomId)
      .select()
      .single(),
  updateDescription: async (roomId: string, description: string) =>
    await supabase
      .from("kamar")
      .update({ description })
      .eq("id", roomId)
      .select()
      .single(),
};

// USERS API
export const usersApi = {
  getAll: async () => await supabase.from("users").select("*"),
  getById: async (id: string) =>
    await supabase.from("users").select("*").eq("id", id).single(),
  create: async (data: InsertTables<"users">) =>
    await supabase.from("users").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"users">) =>
    await supabase.from("users").update(data).eq("id", id).select().single(),
  delete: async (id: string) =>
    await supabase.from("users").delete().eq("id", id),
};

// PIKETS API
export const piketsApi = {
  getAll: async () => await supabase.from("pikets").select("*"),
  getById: async (id: string) =>
    await supabase.from("pikets").select("*").eq("id", id).single(),
  getByUser: async (userId: string) =>
    await supabase.from("pikets").select("*").eq("assign_to", userId),
  create: async (data: InsertTables<"pikets">) =>
    await supabase.from("pikets").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"pikets">) =>
    await supabase.from("pikets").update(data).eq("id", id).select().single(),
  delete: async (id: string) =>
    await supabase.from("pikets").delete().eq("id", id),
};

// PIKET REQUESTS API
export const piketRequestsApi = {
  getAll: async () => await supabase.from("piket_requests").select("*"),
  getById: async (id: string) =>
    await supabase.from("piket_requests").select("*").eq("id", id).single(),
  create: async (data: InsertTables<"piket_requests">) =>
    await supabase.from("piket_requests").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"piket_requests">) =>
    await supabase
      .from("piket_requests")
      .update(data)
      .eq("id", id)
      .select()
      .single(),
  delete: async (id: string) =>
    await supabase.from("piket_requests").delete().eq("id", id),
};

// PAYMENTS API
export const paymentsApi = {
  getAll: async () => await supabase.from("payments").select("*"),
  getById: async (id: string) =>
    await supabase.from("payments").select("*").eq("id", id).single(),
  getByUser: async (userId: string) =>
    await supabase.from("payments").select("*").eq("paid_by", userId),
  create: async (data: InsertTables<"payments">) =>
    await supabase.from("payments").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"payments">) =>
    await supabase.from("payments").update(data).eq("id", id).select().single(),
  delete: async (id: string) =>
    await supabase.from("payments").delete().eq("id", id),
};

// GUESTS API
export const guestsApi = {
  getAll: async () => await supabase.from("guests").select("*"),
  getById: async (id: string) =>
    await supabase.from("guests").select("*").eq("id", id).single(),
  create: async (data: InsertTables<"guests">) =>
    await supabase.from("guests").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"guests">) =>
    await supabase.from("guests").update(data).eq("id", id).select().single(),
  delete: async (id: string) =>
    await supabase.from("guests").delete().eq("id", id),
};

// RULES API
export const rulesApi = {
  getAll: async () => await supabase.from("rules").select("*"),
  getById: async (id: string) =>
    await supabase.from("rules").select("*").eq("id", id).single(),
  create: async (data: InsertTables<"rules">) =>
    await supabase.from("rules").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"rules">) =>
    await supabase.from("rules").update(data).eq("id", id).select().single(),
  delete: async (id: string) =>
    await supabase.from("rules").delete().eq("id", id),
};

// RULE REQUESTS API
export const ruleRequestsApi = {
  getAll: async () => await supabase.from("rule_requests").select("*"),
  getById: async (id: string) =>
    await supabase.from("rule_requests").select("*").eq("id", id).single(),
  create: async (data: InsertTables<"rule_requests">) =>
    await supabase.from("rule_requests").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"rule_requests">) =>
    await supabase
      .from("rule_requests")
      .update(data)
      .eq("id", id)
      .select()
      .single(),
  delete: async (id: string) =>
    await supabase.from("rule_requests").delete().eq("id", id),
};

// RULE REQUEST VOTES API
export const ruleRequestVotesApi = {
  getMine: async (ruleRequestId: string, voterId: string) =>
    await supabase
      .from("rule_request_votes")
      .select("*")
      .eq("rule_request_id", ruleRequestId)
      .eq("voter_id", voterId)
      .maybeSingle(),
  getAllMine: async (voterId: string) =>
    await supabase
      .from("rule_request_votes")
      .select("*")
      .eq("voter_id", voterId),
  // Row Level Security on rule_request_votes only lets a member SELECT their own
  // vote row, so listing every voter for a request has to go through this
  // SECURITY DEFINER RPC (it exposes who voted, not their approve/decline choice).
  getVoters: async (ruleRequestId: string) =>
    await supabase.rpc("get_rule_request_voters", {
      p_rule_request_id: ruleRequestId,
    }),
  cast: async (
    ruleRequestId: string,
    voterId: string,
    vote: "approve" | "decline",
  ) =>
    await supabase
      .from("rule_request_votes")
      .insert({ rule_request_id: ruleRequestId, voter_id: voterId, vote })
      .select()
      .single(),
  getTally: async (ruleRequestId: string) =>
    await supabase.rpc("get_rule_request_vote_tally", {
      p_rule_request_id: ruleRequestId,
    }),
};

// EVENTS API
export const eventsApi = {
  getAll: async () =>
    await supabase.from("events").select("*").order("event_time"),
  getById: async (id: string) =>
    await supabase.from("events").select("*").eq("id", id).single(),
  create: async (data: InsertTables<"events">) =>
    await supabase.from("events").insert(data).select().single(),
  delete: async (id: string) =>
    await supabase.from("events").delete().eq("id", id),
};

// EVENT VOTES API
export const eventVotesApi = {
  // Row Level Security allows anyone to SELECT every vote, so the attendee
  // list/tally can be built client-side from one query, no RPC needed.
  getAll: async () => await supabase.from("event_votes").select("*"),
  cast: async (eventId: string, userId: string, isAttending: boolean) =>
    await supabase
      .from("event_votes")
      .upsert(
        { event_id: eventId, user_id: userId, is_attending: isAttending },
        { onConflict: "event_id,user_id" },
      )
      .select()
      .single(),
  retract: async (eventId: string, userId: string) =>
    await supabase
      .from("event_votes")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId),
};

// REQUESTS API
export const requestsApi = {
  getAll: async () =>
    await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false }),
  create: async (data: InsertTables<"requests">) =>
    await supabase.from("requests").insert(data).select().single(),
  delete: async (id: string) =>
    await supabase.from("requests").delete().eq("id", id),
};

// REQUEST VOTES API
export const requestVotesApi = {
  getAll: async () => await supabase.from("request_votes").select("*"),
  cast: async (requestId: string, userId: string, voteValue: 1 | -1) =>
    await supabase
      .from("request_votes")
      .upsert(
        { request_id: requestId, user_id: userId, vote_value: voteValue },
        { onConflict: "request_id,user_id" },
      )
      .select()
      .single(),
  retract: async (requestId: string, userId: string) =>
    await supabase
      .from("request_votes")
      .delete()
      .eq("request_id", requestId)
      .eq("user_id", userId),
};

// CHANGELOGS API
export const changelogsApi = {
  getAll: async () =>
    await supabase
      .from("changelogs")
      .select("*")
      .order("created_at", { ascending: false }),
  create: async (data: InsertTables<"changelogs">) =>
    await supabase.from("changelogs").insert(data).select().single(),
};

// REPORTS API
export const reportsApi = {
  getAll: async () => await supabase.from("reports").select("*"),
  getById: async (id: string) =>
    await supabase.from("reports").select("*").eq("id", id).single(),
  create: async (data: InsertTables<"reports">) =>
    await supabase.from("reports").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"reports">) =>
    await supabase.from("reports").update(data).eq("id", id).select().single(),
  delete: async (id: string) =>
    await supabase.from("reports").delete().eq("id", id),
};

// PAYMENT METHODS API
export const paymentMethodsApi = {
  getAll: async () => await supabase.from("payment_methods").select("*"),
  getById: async (id: string) =>
    await supabase.from("payment_methods").select("*").eq("id", id).single(),
  getByUser: async (userId: string) =>
    await supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", userId)
      .order("created_at"),
  /** The kontrakan admin's QRIS image, for members to scan when paying rent. */
  getAdminQris: async (): Promise<string | null> => {
    const { data: admin } = await supabase
      .from("users")
      .select("id")
      .eq("role", "admin")
      .single();
    if (!admin) return null;
    const { data } = await supabase
      .from("payment_methods")
      .select("qris_image_url")
      .eq("user_id", admin.id)
      .eq("type", "qris")
      .maybeSingle();
    return data?.qris_image_url ?? null;
  },
  create: async (data: InsertTables<"payment_methods">) =>
    await supabase.from("payment_methods").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"payment_methods">) =>
    await supabase
      .from("payment_methods")
      .update(data)
      .eq("id", id)
      .select()
      .single(),
  delete: async (id: string) =>
    await supabase.from("payment_methods").delete().eq("id", id),
};

// SPLIT BILLS API
export const splitBillsApi = {
  getAll: async () =>
    await supabase
      .from("split_bills")
      .select(
        "*, split_bill_participants(*), split_bill_payment_methods(*, payment_methods(*))",
      )
      .order("created_at", { ascending: false }),
  getById: async (id: string) =>
    await supabase
      .from("split_bills")
      .select(
        "*, split_bill_participants(*), split_bill_payment_methods(*, payment_methods(*))",
      )
      .eq("id", id)
      .single(),
  create: async (data: InsertTables<"split_bills">) =>
    await supabase.from("split_bills").insert(data).select().single(),
  update: async (id: string, data: UpdateTables<"split_bills">) =>
    await supabase
      .from("split_bills")
      .update(data)
      .eq("id", id)
      .select()
      .single(),
  delete: async (id: string) =>
    await supabase.from("split_bills").delete().eq("id", id),
};

// SPLIT BILL PARTICIPANTS API
export const splitBillParticipantsApi = {
  getByBill: async (splitBillId: string) =>
    await supabase
      .from("split_bill_participants")
      .select("*")
      .eq("split_bill_id", splitBillId),
  createMany: async (data: InsertTables<"split_bill_participants">[]) =>
    await supabase.from("split_bill_participants").insert(data).select(),
  update: async (id: string, data: UpdateTables<"split_bill_participants">) =>
    await supabase
      .from("split_bill_participants")
      .update(data)
      .eq("id", id)
      .select()
      .single(),
};

// SPLIT BILL PAYMENT METHODS API
export const splitBillPaymentMethodsApi = {
  getByBill: async (splitBillId: string) =>
    await supabase
      .from("split_bill_payment_methods")
      .select("*, payment_methods(*)")
      .eq("split_bill_id", splitBillId),
  createMany: async (data: InsertTables<"split_bill_payment_methods">[]) =>
    await supabase.from("split_bill_payment_methods").insert(data).select(),
};

// LINKED ACCOUNTS API
export const linkedAccountsApi = {
  getForUser: async (userId: string) =>
    await supabase
      .from("linked_accounts")
      .select("*")
      .or(`owner_id.eq.${userId},linked_user_id.eq.${userId}`)
      .maybeSingle(),
  create: async (data: InsertTables<"linked_accounts">) =>
    await supabase.from("linked_accounts").insert(data).select().single(),
  delete: async (id: string) =>
    await supabase.from("linked_accounts").delete().eq("id", id),
};

// RECEIPTS API
export const receiptsApi = {
  getAll: async () =>
    await supabase
      .from("receipts")
      .select("*")
      .order("created_at", { ascending: false }),
  create: async (data: InsertTables<"receipts">) =>
    await supabase.from("receipts").insert(data).select().single(),
  delete: async (id: string) =>
    await supabase.from("receipts").delete().eq("id", id),
};
