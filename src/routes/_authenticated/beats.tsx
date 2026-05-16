import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Music,
  Sparkles,
  Disc3,
  Smile,
  Hash,
  Gauge,
  ListMusic,
  Heart,
  Download,
  CreditCard,
  Receipt,
  NotebookPen,
  Settings,
  LifeBuoy,
  LogOut,
  Search,
  ShoppingCart,
  Bell,
  SlidersHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  MoreHorizontal,
  Plus,
  Pin,
  Trash2,
  Edit3,
  LayoutGrid,
  List as ListIcon,
  FileText,
  Loader2,
  X,
  GraduationCap,
  Music2,
  CheckCheck,
  Store,
  Menu,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/format";
import { generateAgreementPdf, buildAgreementFilename, type AgreementData } from "@/lib/agreement-pdf";

export const Route = createFileRoute("/_authenticated/beats")({
  head: () => ({
    meta: [
      { title: "Beat Catalog — KRAZYJAYDOTCOM" },
      { name: "description", content: "Browse premium beats, save notes, and download with member credits." },
    ],
  }),
  component: BeatsDashboard,
});

type Beat = {
  id: string;
  title: string;
  producer_name: string;
  genre: string;
  mood: string;
  music_key: string;
  bpm: number;
  duration_seconds: number;
  cover_url: string | null;
  audio_url: string | null;
  audio_url_wav: string | null;
  audio_url_tagged: string | null;
  is_member_only: boolean;
  release_at: string | null;
};
type Note = {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  beat_id: string | null;
  updated_at: string;
};
type Profile = {
  credits_balance: number;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
};

