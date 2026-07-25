import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-publish-secret, content-type",
};

/**
 * Resolves the downloadable APK artifact URL for an EAS build via the Expo
 * GraphQL API. Used when CI hands us a build_id instead of a ready URL (the
 * build-job output has no artifact URL, and `eas` isn't available in workflow
 * steps). Requires the EXPO_TOKEN env var (an Expo access/robot token).
 *
 * @param buildId - The EAS build id.
 * @returns The application archive URL, or null if it can't be resolved.
 */
async function resolveApkUrl(buildId: string): Promise<string | null> {
  const token = Deno.env.get("EXPO_TOKEN");
  if (!token) throw new Error("EXPO_TOKEN is not configured");

  const query =
    "query($id: ID!){ builds { byId(buildId: $id){ artifacts { applicationArchiveUrl buildUrl } } } }";
  const res = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { id: buildId } }),
  });

  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error(
      `Expo API error: ${json.errors[0]?.message ?? "unknown"}`,
    );
  }
  const artifacts = json?.data?.builds?.byId?.artifacts;
  return artifacts?.applicationArchiveUrl ?? artifacts?.buildUrl ?? null;
}

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

    const { version, apk_url: providedUrl, build_id, release_notes } =
      await req.json();
    if (!version || (!providedUrl && !build_id)) {
      return new Response(
        JSON.stringify({ error: "Missing: version and (apk_url or build_id)" }),
        { status: 400, headers: cors },
      );
    }

    // Accept a ready-made apk_url, or resolve one from an EAS build_id.
    const apk_url = providedUrl ?? (await resolveApkUrl(build_id));
    if (!apk_url) {
      return new Response(
        JSON.stringify({ error: `Could not resolve APK URL for build ${build_id}` }),
        { status: 502, headers: cors },
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
