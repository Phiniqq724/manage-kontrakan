import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/**
 * Who should receive the push:
 * - "admin": every admin
 * - "all_except_me": every user except the caller
 * - "voters_except_me": every non-admin except the caller (rule-vote voters)
 * - string[]: explicit user ids
 */
type Recipients = "admin" | "all_except_me" | "voters_except_me" | string[];

type SendPushBody = {
  recipients: Recipients;
  /** Notification type; recipients who muted it are skipped. Omit for always-on. */
  type?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryId?: string;
};

const MAX_TITLE = 120;
const MAX_BODY = 500;
const MAX_IDS = 50;

/**
 * Sends Expo push notifications on behalf of a signed-in member.
 *
 * Push tokens never leave the server: the app names recipients by role or
 * user id, and this function resolves their tokens with the service role.
 * The caller must be a signed-in user who exists in `public.users`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = authData.user.id;

    const { data: caller } = await admin
      .from("users")
      .select("id")
      .eq("id", callerId)
      .maybeSingle();
    if (!caller) return json({ error: "Forbidden" }, 403);

    const payload = (await req.json()) as SendPushBody;
    const { recipients, type, title, body, data, categoryId } = payload;
    if (
      typeof title !== "string" ||
      typeof body !== "string" ||
      !title.trim() ||
      title.length > MAX_TITLE ||
      body.length > MAX_BODY
    ) {
      return json({ error: "Invalid title or body" }, 400);
    }

    let usersQuery = admin.from("users").select("id");
    if (recipients === "admin") {
      usersQuery = usersQuery.eq("role", "admin");
    } else if (recipients === "all_except_me") {
      usersQuery = usersQuery.neq("id", callerId);
    } else if (recipients === "voters_except_me") {
      usersQuery = usersQuery.neq("id", callerId).neq("role", "admin");
    } else if (
      Array.isArray(recipients) &&
      recipients.length > 0 &&
      recipients.length <= MAX_IDS &&
      recipients.every((id) => typeof id === "string")
    ) {
      usersQuery = usersQuery.in("id", recipients);
    } else {
      return json({ error: "Invalid recipients" }, 400);
    }

    const { data: users, error: usersError } = await usersQuery;
    if (usersError) throw usersError;
    const userIds = (users ?? []).map((u: { id: string }) => u.id);
    if (userIds.length === 0) return json({ sent: 0 });

    const { data: tokenRows, error: tokenError } = await admin
      .from("push_tokens")
      .select("token, muted_types")
      .in("user_id", userIds);
    if (tokenError) throw tokenError;
    const tokens = (tokenRows ?? [])
      .filter((r: { muted_types: string[] | null }) => !type || !(r.muted_types ?? []).includes(type))
      .map((r: { token: string }) => r.token);
    if (tokens.length === 0) return json({ sent: 0 });

    const messages = tokens.map((to: string) => ({
      to,
      title,
      body,
      data,
      categoryId,
    }));
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });
    const result = await res.json();

    console.log(
      `send-push from ${callerId}: ${tokens.length} token(s), status ${res.status}`,
    );
    return json({ sent: tokens.length, push: result });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
