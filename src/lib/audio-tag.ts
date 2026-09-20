import { supabase } from "@/integrations/supabase/client";

/**
 * The producer's audio tag ("voice stamp"). One shared settings row drives both
 * the storefront preview overlay and the tagged export in admin.
 */
export type AudioTagSettings = {
  tagUrl: string | null;
  isEnabled: boolean;
  intervalSeconds: number;
  startOffsetSeconds: number;
  volume: number;
};

export const AUDIO_TAG_DEFAULTS: AudioTagSettings = {
  tagUrl: null,
  isEnabled: false,
  intervalSeconds: 40,
  startOffsetSeconds: 10,
  volume: 0.7,
};

export async function fetchAudioTagSettings(): Promise<AudioTagSettings> {
  const { data, error } = await (supabase as any)
    .from("audio_tag_settings")
    .select("tag_url,is_enabled,interval_seconds,start_offset_seconds,volume")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return AUDIO_TAG_DEFAULTS;
  return {
    tagUrl: data.tag_url ?? null,
    isEnabled: Boolean(data.is_enabled),
    intervalSeconds: Math.max(5, Number(data.interval_seconds) || 40),
    startOffsetSeconds: Math.max(0, Number(data.start_offset_seconds) || 0),
    volume: Math.min(1, Math.max(0, Number(data.volume) || 0.7)),
  };
}
