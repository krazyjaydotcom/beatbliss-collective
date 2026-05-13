import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, Eye, Music2, ExternalLink,
  DollarSign, Heart, Save, GripVertical, Image
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/store")({
  head: () => ({ meta: [{ title: "My Store — MyBeatCatalog" }] }),
  component: StoreEditorPage,
});

type Track = {
  id: string;
  title: string;
  stream_url: string;
  download_url: string;
  duration: string;
};

type StoreData = {
  store_name: string;
  store_bio: string;
  store_artwork_url: string;
  store_tracks: Track[];
  store_buy_url: string;
  store_donate_url: string;
  store_username: string;
};

const EMPTY_STORE: StoreData = {
  store_name: "",
  store_bio: "",
  store_artwork_url: "",
  store_tracks: [],
  store_buy_url: "",
  store_donate_url: "",
  store_username: "",
};

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function StoreEditorPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<StoreData>(EMPTY_STORE);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("profiles")
      .select("store_name, store_bio, store_artwork_url, store_tracks, store_buy_url, store_donate_url, store_username, display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: any | null }) => {
        if (data) {
          setStore({
            store_name: data.store_name ?? data.display_name ?? "",
            store_bio: data.store_bio ?? "",
            store_artwork_url: data.store_artwork_url ?? "",
            store_tracks: (data.store_tracks as Track[]) ?? [],
            store_buy_url: data.store_buy_url ?? "",
            store_donate_url: data.store_donate_url ?? "",
            store_username: data.store_username ?? "",
          });
        }
        setLoading(false);
      });
  }, [user]);

  async function checkUsername(username: string) {
    if (!username || username.length < 3) { setUsernameAvailable(null); return; }
    setCheckingUsername(true);
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id")
      .eq("store_username", username)
      .neq("id", user!.id)
      .maybeSingle();
    setUsernameAvailable(!data);
    setCheckingUsername(false);
  }

  function setField<K extends keyof StoreData>(key: K, value: StoreData[K]) {
    setStore((s) => ({ ...s, [key]: value }));
  }

  function addTrack() {
    const newTrack: Track = {
      id: crypto.randomUUID(),
      title: "",
      stream_url: "",
      download_url: "",
      duration: "",
    };
    setField("store_tracks", [...store.store_tracks, newTrack]);
  }

  function updateTrack(id: string, field: keyof Track, value: string) {
    setField(
      "store_tracks",
      store.store_tracks.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }

  function removeTrack(id: string) {
    setField("store_tracks", store.store_tracks.filter((t) => t.id !== id));
  }

  async function onSave() {
    if (!user) return;
    if (!store.store_username || store.store_username.length < 3) {
      toast.error("Username must be at least 3 characters.");
      return;
    }
    if (usernameAvailable === false) {
      toast.error("That username is already taken.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("profiles").update({
      store_name: store.store_name || null,
      store_bio: store.store_bio || null,
      store_artwork_url: store.store_artwork_url || null,
      store_tracks: store.store_tracks,
      store_buy_url: store.store_buy_url || null,
      store_donate_url: store.store_donate_url || null,
      store_username: store.store_username || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Store saved!");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "https://mybeatcatalog.com";
  const previewUrl = store.store_username
    ? `${publicOrigin}/artist/${store.store_username}`
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Artist Store</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">My Store</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your public music storefront. Share the link with your fans.
          </p>
        </div>
        <div className="flex gap-2">
          {previewUrl && (
            <Button variant="heroOutline" size="sm" asChild>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" /> Preview
              </a>
            </Button>
          )}
          <Button variant="hero" size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Username */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" /> Your Store URL
        </h2>
        <div>
          <label className="text-sm font-medium">Username</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground shrink-0">{publicOrigin}/artist/</span>
            <Input
              value={store.store_username}
              onChange={(e) => {
                const val = slugify(e.target.value);
                setField("store_username", val);
                checkUsername(val);
              }}
              placeholder="yourname"
              className="max-w-[200px]"
            />
            {checkingUsername && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!checkingUsername && usernameAvailable === true && (
              <span className="text-xs text-green-500 font-medium">✓ Available</span>
            )}
            {!checkingUsername && usernameAvailable === false && (
              <span className="text-xs text-destructive font-medium">✗ Taken</span>
            )}
          </div>
          {previewUrl && (
            <p className="text-xs text-muted-foreground mt-2">
              Your store: <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{previewUrl}</a>
            </p>
          )}
        </div>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Image className="h-4 w-4 text-primary" /> Artist Profile
        </h2>
        <div>
          <label className="text-sm font-medium">Artist / Project name</label>
          <Input
            value={store.store_name}
            onChange={(e) => setField("store_name", e.target.value)}
            placeholder="Your artist name"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Bio</label>
          <Textarea
            value={store.store_bio}
            onChange={(e) => setField("store_bio", e.target.value.slice(0, 300))}
            placeholder="A short description of your music and message…"
            rows={3}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">{store.store_bio.length}/300</p>
        </div>
        <div>
          <label className="text-sm font-medium">Artwork URL</label>
          <Input
            type="url"
            value={store.store_artwork_url}
            onChange={(e) => setField("store_artwork_url", e.target.value)}
            placeholder="https://i.imgur.com/your-album-art.jpg"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Paste a direct image URL — Imgur, Dropbox, Google Drive (direct link), etc.
          </p>
          {store.store_artwork_url && (
            <img
              src={store.store_artwork_url}
              alt="Artwork preview"
              className="mt-3 h-24 w-24 rounded-xl object-cover border border-border"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
        </div>
      </div>

      {/* Tracks */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Music2 className="h-4 w-4 text-primary" /> Tracks
          </h2>
          <Button size="sm" variant="heroOutline" onClick={addTrack}>
            <Plus className="h-4 w-4 mr-1" /> Add Track
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste streaming or download links — Spotify, SoundCloud, Dropbox, Google Drive, etc.
        </p>

        {store.store_tracks.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-border">
            <Music2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tracks yet. Add your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {store.store_tracks.map((track, i) => (
              <div key={track.id} className="rounded-xl border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Track {i + 1}</span>
                  </div>
                  <button
                    onClick={() => removeTrack(track.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <Input
                      value={track.title}
                      onChange={(e) => updateTrack(track.id, "title", e.target.value)}
                      placeholder="Song title"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Duration</label>
                    <Input
                      value={track.duration}
                      onChange={(e) => updateTrack(track.id, "duration", e.target.value)}
                      placeholder="3:24"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Stream / Preview URL</label>
                  <Input
                    type="url"
                    value={track.stream_url}
                    onChange={(e) => updateTrack(track.id, "stream_url", e.target.value)}
                    placeholder="https://soundcloud.com/..."
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Download URL (optional)</label>
                  <Input
                    type="url"
                    value={track.download_url}
                    onChange={(e) => updateTrack(track.id, "download_url", e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monetization */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" /> Monetization
        </h2>
        <p className="text-xs text-muted-foreground">
          Paste your external payment links. These will show as buttons on your public store.
        </p>
        <div>
          <label className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5" /> Buy Now URL
          </label>
          <Input
            type="url"
            value={store.store_buy_url}
            onChange={(e) => setField("store_buy_url", e.target.value)}
            placeholder="https://buy.stripe.com/... or gumroad.com/..."
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-3.5 w-3.5" /> Donate URL
          </label>
          <Input
            type="url"
            value={store.store_donate_url}
            onChange={(e) => setField("store_donate_url", e.target.value)}
            placeholder="https://cash.app/$ or paypal.me/..."
            className="mt-1"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="ghost" asChild><Link to="/account">Cancel</Link></Button>
        <Button variant="hero" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving…" : "Save Store"}
        </Button>
      </div>
    </div>
  );
}
