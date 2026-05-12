import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type ProfileRow = {
  display_name: string | null;
  bio: string | null;
  music_link: string | null;
  birthday: string | null;
  avatar_url: string | null;
  email: string | null;
};

function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [musicLink, setMusicLink] = useState("");
  const [birthday, setBirthday] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [birthdayLocked, setBirthdayLocked] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, bio, music_link, birthday, avatar_url, email")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const p = (data ?? {}) as ProfileRow;
        setDisplayName(p.display_name ?? "");
        setBio(p.bio ?? "");
        setMusicLink(p.music_link ?? "");
        setBirthday(p.birthday ?? "");
        setAvatarUrl(p.avatar_url ?? null);
        setBirthdayLocked(!!p.birthday);
        setLoading(false);
      });
  }, [user]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      toast.success("Photo uploaded — click Save to apply.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!user) return;
    if (bio.length > 160) { toast.error("Bio must be 160 characters or fewer."); return; }
    setSaving(true);
    try {
      const update = {
        display_name: displayName || null,
        bio: bio || null,
        music_link: musicLink || null,
        avatar_url: avatarUrl,
        ...(!birthdayLocked && birthday ? { birthday } : {}),
      };
      const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
      if (error) throw error;
      if (!birthdayLocked && birthday) setBirthdayLocked(true);
      toast.success("Profile updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="container mx-auto px-6 pt-32 pb-20 max-w-2xl">
        <h1 className="text-4xl font-black tracking-tight">Edit Profile</h1>
        <p className="mt-2 text-muted-foreground">How other members and admins see you.</p>

        {loading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
        ) : (
          <div className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-8">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                <AvatarFallback className="bg-electric/20 text-electric text-2xl">
                  {(displayName || user?.email || "U")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
                <Button variant="heroOutline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Upload photo"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG or JPG, square works best.</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Display name</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your stage name" className="mt-1" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Bio</label>
                <span className={`text-xs ${bio.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>{bio.length}/160</span>
              </div>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                maxLength={160}
                rows={3}
                placeholder="A short tagline about you…"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Music link</label>
              <Input
                type="url"
                value={musicLink}
                onChange={(e) => setMusicLink(e.target.value)}
                placeholder="https://open.spotify.com/artist/..."
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Birthday</label>
              {birthdayLocked ? (
                <div className="mt-1">
                  <p className="text-sm">{new Date(birthday).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Birthday can only be set once.</p>
                </div>
              ) : (
                <>
                  <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Birthday can only be set once.</p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="ghost" asChild><Link to="/account">Cancel</Link></Button>
              <Button variant="hero" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
