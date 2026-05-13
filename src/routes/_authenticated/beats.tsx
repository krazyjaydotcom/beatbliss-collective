import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Music, Sparkles, Disc3, Smile, Hash, Gauge, ListMusic, Heart, Download,
  CreditCard, Receipt, NotebookPen, Settings, LifeBuoy, LogOut, Search,
  ShoppingCart, Bell, SlidersHorizontal, Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume2, MoreHorizontal, Plus, Pin, Trash2, Edit3,
  LayoutGrid, List as ListIcon, FileText, Loader2, X, GraduationCap, Music2, Store, CheckCheck,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { KrazyLogo } from "@/components/krazy-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/format";
import { generateAgreementPdf, type AgreementData } from "@/lib/agreement-pdf";

export const Route = createFileRoute("/_authenticated/beats")({
  head: () => ({
    meta: [
      { title: "Beat Catalog — MYBEATCATALOG" },
      { name: "description", content: "Browse premium beats, save notes, and download with member credits." },
    ],
  }),
  component: BeatsDashboard,
});

type Beat = {
  id: string; title: string; producer_name: string; genre: string; mood: string;
  music_key: string; bpm: number; duration_seconds: number; cover_url: string | null;
  audio_url: string | null; audio_url_wav: string | null; audio_url_tagged: string | null;
  is_member_only: boolean; release_at: string | null;
};
type Note = {
  id: string; title: string; content: string; is_pinned: boolean;
  beat_id: string | null; updated_at: string;
};
type Profile = {
  credits_balance: number; display_name: string | null; full_name: string | null; email: string | null;
  subscription_tier: string | null; subscription_status: string | null;
};

type SidebarAction = "beats" | "new" | "classroom" | "beatRequest" | "store" | "filterBpm" | "myBeats" | "playlists" | "downloads" | "favorites" | "credits" | "transactions" | "notepad" | "whitelist" | "settings" | "support";

const SIDEBAR: { icon: typeof Music; label: string; action: SidebarAction; badge?: string }[] = [
  { icon: Music, label: "Beats", action: "beats" },
  { icon: Sparkles, label: "New Releases", action: "new", badge: "NEW" },
  { icon: GraduationCap, label: "Classroom", action: "classroom" },
  { icon: Gauge, label: "By BPM", action: "filterBpm" },
  { icon: Music, label: "My Beats", action: "myBeats" },
  { icon: ListMusic, label: "My Playlists", action: "playlists" },
  { icon: Download, label: "Downloads", action: "downloads" },
  { icon: Heart, label: "Favorites", action: "favorites" },
  { icon: CreditCard, label: "Credits & Plan", action: "credits" },
  { icon: Receipt, label: "Transactions", action: "transactions" },
  { icon: NotebookPen, label: "Notepad", action: "notepad" },
  { icon: FileText, label: "Whitelist", action: "whitelist" },
  { icon: Settings, label: "Settings", action: "settings" },
  { icon: LifeBuoy, label: "Support", action: "support" },
];

