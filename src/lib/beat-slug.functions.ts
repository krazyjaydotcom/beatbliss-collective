import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { slugifyTitle } from "./slug";

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

export const getBeatIdBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ beatId: string | null }> => {
    const supabase = adminClient();
    const { data: rows } = await supabase
      .from("beats")
      .select("id, title, created_at")
      .eq("is_active", true);
    if (!rows) return { beatId: null };
    const target = data.slug.toLowerCase();
    const matches = (rows as Array<{ id: string; title: string; created_at: string }>).filter(
      (r) => slugifyTitle(r.title) === target,
    );
    if (matches.length === 0) return { beatId: null };
    // If multiple beats slugify the same, prefer newest.
    matches.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { beatId: matches[0].id };
  });
