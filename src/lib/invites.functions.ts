import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TIER_LABEL: Record<string, string> = {
  artist: "Artist / Creator",
  label: "Label",
};

export const validateInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(10).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("email, tier, expires_at, used_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false as const, reason: "invalid" as const };
    if (invite.revoked_at) return { ok: false as const, reason: "revoked" as const };
    if (invite.used_at) return { ok: false as const, reason: "used" as const };
    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }

    return {
      ok: true as const,
      email: invite.email,
      tier: invite.tier,
      tierLabel: TIER_LABEL[invite.tier] ?? invite.tier,
    };
  });

export const claimInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; password: string }) =>
    z
      .object({
        token: z.string().min(10).max(128),
        password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string; email?: string }> => {
    // Pre-validate the invite
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("email, tier, expires_at, used_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false, error: "This invite link is invalid." };
    if (invite.revoked_at) return { ok: false, error: "This invite has been revoked." };
    if (invite.used_at) return { ok: false, error: "This invite has already been used." };
    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false, error: "This invite has expired. Contact support for a new link." };
    }

    // Create the auth user (or find existing one with this email)
    let userId: string | undefined;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: data.password,
      email_confirm: true,
    });

    if (createErr) {
      // Email already in use → tell them to log in
      const msg = createErr.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return {
          ok: false,
          error: "An account with this email already exists. Please log in instead.",
        };
      }
      return { ok: false, error: createErr.message };
    }
    userId = created.user?.id;
    if (!userId) return { ok: false, error: "Failed to create account." };

    // Atomically claim
    const { error: claimErr } = await supabaseAdmin.rpc("claim_invite", {
      _token: data.token,
      _user_id: userId,
    });

    if (claimErr) {
      // Roll back the user we just created so they can try again
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { ok: false, error: claimErr.message };
    }

    return { ok: true, email: invite.email };
  });
