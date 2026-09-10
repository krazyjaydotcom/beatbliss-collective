import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { adminDeleteTask, adminListCrm, adminSaveTask, type Task } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, PageHeader, Surface } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/tasks")({
  head: () => ({ meta: [{ title: "Admin · Tasks — MYBEATCATALOG" }] }),
  component: AdminTasksPage,
});

const FILTERS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const today = () => new Date().toISOString().slice(0, 10);

function AdminTasksPage() {
  const qc = useQueryClient();
  const fetchCrm = useServerFn(adminListCrm);
  const saveTask = useServerFn(adminSaveTask);
  const deleteTask = useServerFn(adminDeleteTask);

  const [filter, setFilter] = useState<FilterKey>("today");
  const [editing, setEditing] = useState<Partial<Task> | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["admin-crm"], queryFn: () => fetchCrm() });
  const tasks = data?.tasks ?? [];
  const prospects = data?.prospects ?? [];

  const save = useMutation({
    mutationFn: (input: Parameters<typeof adminSaveTask>[0]) => saveTask(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crm"] });
      toast.success("Task saved");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save the task"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crm"] });
      toast.success("Task removed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove the task"),
  });

  const filtered = useMemo(() => {
    const t = today();
    return tasks.filter((x) => {
      if (filter === "completed") return x.status === "done";
      if (x.status === "done") return filter === "all";
      if (filter === "today") return x.due_date === t;
      if (filter === "overdue") return !!x.due_date && x.due_date < t;
      if (filter === "upcoming") return !x.due_date || x.due_date > t;
      return true;
    });
  }, [tasks, filter]);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Workspace"
        title="Tasks"
        description="Personal follow-ups, optionally linked to a customer."
        actions={
          <Button size="sm" onClick={() => setEditing({ due_date: today(), status: "open" })}>
            <Plus className="mr-1.5 h-4 w-4" /> New task
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-semibold transition",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="Tasks you add show up under the matching filter."
          action={
            <Button size="sm" className="mt-2" onClick={() => setEditing({ due_date: today(), status: "open" })}>
              Create a task
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const overdue = t.status === "open" && !!t.due_date && t.due_date < today();
            return (
              <Surface key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3">
                <Checkbox
                  checked={t.status === "done"}
                  aria-label="Mark complete"
                  className="h-5 w-5"
                  onCheckedChange={(v) =>
                    save.mutate({ data: { id: t.id, status: v ? "done" : "open" } })
                  }
                />
                <button className="min-w-0 text-left" onClick={() => setEditing(t)}>
                  <div className={cn("truncate text-sm font-medium", t.status === "done" && "text-muted-foreground line-through")}>
                    {t.title}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.due_date ? <span className={overdue ? "text-destructive" : ""}>Due {t.due_date}</span> : "No due date"}
                    {t.customer_email ? ` · ${t.customer_email}` : ""}
                  </div>
                </button>
                <Button size="icon" variant="ghost" aria-label="Delete task" onClick={() => remove.mutate(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Surface>
            );
          })}
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/60 p-4">
            <SheetTitle>{editing?.id ? "Edit task" : "New task"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-base">
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Title</Label>
              <Input
                id="t-title"
                className="text-base"
                value={editing?.title ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-due">Due date</Label>
              <Input
                id="t-due"
                type="date"
                className="text-base"
                value={editing?.due_date ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-cust">Customer email (optional)</Label>
              <Input
                id="t-cust"
                className="text-base"
                list="crm-prospect-emails"
                value={editing?.customer_email ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, customer_email: e.target.value }))}
              />
              <datalist id="crm-prospect-emails">
                {prospects.filter((p) => p.email).map((p) => (
                  <option key={p.id} value={p.email!} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-details">Details</Label>
              <Textarea
                id="t-details"
                rows={5}
                className="text-base"
                value={editing?.details ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, details: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 border-t border-border/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={save.isPending || !editing?.title?.trim()}
              onClick={() =>
                save.mutate({
                  data: {
                    id: editing?.id,
                    title: editing?.title ?? "",
                    details: editing?.details ?? "",
                    due_date: editing?.due_date ?? null,
                    customer_email: editing?.customer_email ?? null,
                  },
                })
              }
            >
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
