import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: AdminImportPage,
});

const SOURCE_URL = "https://cfvvxvohecqviflbwoxl.supabase.co/rest/v1/beats?select=*&is_published=eq.true&order=display_order.desc";
const SOURCE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdnZ4dm9oZWNxdmlmbGJ3b3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDk5MjgsImV4cCI6MjA3NTkyNTkyOH0.2-3a92Z4exx1yutIQ6kfleS8FU6mZlhPJvx1wEE3WQ4";

function parseLengthToSeconds(len: string | null): number {
  if (!len) return 0;
  const parts = len.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(len) || 0;
}

function AdminImportPage() {
  const [beats, setBeats] = useState<any[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, skipped: 0, errors: 0 });

  async function fetchSource() {
    setFetching(true);
    try {
      const res = await fetch(SOURCE_URL, { headers: { apikey: SOURCE_KEY } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBeats(data);
      toast.success(`Found ${data.length} beats`);
    } catch (e: any) { toast.error(e.message); }
    finally { setFetching(false); }
  }

  async function importAll() {
    if (!beats) return;
    setImporting(true);
    let done = 0, skipped = 0, errors = 0;
    setProgress({ done: 0, total: beats.length, skipped: 0, errors: 0 });
    for (const b of beats) {
      const { error } = await supabase.rpc("admin_import_beat", {
        _title: b.title,
        _genre: b.type ?? "Unknown",
        _mood: "Unknown",
        _bpm: parseInt(b.tempo) || 0,
        _music_key: "C",
        _duration_seconds: parseLengthToSeconds(b.length),
        _audio_url: b.audio_url,
        _cover_url: b.cover_image_url,
        _producer_name: b.artist || "KRAZYJAY",
      });
      if (error) errors++; else done++;
      setProgress({ done, total: beats.length, skipped, errors });
    }
    setImporting(false);
    toast.success(`Imported ${done} beats (${errors} errors)`);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Import beats</h1>
        <p className="text-muted-foreground mt-1">Pull your existing catalog from Ultimate Beat Store</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          This connects to your old Supabase project and copies all published beats here.
          Audio &amp; cover URLs stay hosted on the original storage (still publicly accessible).
          Beats with duplicate audio URLs are skipped automatically.
        </p>
        <div className="flex gap-3">
          <Button onClick={fetchSource} disabled={fetching || importing} variant="outline">
            {fetching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Fetching…</> : <><Download className="h-4 w-4 mr-2" />Fetch list</>}
          </Button>
          {beats && (
            <Button onClick={importAll} disabled={importing}>
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing {progress.done}/{progress.total}…</> : `Import all ${beats.length} beats`}
            </Button>
          )}
        </div>
        {progress.total > 0 && progress.done === progress.total && !importing && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" /> Imported {progress.done} · {progress.errors} errors
          </div>
        )}
      </div>

      {beats && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Preview ({beats.length})</h2>
          <div className="divide-y divide-border max-h-[480px] overflow-auto">
            {beats.map((b: any) => (
              <div key={b.id} className="py-3 flex items-center gap-4">
                {b.cover_image_url && <img src={b.cover_image_url} className="h-10 w-10 rounded object-cover" alt="" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{b.title}</div>
                  <div className="text-xs text-muted-foreground">{b.type} · {b.tempo} BPM · {b.length}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
