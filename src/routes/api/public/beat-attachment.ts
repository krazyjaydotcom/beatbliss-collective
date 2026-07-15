import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/beat-attachment")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return new Response("Missing id", { status: 400 });

        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data: row } = await sb
          .from("beat_landing_attachments")
          .select("storage_path,filename,mime_type")
          .eq("id", id)
          .maybeSingle();
        if (!row) return new Response("Not found", { status: 404 });
        const meta = row as { storage_path: string; filename: string; mime_type: string | null };

        const { data: file, error } = await sb.storage.from("beat-attachments").download(meta.storage_path);
        if (error || !file) return new Response("File not found", { status: 404 });

        const buf = await file.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": meta.mime_type || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${meta.filename.replace(/"/g, "")}"`,
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
