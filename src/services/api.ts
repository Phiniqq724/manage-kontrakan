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

// APP RELEASES API
export const appReleasesApi = {
  getLatest: async () =>
    await supabase
      .from("app_releases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
