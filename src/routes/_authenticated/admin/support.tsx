import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { VoiceMemoButton } from "@/components/voice-memo-button";
import { playSentDing, uploadVoiceMemo } from "@/lib/chat-audio";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: SupportInbox,
});

function BroadcastsPanel() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastingAudio, setBroadcastingAudio] = useState(false);

  const sendAnnouncement = async () => {
    if (!title.trim()) {
      toast.error("Add a title for the announcement.");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.rpc("admin_create_notification", {
      _title: title.trim(),
      _body: body.trim(),
      _type: "announcement",
      _target_url: "/messages",
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Sent to ${data ?? 0} active members.`);
    setTitle("");
    setBody("");
  };

  const broadcastVoiceMemo = async (blob: Blob, durationSeconds: number) => {
    if (!user) return;
    setBroadcastingAudio(true);
    try {
      const uploaded = await uploadVoiceMemo(blob, user.id);
      const { data, error } = await supabase.rpc("admin_broadcast_chat_message", {
        _body: "",
        _audio_url: uploaded.audioUrl,
        _audio_mime: uploaded.mimeType,
        _audio_duration_seconds: durationSeconds,
      });
      if (error) throw error;
      playSentDing();
      toast.success(`Voice memo sent to ${data ?? 0} active members.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not broadcast voice memo.");
    } finally {
      setBroadcastingAudio(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-electric" />
        <h2 className="text-lg font-bold">Broadcast to all active members</h2>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Text announcement</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Announcement title"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message body (optional)"
          rows={3}
        />
        <Button onClick={sendAnnouncement} disabled={sending} variant="hero">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send announcement"}
        </Button>
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Voice broadcast</label>
        <p className="text-xs text-muted-foreground">
          Record a voice memo. It will appear in every active member's Messages and trigger a bell notification.
        </p>
        <div className="flex items-center gap-3">
          <VoiceMemoButton disabled={!user || broadcastingAudio} onRecorded={broadcastVoiceMemo} />
          {broadcastingAudio && <span className="text-xs text-muted-foreground">Broadcasting…</span>}
        </div>
      </div>
    </div>
  );
}

interface Thread {
  id: string;
  user_id: string;
  last_message_preview: string | null;
  last_message_at: string;
  unread_for_admin: number;
}

interface Message {
  id: string;
  body: string;
  sender_role: "user" | "admin";
  created_at: string;
  audio_url?: string | null;
  audio_mime?: string | null;
  audio_duration_seconds?: number | null;
}

function SupportInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["admin-threads"],
    queryFn: async () => {
      const { data: t } = await supabase
        .from("chat_threads")
        .select("*")
        .order("last_message_at", { ascending: false });
      const tids = (t ?? []).map((x) => x.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, display_name, full_name")
        .in("id", tids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (t ?? []).map((th) => ({ ...th, profile: map.get(th.user_id) }));
    },
  });

  // realtime: refresh threads list on any new message
  useEffect(() => {
    const ch = supabase
      .channel("admin-threads")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_threads" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-threads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // load active thread messages + subscribe
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("chat_messages")
        .select("id, body, sender_role, created_at, audio_url, audio_mime, audio_duration_seconds")
        .eq("thread_id", activeId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data as Message[]) ?? []);
      await supabase.rpc("mark_thread_read", { _thread_id: activeId, _as_admin: true });
      qc.invalidateQueries({ queryKey: ["admin-threads"] });
    })();
    const ch = supabase
      .channel(`admin-thread:${activeId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `thread_id=eq.${activeId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        supabase.rpc("mark_thread_read", { _thread_id: activeId, _as_admin: true });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !activeId || !user) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("chat_messages").insert({
      thread_id: activeId,
      sender_id: user.id,
      sender_role: "admin",
      body,
    });
    if (!error) playSentDing();
  };

  const sendVoiceMemo = async (blob: Blob, durationSeconds: number) => {
    if (!activeId || !user) return;
    const uploaded = await uploadVoiceMemo(blob, user.id);
    const { error } = await (supabase as any).from("chat_messages").insert({
      thread_id: activeId,
      sender_id: user.id,
      sender_role: "admin",
      body: "Voice memo",
      audio_url: uploaded.audioUrl,
      audio_mime: uploaded.mimeType,
      audio_duration_seconds: durationSeconds,
    });
    if (!error) playSentDing();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Support Inbox</h1>
        <p className="text-muted-foreground mt-1">Live conversations with users</p>
      </div>
      <BroadcastsPanel />
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[600px]">
        <div className="rounded-2xl border border-border bg-card overflow-y-auto">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No conversations yet.</p>
          ) : threads.map((t: any) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors",
                activeId === t.id && "bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">
                  {t.profile?.display_name || t.profile?.email || t.user_id.slice(0, 8)}
                </span>
                {t.unread_for_admin > 0 && (
                  <span className="h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                    {t.unread_for_admin}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-1">{t.last_message_preview || "—"}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden">
          {!activeId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.sender_role === "admin" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
                    }`}>
                      <MessageBubbleContent message={m} />
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-border flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" />
                <VoiceMemoButton disabled={!activeId || !user} onRecorded={sendVoiceMemo} />
                <Button type="submit" size="icon" variant="hero"><Send className="h-4 w-4" /></Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubbleContent({ message }: { message: Message }) {
  return (
    <div className="space-y-2">
      {message.body ? <div>{message.body}</div> : null}
      {message.audio_url ? (
        <audio controls src={message.audio_url} className="h-9 w-full max-w-[260px]">
          Your browser does not support audio playback.
        </audio>
      ) : null}
      {message.audio_duration_seconds ? (
        <div className="text-[10px] opacity-70">{message.audio_duration_seconds}s voice memo</div>
      ) : null}
    </div>
  );
}
