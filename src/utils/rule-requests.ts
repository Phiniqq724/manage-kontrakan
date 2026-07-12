import type { NotificationResponse } from "expo-notifications";
import { ruleRequestsApi, ruleRequestVotesApi, rulesApi, usersApi } from "../services/api";
import { sendPushNotification } from "./notifications";
import { supabase } from "./supabase";
import type { Database } from "./supabase-types";

type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];

/** Approves a rule request: creates the rule, marks the request approved, and notifies everyone. */
export async function approveRuleRequest(req: RuleRequestRow): Promise<void> {
  const [ruleRes, reqRes] = await Promise.all([
    rulesApi.create({
      rules: req.rules,
      priority: req.priority,
      assign_by: req.assign_by,
    }),
    ruleRequestsApi.update(req.id, { status: "approved" }),
  ]);
  if (ruleRes.error) throw ruleRes.error;
  if (reqRes.error) throw reqRes.error;

  const { data: users } = await usersApi.getAll();
  const tokens = (users ?? [])
    .map((u) => u.push_token)
    .filter((t): t is string => !!t);
  await Promise.all(
    tokens.map((token) =>
      sendPushNotification(
        token,
        "Peraturan Baru Disetujui",
        "Peraturan baru telah disetujui dan ditambahkan ke daftar aturan kontrakan.",
      ),
    ),
  );
}

/** Declines a rule request and notifies only the proposer. */
export async function declineRuleRequest(req: RuleRequestRow): Promise<void> {
  const { error } = await ruleRequestsApi.update(req.id, { status: "declined" });
  if (error) throw error;

  if (req.assign_by) {
    const { data: proposer } = await usersApi.getById(req.assign_by);
    if (proposer?.push_token) {
      await sendPushNotification(
        proposer.push_token,
        "Usulan Peraturan Ditolak",
        "Usulan peraturan kamu belum bisa diterima saat ini.",
      );
    }
  }
}

/**
 * Casts a member's vote, then resolves the request once every eligible (non-admin)
 * voter has voted: majority approve creates the rule and notifies everyone, majority
 * decline silently declines, and a tie is left pending for admin to resolve manually.
 */
export async function castVoteAndMaybeResolve(
  req: RuleRequestRow,
  voterId: string,
  vote: "approve" | "decline",
  eligibleVoterCount: number,
): Promise<void> {
  const { error } = await ruleRequestVotesApi.cast(req.id, voterId, vote);
  if (error) throw error;

  const { data: tally } = await ruleRequestVotesApi.getTally(req.id);
  const row = tally?.[0];
  if (!row || row.total_votes < eligibleVoterCount) return;

  if (row.approve_count > row.decline_count) {
    await approveRuleRequest(req);
  } else if (row.decline_count > row.approve_count) {
    await declineRuleRequest(req);
  }
  // Tie: leave status pending — admin's approve/decline panel resolves it.
}

/**
 * Handles a tap on the Setuju/Tolak buttons of a rule-vote push notification,
 * letting a member vote without opening the app. No-ops for plain taps (no
 * action identifier), for admins, and for requests that are no longer pending.
 */
export async function handleRuleVoteNotificationResponse(
  response: NotificationResponse,
): Promise<void> {
  const actionIdentifier = response.actionIdentifier;
  if (actionIdentifier !== "approve" && actionIdentifier !== "decline") return;

  const ruleRequestId = response.notification.request.content.data?.ruleRequestId as
    | string
    | undefined;
  if (!ruleRequestId) return;

  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const [{ data: currentUser }, { data: req }, { data: users }] = await Promise.all([
      usersApi.getById(authUser.id),
      ruleRequestsApi.getById(ruleRequestId),
      usersApi.getAll(),
    ]);
    if (!currentUser || currentUser.role === "admin") return;
    if (!req || req.status !== "pending" || req.assign_by === currentUser.id) return;

    const eligibleVoterCount = (users ?? []).filter((u) => u.role !== "admin").length;
    await castVoteAndMaybeResolve(req, currentUser.id, actionIdentifier, eligibleVoterCount);
  } catch (err) {
    console.error("[rule-vote-notification] failed:", err);
  }
}
