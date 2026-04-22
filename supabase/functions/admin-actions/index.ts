import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminActionBody =
  | { action: "invite"; email: string; displayName?: string; role?: string }
  | { action: "remove"; userId: string }
  | { action: "complete_setup" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return Response.json(
        { error: "Missing Supabase function secrets." },
        { status: 500, headers: corsHeaders },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: claimsData,
      error: claimsError,
    } = await authClient.auth.getClaims(authToken);

    const userId = claimsData?.claims?.sub ?? "";

    if (claimsError || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { data: adminRow, error: adminError } = await adminClient
      .from("admin_users")
      .select("user_id,is_active,email,display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminError || !adminRow || !adminRow.is_active) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = (await req.json()) as AdminActionBody;

    if (body.action === "invite") {
      const email = body.email.trim().toLowerCase();
      const displayName = body.displayName?.trim() || null;
      const role = body.role?.trim() || "admin";

      if (!email) {
        return Response.json({ error: "Email is required." }, { status: 400, headers: corsHeaders });
      }

      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: displayName ? { display_name: displayName } : undefined,
        },
      );

      if (inviteError || !inviteData.user) {
        return Response.json(
          { error: inviteError?.message ?? "Failed to invite admin." },
          { status: 400, headers: corsHeaders },
        );
      }

      const invitedUser = inviteData.user;

      const { error: upsertError } = await adminClient.from("admin_users").upsert(
        {
          user_id: invitedUser.id,
          email: invitedUser.email ?? email,
          display_name: displayName,
          role,
          is_active: true,
          needs_password_setup: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (upsertError) {
        return Response.json(
          { error: upsertError.message },
          { status: 400, headers: corsHeaders },
        );
      }

      return Response.json(
        {
          ok: true,
          user_id: invitedUser.id,
          email: invitedUser.email ?? email,
        },
        { headers: corsHeaders },
      );
    }

    if (body.action === "remove") {
      const userId = body.userId.trim();

      if (!userId) {
        return Response.json({ error: "User ID is required." }, { status: 400, headers: corsHeaders });
      }

      if (userId === claimsData.claims.sub) {
        return Response.json(
          { error: "You cannot remove your own admin access." },
          { status: 400, headers: corsHeaders },
        );
      }

      const { error: deleteAdminError } = await adminClient.from("admin_users").delete().eq("user_id", userId);
      if (deleteAdminError) {
        return Response.json(
          { error: deleteAdminError.message },
          { status: 400, headers: corsHeaders },
        );
      }

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        return Response.json(
          { error: deleteAuthError.message },
          { status: 400, headers: corsHeaders },
        );
      }

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (body.action === "complete_setup") {
      const { error: updateError } = await adminClient
        .from("admin_users")
        .update({
          needs_password_setup: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        return Response.json(
          { error: updateError.message },
          { status: 400, headers: corsHeaders },
        );
      }

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action." }, { status: 400, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
