import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_PASSWORD = "Kontrakan123!";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller and check admin role
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: caller } = await admin.from("users").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: cors });
    }

    const { fullname, username, email, contact, password: chosen } = await req.json();
    if (!fullname || !email || !username) {
      return new Response(JSON.stringify({ error: "fullname, username, email are required" }), { status: 400, headers: cors });
    }
    if (chosen != null && (typeof chosen !== "string" || chosen.length < 8)) {
      return new Response(JSON.stringify({ error: "Password minimal 8 karakter." }), { status: 400, headers: cors });
    }
    // New accounts are always a plain member. Without a chosen password they
    // get the shared default (same one reset-password uses).
    const password = chosen ?? DEFAULT_PASSWORD;

    // Create auth user (email pre-confirmed for internal tool)
    const { data: authData, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) throw createErr;

    // Insert profile row. The password lives only in Supabase Auth.
    const { data: profile, error: profileErr } = await admin
      .from("users")
      .insert({
        id: authData.user.id,
        fullname,
        username,
        email,
        contact: contact || null,
        role: "member",
      })
      .select()
      .single();

    if (profileErr) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(authData.user.id);
      throw profileErr;
    }

    return new Response(JSON.stringify({ user: profile }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
});
