import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, GraduationCap, Play, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/classroom")({
  head: () => ({ meta: [{ title: "Classroom — MYBEATCATALOG" }] }),
  component: ClassroomPage,
});

function toEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes("youtube.com")) id = u.searchParams.get("v");
    else if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch { return null; }
}

function ClassroomPage() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_status, subscription_tier")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const isActive = !!(profile && (profile.subscription_status === "active" || (profile.subscription_tier && profile.subscription_tier !== "none")));
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    enabled: isActive,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeCourse = courses.find((c: any) => c.id === activeId) ?? courses[0] ?? null;

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-black">Members Only</h2>
        <p className="text-muted-foreground mt-2">
          The classroom is available exclusively to active Catalog Members. Upgrade your plan to get access.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Courses coming soon</h2>
        <p className="text-muted-foreground mt-2">Check back shortly — new content is on the way.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Members only</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Classroom</h1>
        <p className="text-muted-foreground mt-1">Private music marketing & production courses — just for you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Main video player */}
        <div className="space-y-4">
          {activeCourse && (
            <>
              <div className="aspect-video rounded-2xl overflow-hidden border border-border bg-black">
                {toEmbed(activeCourse.video_url) ? (
                  <iframe
                    src={toEmbed(activeCourse.video_url)!}
                    className="w-full h-full"
                    allowFullScreen
                    title={activeCourse.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Invalid video URL
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">{activeCourse.title}</h2>
                {activeCourse.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{activeCourse.description}</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Course list sidebar */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium px-1">
            All courses ({courses.length})
          </p>
          {courses.map((c: any, i: number) => {
            const isSelected = (activeId ? c.id === activeId : i === 0);
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors flex items-start gap-3 ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <Play className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : ""}`}>{c.title}</p>
                  {c.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
