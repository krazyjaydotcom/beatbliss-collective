import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const validateJoinToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("id, expires_at, used_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false as const, reason: "invalid" as const };
    if (invite.revoked_at) return { ok: false as const, reason: "revoked" as const };
    if (invite.used_at) return { ok: false as const, reason: "used" as const };
    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }
    return { ok: true as const };
  });

export const claimJoinInvite = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) =>
      z
        .object({
          token: z.string().min(8).max(128),
          email: z.string().email().max(254),
          password: z.string().min(8).max(128),
          firstName: z.string().min(1).max(80),
          lastName: z.string().min(1).max(80),
        })
        .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; email?: string; error?: string }> => {
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("id, expires_at, used_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false, error: "This invite link is no longer valid." };
    if (invite.revoked_at) return { ok: false, error: "This invite has been revoked." };
    if (invite.used_at) return { ok: false, error: "This invite has already been used." };
    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false, error: "This invite has expired." };
    }

    const email = data.email.trim().toLowerCase();
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        display_name: fullName,
      },
    });

    if (createErr || !created.user?.id) {
      const msg = createErr?.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return { ok: false, error: "An account with this email already exists. Please log in." };
      }
      return { ok: false, error: createErr?.message ?? "Failed to create account." };
    }

    const userId = created.user.id;

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: fullName,
        display_name: fullName,
        email,
        subscription_tier: "artist",
        subscription_status: "active",
      })
      .eq("id", userId);

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { ok: false, error: profileErr.message };
    }

    const { error: inviteErr } = await supabaseAdmin
      .from("invites")
      .update({ used_at: new Date().toISOString(), used_by: userId, claimed_by_user_id: userId })
      .eq("id", invite.id);

    if (inviteErr) {
      // Non-fatal; account exists. Log only.
      console.error("[join] failed to mark invite used", inviteErr);
    }

    return { ok: true, email };
  });
