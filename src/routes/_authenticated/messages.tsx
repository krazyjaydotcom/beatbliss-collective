import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceMemoButton } from "@/components/voice-memo-button";
import { playSentDing, uploadVoiceMemo } from "@/lib/chat-audio";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [{ title: "Messages — MYBEATCATALOG" }],
  }),
  component: MessagesPage,
});

interface Message {
  id: string;
  body: string;
  sender_role: "user" | "admin";
  created_at: string;
  audio_url?: string | null;
  audio_mime?: string | null;
  audio_duration_seconds?: number | null;
}

function MessagesPage() {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: tid } = await supabase.rpc("ensure_chat_thread");
      if (cancelled || !tid) return;
      const id = tid as unknown as string;
      setThreadId(id);
      const { data: msgs } = await (supabase as any)
        .from("chat_messages")
        .select("id, body, sender_role, created_at, audio_url, audio_mime, audio_duration_seconds")
        .eq("thread_id", id)
        .order("created_at", { ascending: true });
      setMessages((msgs as Message[]) ?? []);
      await supabase.rpc("mark_thread_read", { _thread_id: id, _as_admin: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`messages-page:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => [...prev, m]);
          if (m.sender_role === "admin") {
            supabase.rpc("mark_thread_read", { _thread_id: threadId, _as_admin: false });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !threadId || !user) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      sender_role: "user",
      body,
    });
    if (!error) playSentDing();
  };

  const sendVoiceMemo = async (blob: Blob, durationSeconds: number) => {
    if (!threadId || !user) return;
    const uploaded = await uploadVoiceMemo(blob, user.id);
    const { error } = await (supabase as any).from("chat_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      sender_role: "user",
      body: "Voice memo",
      audio_url: uploaded.audioUrl,
      audio_mime: uploaded.mimeType,
      audio_duration_seconds: durationSeconds,
    });
    if (!error) playSentDing();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/40 px-4 lg:px-8 py-4 flex items-center gap-3">
        <Link to="/beats" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black tracking-tight">Messages</h1>
          <p className="text-xs text-muted-foreground">Direct line to KrazyJay</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 lg:p-6 min-h-0">
        <div className="flex-1 rounded-2xl border border-border bg-card flex flex-col overflow-hidden min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No messages yet. Say hi 👋
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender_role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.sender_role === "user"
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <MessageBubbleContent message={m} />
                    <div className="text-[10px] opacity-60 mt-1">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="p-3 border-t border-border flex gap-2"
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
            />
            <VoiceMemoButton disabled={!threadId || !user} onRecorded={sendVoiceMemo} />
            <Button type="submit" size="icon" variant="hero">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubbleContent({ message }: { message: Message }) {
  return (
    <div className="space-y-2">
      {message.body && message.body !== "Voice memo" ? <div>{message.body}</div> : null}
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
