import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  body: string;
  sender_role: "user" | "admin";
  created_at: string;
}

export function ChatWidget() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Don't show widget for admins (they have the inbox)
  if (!user || isAdmin) return null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("ensure_chat_thread");
      if (cancelled || !data) return;
      const tid = data as unknown as string;
      setThreadId(tid);
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, body, sender_role, created_at")
        .eq("thread_id", tid)
        .order("created_at", { ascending: true });
      setMessages((msgs as Message[]) ?? []);
      const { data: thread } = await supabase
        .from("chat_threads")
        .select("unread_for_user")
        .eq("id", tid)
        .single();
      setUnread(thread?.unread_for_user ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`chat:${threadId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => [...prev, m]);
        if (m.sender_role === "admin" && !open) setUnread((n) => n + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (open && threadId && unread > 0) {
      supabase.rpc("mark_thread_read", { _thread_id: threadId, _as_admin: false });
      setUnread(0);
    }
  }, [open, threadId, unread]);

  const send = async () => {
    if (!text.trim() || !threadId) return;
    const body = text.trim();
    setText("");
    await supabase.from("chat_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      sender_role: "user",
      body,
    });
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-2xl hover:scale-105 transition flex items-center justify-center"
          aria-label="Open support chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[calc(100vh-3rem)] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <div>
              <div className="font-semibold">Support</div>
              <div className="text-xs text-muted-foreground">Usually replies in minutes</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Send a message to start the conversation.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender_role === "user" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
                }`}>
                  {m.body}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-border flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
            <Button type="submit" size="icon" variant="hero"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      )}
    </>
  );
}
