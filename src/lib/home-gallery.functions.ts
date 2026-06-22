import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type GalleryImage = {
  id: string;
  image_url: string;
  alt: string | null;
  sort_order: number;
  transition: string;
};

let _client: ReturnType<typeof createClient<Database>> | null = null;
function publicClient() {
  if (!_client) {
    _client = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
  }
  return _client;
}

export const listHomeGalleryImages = createServerFn({ method: "GET" }).handler(
  async (): Promise<GalleryImage[]> => {
    const supabase = publicClient();
    const { data, error } = await (supabase as any)
      .from("home_gallery_images")
      .select("id,image_url,alt,sort_order,transition")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return data as GalleryImage[];
  },
);