type SidebarAction =
  | "beats"
  | "new"
  | "classroom"
  | "beatRequest"
  | "store"
  | "filterBpm"
  | "myBeats"
  | "playlists"
  | "downloads"
  | "favorites"
  | "credits"
  | "transactions"
  | "notepad"
  | "whitelist"
  | "settings"
  | "support";

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
  const [exclusiveBeat, setExclusiveBeat] = useState<Beat | null>(null);
  const [notepadOpen, setNotepadOpen] = useState(false);

  const { data: beats = [] } = useQuery({
    queryKey: ["beats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("beats")
        .select("*")
        .order("created_at", { ascending: false });
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

  const exclusiveRequestM = useMutation({
    mutationFn: async (payload: { beat: Beat; amount: number | null; intendedUse: string; notes: string }) => {
      if (!user) throw new Error("You must be logged in to request exclusive rights.");
      const { error } = await (supabase as any).from("exclusive_requests").insert({
        beat_id: payload.beat.id,
        requested_by: user.id,
        requested_amount: payload.amount,
        intended_use: payload.intendedUse.trim() || null,
        notes: payload.notes.trim() || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exclusive request sent. KrazyJay will review it.");
      setExclusiveBeat(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not send exclusive request."),
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
      if (
        search &&
        !`${b.title} ${b.producer_name} ${b.genre} ${b.mood} ${b.music_key}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
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
        setSearch("");
        setGenre("all");
        setMood("all");
        setMusicKey("all");
        setBpm("all");
        setFavOnly(false);
        setSort("newest");
        break;
      case "new":
        setSort("newest");
        setFavOnly(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "filterBpm":
        toast.info("Use the filter dropdowns above to narrow results.");
        break;
      case "classroom":
        navigate({ to: "/classroom" });
        break;
      case "beatRequest":
        navigate({ to: "/beat-request" });
        break;
      case "store":
        navigate({ to: "/store" });
        break;
      case "myBeats":
      case "playlists":
        toast.info("Coming soon.");
        break;
      case "downloads":
        navigate({ to: "/downloads" });
        break;
      case "favorites":
        setFavOnly((v) => !v);
        break;
      case "credits":
      case "transactions":
      case "settings":
        navigate({ to: "/account" });
        break;
      case "notepad":
        setNotepadOpen((v) => !v);
        break;
      case "whitelist":
        navigate({ to: "/whitelist" });
        break;
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
            <Link to="/">
              <KrazyLogo className="text-xl" />
            </Link>
          </div>
          <nav className="flex-1 space-y-1">
            {sidebarItems.map((item) => {
              const active = activeNav === item.action || (item.action === "favorites" && favOnly);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.action)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-electric/15 text-electric border border-electric/30"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-electric text-electric-foreground">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </nav>
          <div className="rounded-xl border border-border bg-secondary/60 p-4">
            <div className="font-semibold text-sm mb-1">Go Pro</div>
            <p className="text-xs text-muted-foreground mb-3">Unlock full access, premium WAVs, and member perks.</p>
            <Link to="/">
              <Button className="w-full bg-electric hover:bg-electric/90 text-electric-foreground">Upgrade Now</Button>
            </Link>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 min-w-0 flex flex-col">
            {/* TOP BAR */}
            <header className="flex items-center gap-3 px-4 lg:px-8 py-4 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
              <Sheet>
                <SheetTrigger asChild>
                  <button className="lg:hidden p-1 text-muted-foreground hover:text-foreground shrink-0">
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-4 bg-card border-r border-border">
                  <div className="mb-4">
                    <KrazyLogo className="text-base" />
                  </div>
                  <nav className="space-y-1">
                    {sidebarItems.map((item) => {
                      const Icon = item.icon;
                      const active = activeNav === item.action;
                      return (
                        <button
                          key={item.action}
                          onClick={() => handleNav(item.action)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-left">{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
              <div className="lg:hidden">
                <KrazyLogo className="text-base" />
              </div>
              <div className="flex-1 max-w-2xl relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search beats by mood, signature sound, key, artist..."
                  className="pl-10 pr-10 bg-secondary border-border"
                />
                <SlidersHorizontal className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-secondary">
                <Sparkles className="h-4 w-4 text-electric" />
                <span className="text-sm font-medium">{profile?.credits_balance ?? 0} Credits</span>
              </div>
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" />
              </Button>
              <NotificationsBell userId={user?.id} />
              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-electric/20 text-electric">
                    {(profile?.display_name || user?.email || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium">
                  {profile?.display_name ?? user?.email?.split("@")[0]}
                </span>
              </div>
            </header>

            {/* CATALOG */}
            <ScrollArea className="flex-1" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
              <div className="px-4 lg:px-8 py-6 pb-40 lg:pb-32">
                {isAdmin && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-electric/30 bg-electric/10 px-4 py-2 text-sm">
                    <span className="text-electric font-medium">Viewing as user (admin preview)</span>
                    <Link to="/admin" className="text-electric hover:underline font-semibold">
                      ← Back to admin
                    </Link>
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
                    <FilterSelect value={genre} onChange={setGenre} placeholder="All Signature Sounds" options={uniq("genre")} />
                    <FilterSelect value={mood} onChange={setMood} placeholder="All Moods" options={uniq("mood")} />
                    <FilterSelect
                      value={musicKey}
                      onChange={setMusicKey}
                      placeholder="All Keys"
                      options={uniq("music_key")}
                    />
                    <Select value={bpm} onValueChange={setBpm}>
                      <SelectTrigger className="w-[140px] bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All BPM</SelectItem>
                        <SelectItem value="slow">Under 120</SelectItem>
                        <SelectItem value="mid">120–140</SelectItem>
                        <SelectItem value="fast">Over 140</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1" />
                    <Select value={sort} onValueChange={setSort}>
                      <SelectTrigger className="w-[160px] bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Sort by: Newest</SelectItem>
                        <SelectItem value="bpm">Sort by: BPM</SelectItem>
                        <SelectItem value="title">Sort by: Title</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex border border-border rounded-md overflow-hidden">
                      <button
                        onClick={() => setView("list")}
                        className={`p-2 ${view === "list" ? "bg-electric text-electric-foreground" : "bg-secondary text-muted-foreground"}`}
                      >
                        <ListIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setView("grid")}
                        className={`p-2 ${view === "grid" ? "bg-electric text-electric-foreground" : "bg-secondary text-muted-foreground"}`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {view === "list" ? (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="hidden md:grid grid-cols-[1fr_100px_120px_100px_80px_90px_50px_50px_50px] gap-4 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground border-b border-border bg-secondary/40">
                      <div>Beat</div>
                      <div>Signature Sound</div>
                      <div>Mood</div>
                      <div>Key</div>
                      <div>BPM</div>
                      <div>Duration</div>
                      <div></div>
                      <div></div>
                      <div></div>
                    </div>
                    {filtered.map((b) => (
                      <BeatRow
                        key={b.id}
                        beat={b}
                        isPlaying={now?.id === b.id && playing}
                        isCurrent={now?.id === b.id}
                        isFav={favorites.includes(b.id)}
                        onPlay={() => {
                          setNow(b);
                          setPlaying(true);
                        }}
                        onFav={() => toggleFav(b.id)}
                        onDownload={() => setConfirmBeat(b)}
                        onRequestExclusive={() => setExclusiveBeat(b)}
                      />
                    ))}
                    {filtered.length === 0 && (
                      <div className="p-12 text-center text-muted-foreground">No beats match your filters.</div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((b) => (
                      <BeatCard
                        key={b.id}
                        beat={b}
                        isFav={favorites.includes(b.id)}
                        onPlay={() => {
                          setNow(b);
                          setPlaying(true);
                        }}
                        onFav={() => toggleFav(b.id)}
                        onDownload={() => setConfirmBeat(b)}
                        onRequestExclusive={() => setExclusiveBeat(b)}
                      />
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
        beat={now}
        playing={playing}
        onToggle={() => setPlaying((p) => !p)}
        progress={progress}
        duration={duration}
        onProgress={setProgress}
        onDuration={setDuration}
        onFav={() => now && toggleFav(now.id)}
        isFav={now ? favorites.includes(now.id) : false}
        onDownload={() => now && setConfirmBeat(now)}
      />

      {/* MOBILE BOTTOM NAV */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border flex items-center justify-around px-2 py-2">
        {[
          { icon: Music, label: "Beats", action: "beats" as const },
          { icon: Sparkles, label: "New", action: "new" as const },
          { icon: Heart, label: "Favorites", action: "favorites" as const },
          { icon: Download, label: "Downloads", action: "downloads" as const },
          { icon: User, label: "Account", action: "settings" as const },
        ].map(({ icon: Icon, label, action }) => {
          const active = activeNav === action;
          return (
            <button
              key={action}
              onClick={() => handleNav(action)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* DOWNLOAD CONFIRM */}
      <DownloadDialog
        beat={confirmBeat}
        credits={profile?.credits_balance ?? 0}
        profile={profile ?? null}
        onClose={() => setConfirmBeat(null)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["profile"] })}
      />
      <ExclusiveRequestDialog
        beat={exclusiveBeat}
        onClose={() => setExclusiveBeat(null)}
        onSubmit={(payload) => exclusiveRequestM.mutate(payload)}
        isPending={exclusiveRequestM.isPending}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] bg-secondary border-border">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
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
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className={`${sizeCls} rounded-md flex items-center justify-center text-xs font-bold text-white shadow-card shrink-0`}
      style={{ background: `linear-gradient(135deg, hsl(${hue1} 70% 35%), hsl(${hue2} 70% 25%))` }}
    >
      {beat.title.slice(0, 2).toUpperCase()}
    </div>
  );
}

function BeatRow({
  beat,
  isPlaying,
  isCurrent,
  isFav,
  onPlay,
  onFav,
  onDownload,
  onRequestExclusive,
}: {
  beat: Beat;
  isPlaying: boolean;
  isCurrent: boolean;
  isFav: boolean;
  onPlay: () => void;
  onFav: () => void;
  onDownload: () => void;
  onRequestExclusive: () => void;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_50px_50px_50px] md:grid-cols-[1fr_100px_120px_100px_80px_90px_50px_50px_50px] gap-4 px-4 py-4 md:py-3 items-center border-b border-border last:border-0 hover:bg-secondary/40 transition-colors ${
        isCurrent ? "bg-electric/5 ring-1 ring-electric/40" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative">
          <BeatCover beat={beat} />
          <button
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 rounded-md transition"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-electric fill-electric" />
            ) : (
              <Play className="h-4 w-4 text-electric fill-electric" />
            )}
          </button>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{beat.title}</span>
            {beat.is_member_only && (
              <Badge className="bg-electric text-electric-foreground hover:bg-electric text-[10px] px-1.5">
                MEMBER
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{beat.producer_name}</div>
        </div>
      </div>
      <div className="hidden md:block text-sm">{beat.genre}</div>
      <div className="hidden md:block text-sm">{beat.mood}</div>
      <div className="hidden md:block text-sm">{beat.music_key}</div>
      <div className="hidden md:block text-sm">{beat.bpm}</div>
      <div className="hidden md:block text-sm">{formatDuration(beat.duration_seconds)}</div>
      <button
        onClick={onFav}
        className={`p-2 rounded hover:bg-secondary ${isFav ? "text-primary" : "text-muted-foreground"}`}
      >
        <Heart className={`h-4 w-4 ${isFav ? "fill-primary" : ""}`} />
      </button>
      <button onClick={onDownload} className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-electric">
        <Download className="h-4 w-4" />
      </button>
      <button
        onClick={onRequestExclusive}
        className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-primary"
        title="Request exclusive rights"
      >
        <Sparkles className="h-4 w-4" />
      </button>
    </div>
  );
}

function BeatCard({
  beat,
  isFav,
  onPlay,
  onFav,
  onDownload,
  onRequestExclusive,
}: {
  beat: Beat;
  isFav: boolean;
  onPlay: () => void;
  onFav: () => void;
  onDownload: () => void;
  onRequestExclusive: () => void;
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
        <button
          onClick={onPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition"
        >
          <Play className="h-12 w-12 text-electric fill-electric" />
        </button>
        {beat.is_member_only && (
          <Badge className="absolute top-2 left-2 bg-electric text-electric-foreground">MEMBER</Badge>
        )}
      </div>
      <div className="p-3">
        <div className="font-semibold truncate">{beat.title}</div>
        <div className="text-xs text-muted-foreground">{beat.producer_name}</div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {beat.genre} · {beat.bpm}
          </span>
          <div className="flex gap-1">
            <button onClick={onFav}>
              <Heart className={`h-4 w-4 ${isFav ? "fill-primary text-primary" : ""}`} />
            </button>
            <button onClick={onDownload}>
              <Download className="h-4 w-4 hover:text-electric" />
            </button>
          </div>
        </div>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onRequestExclusive}>
          Request Exclusive
        </Button>
      </div>
    </div>
  );
}

function ExclusiveRequestDialog({
  beat,
  onClose,
  onSubmit,
  isPending,
}: {
  beat: Beat | null;
  onClose: () => void;
  onSubmit: (payload: { beat: Beat; amount: number | null; intendedUse: string; notes: string }) => void;
  isPending: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!beat) return;
    setAmount("");
    setIntendedUse("");
    setNotes("");
  }, [beat?.id]);

  return (
    <Dialog open={!!beat} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request exclusive rights</DialogTitle>
          <DialogDescription>
            Tell KrazyJay how you want to use {beat?.title ?? "this beat"} and what you would like to offer.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!beat) return;
            const parsed = amount.trim() ? Number(amount) : null;
            if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
              toast.error("Enter a valid offer amount.");
              return;
            }
            onSubmit({ beat, amount: parsed, intendedUse, notes });
          }}
        >
          <div>
            <label className="text-sm font-medium">Offer amount</label>
            <Input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">How do you plan to use it?</label>
            <Textarea
              value={intendedUse}
              onChange={(e) => setIntendedUse(e.target.value)}
              placeholder="Single, video, album cut, campaign, etc."
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Additional notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Timeline, release plans, budget notes..."
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={isPending}>
              {isPending ? "Sending..." : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============ NOTEPAD ============ */

function NotepadPanel({ userId, beats, onClose }: { userId?: string; beats: Beat[]; onClose?: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId!)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  const filtered = notes.filter((n) => `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase()));

  const upsert = useMutation({
    mutationFn: async (n: Partial<Note> & { title: string; content: string }) => {
      if (n.id) {
        const { error } = await supabase
          .from("notes")
          .update({
            title: n.title,
            content: n.content,
            beat_id: n.beat_id ?? null,
            is_pinned: n.is_pinned ?? false,
          })
          .eq("id", n.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notes").insert({
          user_id: userId!,
          title: n.title,
          content: n.content,
          beat_id: n.beat_id ?? null,
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
        <h2 className="font-semibold flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-electric" /> My Notepad
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setEditing({ id: "", title: "", content: "", is_pinned: false, beat_id: null, updated_at: "" })
            }
            className="text-muted-foreground hover:text-electric"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close notepad"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="pl-10 bg-secondary border-border"
        />
      </div>
      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="space-y-3 pb-3">
          {filtered.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-secondary/40 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-semibold text-sm">{n.title}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(n.updated_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-sans">{n.content}</pre>
              {n.beat_id &&
                (() => {
                  const b = beats.find((x) => x.id === n.beat_id);
                  return b ? (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-electric/30 bg-electric/10 px-2 py-0.5 text-[10px] font-medium text-electric">
                      <Music2 className="h-3 w-3" /> {b.title}
                    </div>
                  ) : null;
                })()}
              <div className="flex items-center justify-end gap-1 mt-2">
                <button
                  onClick={() => togglePin.mutate(n)}
                  className={`p-1 rounded hover:bg-secondary ${n.is_pinned ? "text-electric" : "text-muted-foreground"}`}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setEditing(n)} className="p-1 rounded hover:bg-secondary text-muted-foreground">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove.mutate(n.id)}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <Button
        onClick={() => setEditing({ id: "", title: "", content: "", is_pinned: false, beat_id: null, updated_at: "" })}
        className="bg-electric hover:bg-electric/90 text-electric-foreground"
      >
        <Plus className="h-4 w-4 mr-1" /> New Note
      </Button>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit note" : "New note"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Title"
              />
              <Textarea
                rows={6}
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                placeholder="Write your note…"
              />
              <Select
                value={editing.beat_id ?? "none"}
                onValueChange={(v) => setEditing({ ...editing, beat_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Attach to beat (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No beat</SelectItem>
                  {beats.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              className="bg-electric hover:bg-electric/90 text-electric-foreground"
              onClick={async () => {
                if (!editing?.title.trim()) {
                  toast.error("Title required");
                  return;
                }
                await upsert.mutateAsync(editing);
                setEditing(null);
                toast.success("Note saved");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

/* ============ AUDIO PLAYER ============ */

function AudioPlayer({
  beat,
  playing,
  onToggle,
  progress,
  duration,
  onProgress,
  onDuration,
  onFav,
  isFav,
  onDownload,
}: {
  beat: Beat | null;
  playing: boolean;
  onToggle: () => void;
  progress: number;
  duration: number;
  onProgress: (n: number) => void;
  onDuration: (n: number) => void;
  onFav: () => void;
  isFav: boolean;
  onDownload: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!beat) return;
    onDuration(beat.duration_seconds);
    if (!playing) return;
    const id = setInterval(() => {
      onProgress(Math.min(beat.duration_seconds, audioRef.current?.currentTime ?? progress + 1));
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

  const total = duration || beat.duration_seconds || 1;
  const pct = Math.min(100, (progress / total) * 100);

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    const t = p * total;
    if (audioRef.current) audioRef.current.currentTime = t;
    onProgress(t);
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={beat.audio_url ?? undefined}
        onTimeUpdate={(e) => onProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => onDuration(e.currentTarget.duration || beat.duration_seconds)}
      />

      {/* MOBILE FULL-SCREEN PLAYER */}
      {expanded && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background flex flex-col select-none">
          <div className="flex items-center justify-between px-6 pt-14 pb-2">
            <button onClick={() => setExpanded(false)} className="flex items-center gap-1.5 text-muted-foreground">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-widest">Now Playing</span>
            </button>
            <button onClick={onFav} className={isFav ? "text-primary" : "text-muted-foreground"}>
              <Heart className={`h-5 w-5 ${isFav ? "fill-primary" : ""}`} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center px-12">
            <div
              className={`w-full max-w-xs aspect-square rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ${playing ? "scale-100 shadow-electric/20" : "scale-[0.88] opacity-75"}`}
            >
              {beat.cover_url ? (
                <img src={beat.cover_url} alt={beat.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <Music className="h-24 w-24 text-primary/30" />
                </div>
              )}
            </div>
          </div>

          <div className="px-8 mt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-black tracking-tight truncate leading-tight">{beat.title}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{beat.producer_name}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {beat.bpm && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                      {beat.bpm} BPM
                    </span>
                  )}
                  {beat.genre && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                      {beat.genre}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onDownload} className="p-2 text-muted-foreground shrink-0 mt-1">
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="px-8 mt-7">
            <div
              className="w-full h-1 bg-secondary/60 rounded-full overflow-visible cursor-pointer relative"
              onClick={seek}
            >
              <div className="h-full bg-electric rounded-full relative" style={{ width: `${pct}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md" />
              </div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(Math.floor(progress))}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatDuration(beat.duration_seconds)}
              </span>
            </div>
          </div>

          <div className="px-8 mt-6">
            <div className="flex items-center justify-between">
              <button className="p-3 text-muted-foreground/60">
                <Shuffle className="h-5 w-5" />
              </button>
              <button className="p-3 text-foreground/80">
                <SkipBack className="h-7 w-7" />
              </button>
              <button
                onClick={onToggle}
                className="h-[72px] w-[72px] rounded-full bg-electric shadow-xl shadow-electric/40 flex items-center justify-center active:scale-95 transition-transform"
              >
                {playing ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 text-white ml-1" />}
              </button>
              <button className="p-3 text-foreground/80">
                <SkipForward className="h-7 w-7" />
              </button>
              <button className="p-3 text-muted-foreground/60">
                <Repeat className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 px-8 mt-6 mb-12">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground shrink-0"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            </svg>
            <Slider
              value={[volume * 100]}
              onValueChange={(v) => setVolume(v[0] / 100)}
              max={100}
              step={1}
              className="flex-1"
            />
            <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      )}

      {/* MOBILE MINI PLAYER */}
      <div className="lg:hidden fixed bottom-16 inset-x-0 z-20 px-3">
        <div
          className="rounded-2xl bg-card/95 backdrop-blur border border-border/80 shadow-2xl overflow-hidden cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <div className="w-full h-0.5 bg-secondary">
            <div className="h-full bg-electric transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 bg-primary/10">
              {beat.cover_url ? (
                <img src={beat.cover_url} alt={beat.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="h-5 w-5 text-primary/40" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate leading-tight">{beat.title}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{beat.producer_name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={onFav} className={`p-2 ${isFav ? "text-primary" : "text-muted-foreground"}`}>
                <Heart className={`h-4 w-4 ${isFav ? "fill-primary" : ""}`} />
              </button>
              <button
                onClick={onToggle}
                className="h-11 w-11 rounded-full bg-electric shadow-lg shadow-electric/30 flex items-center justify-center active:scale-95 transition-transform"
              >
                {playing ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP PLAYER BAR */}
      <div className="hidden lg:block fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur z-20">
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 w-64">
            <BeatCover beat={beat} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{beat.title}</span>
                {beat.is_member_only && (
                  <Badge className="bg-electric text-electric-foreground text-[10px]">MEMBER</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{beat.producer_name}</div>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Shuffle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                onClick={onToggle}
                className="h-10 w-10 rounded-full bg-electric hover:bg-electric/90 text-electric-foreground p-0"
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Repeat className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                {formatDuration(Math.floor(progress))}
              </span>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden cursor-pointer" onClick={seek}>
                <div className="h-full bg-electric" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums w-10">
                {formatDuration(beat.duration_seconds)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-64 justify-end">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume * 100]}
              onValueChange={(v) => setVolume(v[0] / 100)}
              max={100}
              step={1}
              className="w-24"
            />
            <button
              onClick={onFav}
              className={`p-2 rounded hover:bg-secondary ${isFav ? "text-primary" : "text-muted-foreground"}`}
            >
              <Heart className={`h-4 w-4 ${isFav ? "fill-primary" : ""}`} />
            </button>
            <button
              onClick={onDownload}
              className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-electric"
            >
              <Download className="h-4 w-4" />
            </button>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============ DOWNLOAD CONFIRM ============ */

function DownloadDialog({
  beat,
  credits,
  profile,
  onClose,
  onSuccess,
}: {
  beat: Beat | null;
  credits: number;
  profile: Profile | null;
  onClose: () => void;
  onSuccess: () => void;
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
    if (credits < cost) {
      toast.error("Not enough credits");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("process_beat_download", {
        _beat_id: beat.id,
        _file_type: isPaid ? fileType : "MP3",
      });
      if (error) throw error;
      const result = data as { agreement_id: string; agreement_code: string; audio_url?: string };

      const { data: agr } = await supabase.from("agreements").select("*").eq("id", result.agreement_id).single();
      if (agr) {
        const pdf = generateAgreementPdf(agr as AgreementData);
        pdf.save(buildAgreementFilename(agr as AgreementData));
      }
      if (result.audio_url) {
        // Trigger the actual audio download
        const a = document.createElement("a");
        a.href = result.audio_url;
        const safeTitle = beat.title.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
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
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-electric" /> Confirm download
          </DialogTitle>
          <DialogDescription>
            {beat?.title} by {beat?.producer_name}
          </DialogDescription>
        </DialogHeader>

        {isPaid && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File format</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFileType("MP3")}
                className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                  fileType === "MP3" ? "border-electric bg-electric/10" : "border-border hover:border-electric/50"
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
                  fileType === "WAV" ? "border-electric bg-electric/10" : "border-border hover:border-electric/50"
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">Available credits</span>
            <span className="font-semibold">{credits}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">This download will use</span>
            <span className="font-semibold text-electric">{cost} credit</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">After download</span>
            <span className="font-semibold">{credits - cost}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            A license agreement PDF will be generated automatically and saved to your account.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="bg-electric hover:bg-electric/90 text-electric-foreground"
            onClick={handleConfirm}
            disabled={busy || credits < cost}
          >
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
        .from("notifications")
        .select("*")
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const unread = notifs.filter((n) => !n.is_read).length;

  const markAll = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) {
      toast.error(error.message);
      return;
    }
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
                      {n.body && (
                        <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{n.body}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
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