function BeatsDashboard() {
  const { user, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [mood, setMood] = useState("all");
  const [musicKey, setMusicKey] = useState("all");
  const [bpm, setBpm] = useState("all");
  const [sort, setSort] = useState("newest");
  const [favOnly, setFavOnly] = useState(false);
  const [activeNav, setActiveNav] = useState<SidebarAction>("beats");
  const [now, setNow] = useState<Beat | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [confirmBeat, setConfirmBeat] = useState<Beat | null>(null);
  const [notepadOpen, setNotepadOpen] = useState(false);

  const { data: beats = [] } = useQuery({
    queryKey: ["beats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("beats").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      return ((data ?? []) as Beat[]).filter((beat) => !beat.release_at || new Date(beat.release_at).getTime() <= now);
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("credits_balance, display_name, full_name, email, subscription_tier, subscription_status")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const raw = localStorage.getItem(`favs:${user!.id}`);
      return raw ? (JSON.parse(raw) as string[]) : [];
    },
  });

  const sidebarItems = useMemo(() => {
    if (profile?.subscription_status !== "active") return SIDEBAR;
    return [
      ...SIDEBAR.slice(0, 3),
      { icon: Music2, label: "Beat Request", action: "beatRequest" as SidebarAction },
      { icon: Store, label: "My Store", action: "store" as SidebarAction },
      ...SIDEBAR.slice(3),
    ];
  }, [profile?.subscription_status]);

  useEffect(() => {
    if (!user) return;
    const token = window.localStorage.getItem("pendingInviteToken");
    if (!token) return;

    const markInviteUsed = async () => {
      const { data, error } = await (supabase as any)
        .from("invites")
        .select("id, used_at")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) return;
      if (data.used_at) {
        window.localStorage.removeItem("pendingInviteToken");
        return;
      }

      const { error: updateError } = await (supabase as any)
        .from("invites")
        .update({ used_by: user.id, used_at: new Date().toISOString() })
        .eq("id", data.id);

      if (!updateError) {
        window.localStorage.removeItem("pendingInviteToken");
      }
    };

    void markInviteUsed();
  }, [user]);

  const toggleFav = (id: string) => {
    if (!user) return;
    const next = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
    localStorage.setItem(`favs:${user.id}`, JSON.stringify(next));
    qc.setQueryData(["favorites", user.id], next);
  };

  const filtered = useMemo(() => {
    let list = beats.filter((b) => {
      if (favOnly && !favorites.includes(b.id)) return false;
      if (search && !`${b.title} ${b.producer_name} ${b.genre} ${b.mood} ${b.music_key}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (genre !== "all" && b.genre !== genre) return false;
      if (mood !== "all" && b.mood !== mood) return false;
      if (musicKey !== "all" && b.music_key !== musicKey) return false;
      if (bpm !== "all") {
        if (bpm === "slow" && b.bpm >= 120) return false;
        if (bpm === "mid" && (b.bpm < 120 || b.bpm > 140)) return false;
        if (bpm === "fast" && b.bpm <= 140) return false;
      }
      return true;
    });
    if (sort === "bpm") list = [...list].sort((a, b) => a.bpm - b.bpm);
    if (sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [beats, favorites, favOnly, search, genre, mood, musicKey, bpm, sort]);

  const uniq = (key: keyof Beat) => Array.from(new Set(beats.map((b) => b[key] as string)));

  function handleNav(action: SidebarAction) {
    setActiveNav(action);
    switch (action) {
      case "beats":
        setSearch(""); setGenre("all"); setMood("all"); setMusicKey("all"); setBpm("all"); setFavOnly(false); setSort("newest");
        break;
      case "new":
        setSort("newest"); setFavOnly(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "filterBpm":
        toast.info("Use the filter dropdowns above to narrow results.");
        break;
      case "classroom":
        navigate({ to: "/classroom" }); break;
      case "beatRequest":
        navigate({ to: "/beat-request" }); break;
      case "store":
        navigate({ to: "/store" }); break;
      case "myBeats":
      case "playlists":
        toast.info("Coming soon.");
        break;
      case "downloads": navigate({ to: "/downloads" }); break;
      case "favorites": setFavOnly((v) => !v); break;
      case "credits":
      case "transactions":
      case "settings":
        navigate({ to: "/account" }); break;
      case "notepad":
        setNotepadOpen((v) => !v);
        break;
      case "whitelist":
        navigate({ to: "/whitelist" }); break;
      case "support":
        toast.info("Use the chat bubble at the bottom right to reach support.");
        break;
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <div className="flex flex-1 min-h-0">
        {/* SIDEBAR */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card/40 p-4 gap-2 overflow-y-auto">

          <div className="px-2 pb-4">
            <Link to="/"><KrazyLogo className="text-xl" /></Link>
          </div>
          <nav className="flex-1 space-y-1">
            {sidebarItems.map((item) => {
              const active = activeNav === item.action || (item.action === "favorites" && favOnly);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.action)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-electric/15 text-electric border border-electric/30" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-electric text-electric-foreground">{item.badge}</span>
                  )}
                </button>
              );
            })}
            <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </nav>
          <div className="rounded-xl border border-border bg-secondary/60 p-4">
            <div className="font-semibold text-sm mb-1">Go Pro</div>
            <p className="text-xs text-muted-foreground mb-3">Unlock full access, premium WAVs, and member perks.</p>
            <Link to="/"><Button className="w-full bg-electric hover:bg-electric/90 text-electric-foreground">Upgrade Now</Button></Link>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 min-w-0 flex flex-col">
            {/* TOP BAR */}
            <header className="flex items-center gap-3 px-4 lg:px-8 py-4 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
              <div className="lg:hidden"><KrazyLogo className="text-base" /></div>
              <div className="flex-1 max-w-2xl relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search beats by mood, genre, key, artist…"
                  className="pl-10 pr-10 bg-secondary border-border"
                />
                <SlidersHorizontal className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-secondary">
                <Sparkles className="h-4 w-4 text-electric" />
                <span className="text-sm font-medium">{profile?.credits_balance ?? 0} Credits</span>
              </div>
              <Button variant="ghost" size="icon"><ShoppingCart className="h-5 w-5" /></Button>
              <NotificationsBell userId={user?.id} />
              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9"><AvatarFallback className="bg-electric/20 text-electric">{(profile?.display_name || user?.email || "U")[0].toUpperCase()}</AvatarFallback></Avatar>
                <span className="hidden md:inline text-sm font-medium">{profile?.display_name ?? user?.email?.split("@")[0]}</span>
              </div>
            </header>

            {/* CATALOG */}
            <ScrollArea className="flex-1">
              <div className="px-4 lg:px-8 py-6 pb-32">
                {isAdmin && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-electric/30 bg-electric/10 px-4 py-2 text-sm">
                    <span className="text-electric font-medium">Viewing as user (admin preview)</span>
                    <Link to="/admin" className="text-electric hover:underline font-semibold">← Back to admin</Link>
                  </div>
                )}
                <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
                  <div>
                    <h1 className="text-3xl font-bold">{favOnly ? "Favorites" : "All Beats"}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{filtered.length.toLocaleString()} beats found</p>
                  </div>
                </div>

                <div className="sticky top-[65px] z-10 bg-background/90 backdrop-blur border-b border-border px-4 lg:px-8 py-3 -mx-4 lg:-mx-8 mb-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <FilterSelect value={genre} onChange={setGenre} placeholder="All Genres" options={uniq("genre")} />
                    <FilterSelect value={mood} onChange={setMood} placeholder="All Moods" options={uniq("mood")} />
                    <FilterSelect value={musicKey} onChange={setMusicKey} placeholder="All Keys" options={uniq("music_key")} />
                    <Select value={bpm} onValueChange={setBpm}>
                      <SelectTrigger className="w-[140px] bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All BPM</SelectItem>
                        <SelectItem value="slow">Under 120</SelectItem>
                        <SelectItem value="mid">120–140</SelectItem>
                        <SelectItem value="fast">Over 140</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1" />
                    <Select value={sort} onValueChange={setSort}>
                      <SelectTrigger className="w-[160px] bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Sort by: Newest</SelectItem>
                        <SelectItem value="bpm">Sort by: BPM</SelectItem>
                        <SelectItem value="title">Sort by: Title</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex border border-border rounded-md overflow-hidden">
                      <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-electric text-electric-foreground" : "bg-secondary text-muted-foreground"}`}><ListIcon className="h-4 w-4" /></button>
                      <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "bg-electric text-electric-foreground" : "bg-secondary text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>

                {view === "list" ? (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="hidden md:grid grid-cols-[1fr_100px_120px_100px_80px_90px_50px_50px] gap-4 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground border-b border-border bg-secondary/40">
                      <div>Beat</div><div>Genre</div><div>Mood</div><div>Key</div><div>BPM</div><div>Duration</div><div></div><div></div>
                    </div>
                    {filtered.map((b) => (
                      <BeatRow
                        key={b.id} beat={b}
                        isPlaying={now?.id === b.id && playing}
                        isCurrent={now?.id === b.id}
                        isFav={favorites.includes(b.id)}
                        onPlay={() => { setNow(b); setPlaying(true); }}
                        onFav={() => toggleFav(b.id)}
                        onDownload={() => setConfirmBeat(b)}
                      />
                    ))}
                    {filtered.length === 0 && (
                      <div className="p-12 text-center text-muted-foreground">No beats match your filters.</div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((b) => (
                      <BeatCard key={b.id} beat={b}
                        isFav={favorites.includes(b.id)}
                        onPlay={() => { setNow(b); setPlaying(true); }}
                        onFav={() => toggleFav(b.id)}
                        onDownload={() => setConfirmBeat(b)} />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* NOTEPAD */}
          {notepadOpen && <NotepadPanel userId={user?.id} beats={beats} onClose={() => setNotepadOpen(false)} />}
        </div>
      </div>

      {/* AUDIO PLAYER */}
      <AudioPlayer
        beat={now} playing={playing} onToggle={() => setPlaying((p) => !p)}
        progress={progress} duration={duration}
        onProgress={setProgress} onDuration={setDuration}
        onFav={() => now && toggleFav(now.id)}
        isFav={now ? favorites.includes(now.id) : false}
        onDownload={() => now && setConfirmBeat(now)}
      />

      {/* DOWNLOAD CONFIRM */}
      <DownloadDialog
        beat={confirmBeat} credits={profile?.credits_balance ?? 0}
        profile={profile ?? null}
        onClose={() => setConfirmBeat(null)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["profile"] })}
      />
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] bg-secondary border-border"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function BeatCover({ beat, size = "md" }: { beat: Beat; size?: "sm" | "md" | "lg" }) {
  const sizeCls = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-14 w-14" : "h-12 w-12";
  const hash = beat.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 60) % 360;
  if (beat.cover_url) {
    return (
      <img
        src={beat.cover_url}
        alt={beat.title}
        loading="lazy"
        className={`${sizeCls} rounded-md object-cover shadow-card shrink-0 bg-secondary`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={`${sizeCls} rounded-md flex items-center justify-center text-xs font-bold text-white shadow-card shrink-0`}
      style={{ background: `linear-gradient(135deg, hsl(${hue1} 70% 35%), hsl(${hue2} 70% 25%))` }}>
      {beat.title.slice(0, 2).toUpperCase()}
    </div>
  );
}

function BeatRow({ beat, isPlaying, isCurrent, isFav, onPlay, onFav, onDownload }: {
  beat: Beat; isPlaying: boolean; isCurrent: boolean; isFav: boolean;
  onPlay: () => void; onFav: () => void; onDownload: () => void;
}) {
  return (
    <div className={`grid grid-cols-[1fr_50px_50px] md:grid-cols-[1fr_100px_120px_100px_80px_90px_50px_50px] gap-4 px-4 py-3 items-center border-b border-border last:border-0 hover:bg-secondary/40 transition-colors ${
      isCurrent ? "bg-electric/5 ring-1 ring-electric/40" : ""
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative">
          <BeatCover beat={beat} />
          <button onClick={onPlay} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 rounded-md transition">
            {isPlaying ? <Pause className="h-4 w-4 text-electric fill-electric" /> : <Play className="h-4 w-4 text-electric fill-electric" />}
          </button>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{beat.title}</span>
            {beat.is_member_only && <Badge className="bg-electric text-electric-foreground hover:bg-electric text-[10px] px-1.5">MEMBER</Badge>}
          </div>
          <div className="text-xs text-muted-foreground truncate">{beat.producer_name}</div>
        </div>
      </div>
      <div className="hidden md:block text-sm">{beat.genre}</div>
      <div className="hidden md:block text-sm">{beat.mood}</div>
      <div className="hidden md:block text-sm">{beat.music_key}</div>
      <div className="hidden md:block text-sm">{beat.bpm}</div>
      <div className="hidden md:block text-sm">{formatDuration(beat.duration_seconds)}</div>
      <button onClick={onFav} className={`p-2 rounded hover:bg-secondary ${isFav ? "text-primary" : "text-muted-foreground"}`}>
        <Heart className={`h-4 w-4 ${isFav ? "fill-primary" : ""}`} />
      </button>
      <button onClick={onDownload} className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-electric">
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}

function BeatCard({ beat, isFav, onPlay, onFav, onDownload }: {
  beat: Beat; isFav: boolean; onPlay: () => void; onFav: () => void; onDownload: () => void;
}) {
  const hash = beat.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue1 = hash % 360;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden group">
      <div
        className="aspect-square relative bg-cover bg-center"
        style={
          beat.cover_url
            ? { backgroundImage: `url(${beat.cover_url})` }
            : { background: `linear-gradient(135deg, hsl(${hue1} 70% 35%), hsl(${(hue1 + 60) % 360} 70% 20%))` }
        }
      >
        <button onClick={onPlay} className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
          <Play className="h-12 w-12 text-electric fill-electric" />
        </button>
        {beat.is_member_only && <Badge className="absolute top-2 left-2 bg-electric text-electric-foreground">MEMBER</Badge>}
      </div>
      <div className="p-3">
        <div className="font-semibold truncate">{beat.title}</div>
        <div className="text-xs text-muted-foreground">{beat.producer_name}</div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{beat.genre} · {beat.bpm}</span>
          <div className="flex gap-1">
            <button onClick={onFav}><Heart className={`h-4 w-4 ${isFav ? "fill-primary text-primary" : ""}`} /></button>
            <button onClick={onDownload}><Download className="h-4 w-4 hover:text-electric" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ NOTEPAD ============ */

const SAMPLE_NOTES: { title: string; content: string }[] = [
  { title: "Beat Ideas", content: "- Dark trap beat in C minor\n- 140 BPM\n- Hard hitting 808s\n- Ambient melody" },
  { title: "Collab Project", content: "- Need 3 hard trap beats\n- 1 melodic R&B beat\n- 1 hype beat for intro" },
  { title: "Mixing Notes", content: "- Use EQ to clean up low end\n- Add saturation to drums\n- Keep melodies wide" },
  { title: "Marketing Ideas", content: "- Post beat previews on IG\n- TikTok beat challenges\n- Email list for drops" },
];

function NotepadPanel({ userId, beats, onClose }: { userId?: string; beats: Beat[]; onClose?: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes").select("*")
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      if ((data?.length ?? 0) === 0) {
        // seed sample notes once
        const seeds = SAMPLE_NOTES.map((n) => ({ ...n, user_id: userId! }));
        await supabase.from("notes").insert(seeds);
        const { data: d2 } = await supabase.from("notes").select("*")
          .order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
        return (d2 ?? []) as Note[];
      }
      return data as Note[];
    },
  });

  const filtered = notes.filter((n) => `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase()));

  const upsert = useMutation({
    mutationFn: async (n: Partial<Note> & { title: string; content: string }) => {
      if (n.id) {
        const { error } = await supabase.from("notes").update({
          title: n.title, content: n.content, beat_id: n.beat_id ?? null, is_pinned: n.is_pinned ?? false,
        }).eq("id", n.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notes").insert({
          user_id: userId!, title: n.title, content: n.content, beat_id: n.beat_id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", userId] }),
  });

  const togglePin = useMutation({
    mutationFn: async (n: Note) => {
      const { error } = await supabase.from("notes").update({ is_pinned: !n.is_pinned }).eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", userId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", userId] }),
  });

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col border-l border-border bg-card/40 p-4 gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2"><NotebookPen className="h-4 w-4 text-electric" /> My Notepad</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing({ id: "", title: "", content: "", is_pinned: false, beat_id: null, updated_at: "" })} className="text-muted-foreground hover:text-electric">
            <Edit3 className="h-4 w-4" />
          </button>
          {onClose && (
            <button onClick={onClose} aria-label="Close notepad" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" className="pl-10 bg-secondary border-border" />
      </div>
      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="space-y-3 pb-3">
          {filtered.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-secondary/40 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-semibold text-sm">{n.title}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(n.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-sans">{n.content}</pre>
              {n.beat_id && (() => {
                const b = beats.find((x) => x.id === n.beat_id);
                return b ? (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-electric/30 bg-electric/10 px-2 py-0.5 text-[10px] font-medium text-electric">
                    <Music2 className="h-3 w-3" /> {b.title}
                  </div>
                ) : null;
              })()}
              <div className="flex items-center justify-end gap-1 mt-2">
                <button onClick={() => togglePin.mutate(n)} className={`p-1 rounded hover:bg-secondary ${n.is_pinned ? "text-electric" : "text-muted-foreground"}`}><Pin className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditing(n)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Edit3 className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove.mutate(n.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><MoreHorizontal className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <Button onClick={() => setEditing({ id: "", title: "", content: "", is_pinned: false, beat_id: null, updated_at: "" })} className="bg-electric hover:bg-electric/90 text-electric-foreground">
        <Plus className="h-4 w-4 mr-1" /> New Note
      </Button>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit note" : "New note"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Title" />
              <Textarea rows={6} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} placeholder="Write your note…" />
              <Select value={editing.beat_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, beat_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Attach to beat (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No beat</SelectItem>
                  {beats.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="bg-electric hover:bg-electric/90 text-electric-foreground" onClick={async () => {
              if (!editing?.title.trim()) { toast.error("Title required"); return; }
              await upsert.mutateAsync(editing);
              setEditing(null);
              toast.success("Note saved");
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

/* ============ AUDIO PLAYER ============ */

function AudioPlayer({ beat, playing, onToggle, progress, duration, onProgress, onDuration, onFav, isFav, onDownload }: {
  beat: Beat | null; playing: boolean; onToggle: () => void;
  progress: number; duration: number; onProgress: (n: number) => void; onDuration: (n: number) => void;
  onFav: () => void; isFav: boolean; onDownload: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(0.8);

  // simulate progress when no audio file is set
  useEffect(() => {
    if (!beat) return;
    const total = beat.duration_seconds;
    onDuration(total);
    if (!playing) return;
    const id = setInterval(() => {
      onProgress(Math.min(total, (audioRef.current?.currentTime ?? progress + 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [beat, playing]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    if (playing) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [playing, volume, beat]);

  if (!beat) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur z-20">
      <audio ref={audioRef} src={beat.audio_url ?? undefined} onTimeUpdate={(e) => onProgress(e.currentTarget.currentTime)} onLoadedMetadata={(e) => onDuration(e.currentTarget.duration || beat.duration_seconds)} />
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 w-64">
          <BeatCover beat={beat} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{beat.title}</span>
              {beat.is_member_only && <Badge className="bg-electric text-electric-foreground text-[10px]">MEMBER</Badge>}
            </div>
            <div className="text-xs text-muted-foreground truncate">{beat.producer_name}</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Shuffle className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><SkipBack className="h-4 w-4" /></Button>
            <Button onClick={onToggle} className="h-10 w-10 rounded-full bg-electric hover:bg-electric/90 text-electric-foreground p-0">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><SkipForward className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Repeat className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{formatDuration(Math.floor(progress))}</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                const t = pct * (duration || beat.duration_seconds);
                if (audioRef.current) audioRef.current.currentTime = t;
                onProgress(t);
              }}>
              <div className="h-full bg-electric" style={{ width: `${Math.min(100, (progress / (duration || beat.duration_seconds)) * 100)}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-10">{formatDuration(beat.duration_seconds)}</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 w-64 justify-end">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider value={[volume * 100]} onValueChange={(v) => setVolume(v[0] / 100)} max={100} step={1} className="w-24" />
          <button onClick={onFav} className={`p-2 rounded hover:bg-secondary ${isFav ? "text-primary" : "text-muted-foreground"}`}>
            <Heart className={`h-4 w-4 ${isFav ? "fill-primary" : ""}`} />
          </button>
          <button onClick={onDownload} className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-electric"><Download className="h-4 w-4" /></button>
          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

/* ============ DOWNLOAD CONFIRM ============ */

function DownloadDialog({ beat, credits, profile, onClose, onSuccess }: {
  beat: Beat | null; credits: number; profile: Profile | null; onClose: () => void; onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [fileType, setFileType] = useState<"MP3" | "WAV">("MP3");
  const cost = 1;

  const isPaid =
    !!profile?.subscription_tier &&
    profile.subscription_tier !== "none" &&
    ["active", "trialing", "past_due"].includes(profile.subscription_status ?? "");
  const wavAvailable = !!beat?.audio_url_wav;

  useEffect(() => {
    // Reset to MP3 each time the dialog opens
    if (beat) setFileType("MP3");
  }, [beat?.id]);

  const handleConfirm = async () => {
    if (!beat) return;
    if (credits < cost) { toast.error("Not enough credits"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("process_beat_download", {
        _beat_id: beat.id, _file_type: isPaid ? fileType : "MP3",
      });
      if (error) throw error;
      const result = data as { agreement_id: string; agreement_code: string; audio_url?: string };

      const { data: agr } = await supabase.from("agreements").select("*").eq("id", result.agreement_id).single();
      if (agr) {
        const pdf = generateAgreementPdf(agr as AgreementData);
        pdf.save(`MYBEATCATALOG-${(agr as AgreementData).agreement_id}.pdf`);
      }
      if (result.audio_url) {
        // Trigger the actual audio download
        const a = document.createElement("a");
        a.href = result.audio_url;
        const safeTitle = beat.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
        const suffix = fileType === "WAV" ? ".wav" : ".mp3";
        a.download = `KRAZYJAYDOTCOM_${safeTitle}${suffix}`;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      toast.success("Download ready", { description: "License agreement saved to your downloads." });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!beat} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-electric" /> Confirm download</DialogTitle>
          <DialogDescription>{beat?.title} by {beat?.producer_name}</DialogDescription>
        </DialogHeader>

        {isPaid && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File format</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFileType("MP3")}
                className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                  fileType === "MP3"
                    ? "border-electric bg-electric/10"
                    : "border-border hover:border-electric/50"
                }`}
              >
                <div className="text-sm font-bold">MP3</div>
                <div className="text-[11px] text-muted-foreground">Compressed · smaller file</div>
              </button>
              <button
                type="button"
                onClick={() => wavAvailable && setFileType("WAV")}
                disabled={!wavAvailable}
                className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                  fileType === "WAV"
                    ? "border-electric bg-electric/10"
                    : "border-border hover:border-electric/50"
                } ${!wavAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="text-sm font-bold">WAV</div>
                <div className="text-[11px] text-muted-foreground">
                  {wavAvailable ? "Studio quality · larger file" : "Not available for this beat"}
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Available credits</span><span className="font-semibold">{credits}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">This download will use</span><span className="font-semibold text-electric">{cost} credit</span></div>
          <div className="flex justify-between border-t border-border pt-2 mt-2"><span className="text-muted-foreground">After download</span><span className="font-semibold">{credits - cost}</span></div>
          <p className="text-xs text-muted-foreground pt-2">A license agreement PDF will be generated automatically and saved to your account.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="bg-electric hover:bg-electric/90 text-electric-foreground" onClick={handleConfirm} disabled={busy || credits < cost}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Download {isPaid ? fileType : "MP3"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ NOTIFICATIONS BELL ============ */

type Notif = { id: string; title: string; body: string; is_read: boolean; created_at: string };

function NotificationsBell({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notifs-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", userId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const unread = notifs.filter((n) => !n.is_read).length;

  const markAll = async () => {
    if (!userId) return;
    const { error } = await supabase.from("notifications").update({ is_read: true })
      .eq("user_id", userId).eq("is_read", false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs text-electric hover:underline flex items-center gap-1">
              <CheckCheck className="h-3 w-3" /> Mark all as read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">You're all caught up</div>
          ) : (
            <div className="divide-y divide-border">
              {notifs.map((n) => (
                <div key={n.id} className={`px-4 py-3 ${n.is_read ? "" : "bg-electric/5"}`}>
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-electric shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
