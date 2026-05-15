import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  artist: "Artist / Creator — $49.99/mo",
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          setProfile(payload.new as ProfileRow);
        },
      )
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
                <Link to="/" hash="pricing">
                  Choose a plan
                </Link>
              </Button>
            )}
          </div>
        </div>

        {isSubscribed && <ExclusiveOpportunities />}

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
                See exactly what rights, credits, and split requirements apply to every beat you download as a paid
                member.
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
          <Button variant="ghost" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </main>
    </div>
  );
}

interface ExclusiveOpportunity {
  request_id: string;
  beat_id: string;
  beat_title: string;
  cover_url: string | null;
  genre: string | null;
  bpm: number | null;
  requested_amount: number | null;
  minimum_bid: number | null;
  bid_deadline: string;
  current_high_bid: number;
  my_bid: number | null;
  bidder_count: number;
}

function currency(value: number | null | undefined) {
  if (!value) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function ExclusiveOpportunities() {
  const [items, setItems] = useState<ExclusiveOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExclusiveOpportunity | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("list_my_exclusive_opportunities");
    if (!error) setItems((data ?? []) as ExclusiveOpportunity[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const submitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert("Enter a valid bid amount.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("place_exclusive_bid", {
      _request_id: selected.request_id,
      _amount: parsed,
      _note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSelected(null);
    setAmount("");
    setNote("");
    await load();
  };

  if (loading) return null;
  if (!items.length) return null;

  return (
    <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Exclusive rights open</p>
          <h2 className="mt-1 text-2xl font-black">You can bid on downloaded beats</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These opportunities are visible because you previously downloaded the beat.
          </p>
        </div>
        <Badge variant="outline">{items.length} open</Badge>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.request_id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-4">
              {item.cover_url ? (
                <img src={item.cover_url} alt={item.beat_title} className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{item.beat_title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.genre ?? "Beat"} {item.bpm ? `- ${item.bpm} BPM` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Closes {new Date(item.bid_deadline).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Highest bid</p>
                <p className="font-black">{currency(item.current_high_bid)}</p>
                {item.my_bid ? <p className="text-xs text-primary">Your bid: {currency(item.my_bid)}</p> : null}
              </div>
              <Button
                variant="hero"
                onClick={() => {
                  setSelected(item);
                  setAmount(String(Math.max(item.current_high_bid + 25, item.minimum_bid ?? item.requested_amount ?? 1)));
                  setNote("");
                }}
              >
                {item.my_bid ? "Raise bid" : "Place bid"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place exclusive rights bid</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitBid} className="space-y-4">
            <div>
              <p className="font-semibold">{selected?.beat_title}</p>
              <p className="text-sm text-muted-foreground">
                Minimum bid: {currency(selected?.minimum_bid ?? selected?.requested_amount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Bid amount</label>
              <Input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Note to admin</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="hero" disabled={saving}>
                {saving ? "Saving..." : "Submit bid"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

