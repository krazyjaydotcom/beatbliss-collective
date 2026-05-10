import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const PRESENCE_CHANNEL = "site-presence";

export function usePresenceBroadcast(user: User | null, path: string) {
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {});
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: user.id,
          email: user.email,
          path,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [user, path]);
}

export function usePresenceList() {
  return PRESENCE_CHANNEL;
}
