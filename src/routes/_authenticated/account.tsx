import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { SiteNav } from "@/components/site-nav";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

interface ProfileRow {
  email: string | null;
  subscription_tier: string;
  subscription_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

const TIER_LABEL: Record<string, string> = {
  none: "Free",
  artist: "Artist / Creator — $37/mo",
  label: "Label — $97/mo",
};

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const portal = useServerFn(createPortalSession);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("email, subscription_tier, subscription_status, current_period_end, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, (payload) => {
        setProfile(payload.new as ProfileRow);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const openPortal = async () => {
    setLoadingPortal(true);
    try {
      const url = await portal({
        data: { returnUrl: `${window.location.origin}/account`, environment: getStripeEnvironment() },
      });
      window.open(url, "_blank");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const tier = profile?.subscription_tier ?? "none";
  const isSubscribed = tier !== "none" && profile?.subscription_status === "active";

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <SiteNav />
      <main className="container mx-auto px-6 pt-32 pb-20 max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight">Your Account</h1>
        <p className="mt-2 text-muted-foreground">{profile?.email ?? user?.email}</p>

        <div className="mt-10 rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold tracking-wider text-muted-foreground">CURRENT PLAN</p>
              <p className="mt-1 text-2xl font-bold">{TIER_LABEL[tier] ?? tier}</p>
              {profile?.current_period_end && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile.subscription_status === "canceled" ? "Access ends" : "Renews"}{" "}
                  {new Date(profile.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            {isSubscribed ? (
              <Button variant="heroOutline" onClick={openPortal} disabled={loadingPortal}>
                {loadingPortal ? "Opening…" : "Manage billing"}
              </Button>
            ) : (
              <Button variant="hero" asChild>
                <Link to="/" hash="pricing">Choose a plan</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold">Whitelist your releases</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isSubscribed
                  ? "Submit songs you've released using KRAZYJAY beats so they're cleared on streaming platforms."
                  : "Available with a paid membership — clear your tracks on Spotify, Apple Music and YouTube."}
              </p>
            </div>
            <Button variant={isSubscribed ? "heroOutline" : "outline"} asChild>
              <Link to="/whitelist">{isSubscribed ? "Open whitelist" : "Learn more"}</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold">Unlimited License — preview</p>
              <p className="text-sm text-muted-foreground mt-1">
                See exactly what rights, credits, and split requirements apply to every beat you download as a paid member.
              </p>
            </div>
            <Button variant="heroOutline" asChild>
              <Link to="/license-example">View example license</Link>
            </Button>
          </div>
        </div>

        {isSubscribed && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold">Classroom</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Watch member-only lessons and walkthroughs from KRAZYJAY.
                </p>
              </div>
              <Button variant="heroOutline" asChild>
                <Link to="/classroom">Open classroom</Link>
              </Button>
            </div>
          </div>
        )}

        {isSubscribed && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold">My Store</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Build your public artist storefront with artwork, tracks, and external payment links.
                </p>
              </div>
              <Button variant="heroOutline" asChild>
                <Link to="/store">Open my store</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold">Profile</p>
              <p className="text-sm text-muted-foreground mt-1">Update your photo, bio, music link, and more.</p>
            </div>
            <Button variant="heroOutline" asChild>
              <Link to="/profile">Edit profile</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={handleSignOut}>Sign out</Button>
        </div>
      </main>
    </div>
  );
}
