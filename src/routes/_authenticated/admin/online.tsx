import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/online")({
  component: OnlineUsers,
});

interface Presence {
  user_id: string;
  email?: string;
  path: string;
  online_at: string;
}

function OnlineUsers() {
  const [users, setUsers] = useState<Presence[]>([]);

  useEffect(() => {
    // The site-presence channel is already subscribed by the auth layout's
    // broadcaster. Reuse it and poll its presence state instead of attaching
    // another `on('presence', 'sync')` listener (which Supabase forbids
    // after subscribe()).
    const channel = supabase.channel("site-presence");

    const refresh = () => {
      const state = channel.presenceState<Presence>();
      const flat = Object.values(state).flat();
      const map = new Map<string, Presence>();
      flat.forEach((p) => { if (p.user_id) map.set(p.user_id, p); });
      setUsers(Array.from(map.values()));
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => { clearInterval(interval); };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Online Users</h1>
        <p className="text-muted-foreground mt-1">Real-time list of users currently on the site</p>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Circle className="h-2 w-2 fill-accent text-accent" />
          <span className="text-sm font-medium">{users.length} online</span>
        </div>
        {users.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No users currently online.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3 font-medium">User</th>
                <th className="text-left px-5 py-3 font-medium">Current page</th>
                <th className="text-left px-5 py-3 font-medium">Online since</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Circle className="h-2 w-2 fill-accent text-accent" />
                      {u.email ?? u.user_id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.path}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(u.online_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
