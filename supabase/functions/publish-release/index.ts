import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-publish-secret, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Shared-secret auth: this is called from CI, not by an end user.
    const secret = req.headers.get("x-publish-secret");
    if (!secret || secret !== Deno.env.get("PUBLISH_RELEASE_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }

    const { version, apk_url, release_notes } = await req.json();
    if (!version || !apk_url) {
      return new Response(
        JSON.stringify({ error: "Missing: version, apk_url" }),
        { status: 400, headers: cors },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Dedupe: if this version is already published, do nothing. This avoids
    // double inserts / double notifications when more than one trigger fires.
    const { data: existing } = await admin
      .from("app_releases")
      .select("id")
      .eq("version", version)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ status: "already_published", version }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { error: insertErr } = await admin
      .from("app_releases")
      .insert({ version, apk_url, release_notes: release_notes ?? null });
    if (insertErr) throw insertErr;

    // Notify everyone who has a push token.
    const { data: users } = await admin
      .from("users")
      .select("push_token")
      .not("push_token", "is", null);
    const tokens = (users ?? [])
      .map((u: { push_token: string | null }) => u.push_token)
      .filter((t: string | null): t is string => !!t);

    let pushResult: unknown = null;
    if (tokens.length > 0) {
      const messages = tokens.map((to: string) => ({
        to,
        title: "Update tersedia 🎉",
        body: `Versi ${version} sudah bisa diunduh. Buka Profil untuk memperbarui.`,
        data: { type: "app_update", version },
      }));
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
      });
      pushResult = await res.json();
    }

    return new Response(
      JSON.stringify({
        status: "published",
        version,
        notified: tokens.length,
        push: pushResult,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: cors,
    });
  }
});
