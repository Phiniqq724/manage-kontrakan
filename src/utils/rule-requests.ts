import type { NotificationResponse } from "expo-notifications";
import { ruleRequestsApi, ruleRequestVotesApi, rulesApi, usersApi } from "../services/api";
import { sendPush } from "./notifications";
import { supabase } from "./supabase";
import type { Database } from "./supabase-types";

type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];

/** Tells everyone a rule request was approved. */
const notifyApproved = async (): Promise<void> => {
  const { data: users } = await usersApi.getAll();
  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length > 0) {
    await sendPush({
      recipients: userIds,
      type: "rule",
      title: "Peraturan Baru Disetujui",
      body: "Peraturan baru telah disetujui dan ditambahkan ke daftar aturan kontrakan.",
    });
  }
};

/** Tells the proposer their rule request was declined. */
const notifyDeclined = async (req: RuleRequestRow): Promise<void> => {
  if (!req.assign_by) return;
  await sendPush({
    recipients: [req.assign_by],
    type: "rule",
    title: "Usulan Peraturan Ditolak",
    body: "Usulan peraturan kamu belum bisa diterima saat ini.",
  });
};

/** Admin approval: creates the rule, marks the request approved, and notifies everyone. */
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
  await notifyApproved();
}

/** Admin decline: marks the request declined and notifies only the proposer. */
export async function declineRuleRequest(req: RuleRequestRow): Promise<void> {
  const { error } = await ruleRequestsApi.update(req.id, { status: "declined" });
  if (error) throw error;
  await notifyDeclined(req);
}

/**
 * Casts a member's vote. Once every eligible (non-admin) voter has voted, the
 * database resolves the request (trigger on rule_request_votes): a majority
 * approves or declines it, a tie stays pending. This only sends the matching
 * notification afterwards; on a tie it asks the admin to decide.
 */
export async function castVoteAndMaybeResolve(
  req: RuleRequestRow,
  voterId: string,
  vote: "approve" | "decline",
  eligibleVoterCount: number,
): Promise<void> {
  const { error } = await ruleRequestVotesApi.cast(req.id, voterId, vote);
  if (error) throw error;

  const [{ data: updated }, { data: tally }] = await Promise.all([
    ruleRequestsApi.getById(req.id),
    ruleRequestVotesApi.getTally(req.id),
  ]);

  if (updated?.status === "approved") return notifyApproved();
  if (updated?.status === "declined") return notifyDeclined(req);

  const row = tally?.[0];
  if (row && row.total_votes >= eligibleVoterCount) {
    await sendPush({
      recipients: "admin",
      type: "rule",
      title: "Vote Peraturan Seri",
      body: `Vote untuk "${req.rules}" seri. Tentukan hasilnya di panel admin.`,
    });
  }
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
