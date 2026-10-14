import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

export function BeatCreditTerms({ beatId, children }: { beatId: string; children: ReactNode }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["beat-credit-terms", beatId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_beat_credit_terms", { _beat_id: beatId });
      if (error) throw error;
      return data as string | null;
    },
  });
  if (isPending) return <p role="status" className="text-xs">Loading producer credit terms…</p>;
  if (error) return <p role="alert" className="text-xs">Producer credit terms could not be loaded. Refresh before purchasing.</p>;
  if (!data) return <>{children}</>;
  return <div className="whitespace-pre-wrap break-words rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">{data}</div>;
}
