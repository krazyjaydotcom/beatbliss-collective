import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { adminListCustomerActivity, type ActivityRow } from "@/lib/admin-activity.functions";
import { adminListCrm, adminSaveProspect, adminSaveTask, type Prospect, type ProspectStage } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, PageHeader, StageChip, StatTile, Surface, STAGE_LABELS } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({ meta: [{ title: "Admin · Customers & Leads — MYBEATCATALOG" }] }),
  component: AdminCustomersPage,
});

type Contact = {
  key: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  stage: ProspectStage;
  source: string;
  notes: string;
  nextFollowUp: string | null;
  prospectId: string | null;
  purchases: number;
  downloads: number;
  spendCents: number;
  lastActivity: string | null;
  activity: ActivityRow[];
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const norm = (e?: string | null) => (e ? e.trim().toLowerCase() : "");

function buildContacts(rows: ActivityRow[], prospects: Prospect[]): Contact[] {
  const map = new Map<string, Contact>();

  const ensure = (key: string, seed: Partial<Contact>): Contact => {
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        email: null,
        name: null,
        phone: null,
        stage: "new_lead",
        source: "activity",
        notes: "",
        nextFollowUp: null,
        prospectId: null,
        purchases: 0,
        downloads: 0,
        spendCents: 0,
        lastActivity: null,
        activity: [],
      };
      map.set(key, c);
    }
    Object.assign(c, { ...seed, ...{} });
    return c;
  };

  for (const r of rows) {
    const key = norm(r.email) || `row:${r.id}`;
    const c = ensure(key, {});
    if (!c.email && r.email) c.email = r.email;
    if (!c.name && r.name) c.name = r.name;
    c.activity.push(r);
    if (r.kind === "purchase") {
      if (r.paid) {
        c.purchases += 1;
        c.spendCents += r.amount_cents ?? 0;
      }
    } else {
      c.downloads += 1;
    }
    if (!c.lastActivity || r.created_at > c.lastActivity) c.lastActivity = r.created_at;
  }

  for (const p of prospects) {
    const key = norm(p.email) || `prospect:${p.id}`;
    const c = ensure(key, {});
    c.prospectId = p.id;
    c.email = c.email ?? p.email;
    c.name = p.name ?? c.name;
    c.phone = p.phone;
    c.stage = p.stage;
    c.source = p.source;
    c.notes = p.notes;
    c.nextFollowUp = p.next_follow_up_at;
  }

  // Contacts with confirmed purchases and no manual stage are clients.
  for (const c of map.values()) {
    if (!c.prospectId && c.purchases > 0) c.stage = "client";
  }

  return [...map.values()].sort((a, b) => ((a.lastActivity ?? "") < (b.lastActivity ?? "") ? 1 : -1));
}

function AdminCustomersPage({
  initialEmail,
  embedded = false,
  onClose,
}: { initialEmail?: string; embedded?: boolean; onClose?: () => void } = {}) {
  const qc = useQueryClient();
  const fetchActivity = useServerFn(adminListCustomerActivity);
  const fetchCrm = useServerFn(adminListCrm);
  const saveProspect = useServerFn(adminSaveProspect);
  const saveTask = useServerFn(adminSaveTask);
  const [layout, setLayout] = useState("list");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const openedEmail = useRef("");
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState<{ name: string; email: string; phone: string; source: string; notes: string }>({
    name: "",
    email: "",
    phone: "",
    source: "manual",
    notes: "",
  });
  const [edit, setEdit] = useState<{ stage: ProspectStage; notes: string; next: string } | null>(null);

  const activityQ = useQuery({ queryKey: ["admin-customer-activity"], queryFn: () => fetchActivity() });
  const crmQ = useQuery({ queryKey: ["admin-crm"], queryFn: () => fetchCrm() });

  const contacts = useMemo(
    () => buildContacts(activityQ.data?.rows ?? [], crmQ.data?.prospects ?? []),
    [activityQ.data, crmQ.data],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (stage !== "all" && c.stage !== stage) return false;
      if (!s) return true;
      return (c.name ?? "").toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s);
    });
  }, [contacts, q, stage]);

  const selected = contacts.find((c) => c.key === openKey) ?? null;

  const save = useMutation({
    mutationFn: (input: Parameters<typeof adminSaveProspect>[0]) => saveProspect(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crm"] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const openDetail = (c: Contact) => {
    setOpenKey(c.key);
    setEdit({ stage: c.stage, notes: c.notes, next: c.nextFollowUp ?? "" });
  };

  useEffect(() => {
    if (!initialEmail || openedEmail.current === initialEmail || activityQ.isLoading || crmQ.isLoading) return;
    openedEmail.current = initialEmail;
    const contact = contacts.find((c) => norm(c.email) === norm(initialEmail));
    if (contact) openDetail(contact);
  }, [initialEmail, contacts, activityQ.isLoading, crmQ.isLoading]);
  const followUp = useMutation({
    mutationFn: () =>
      saveTask({
        data: {
          title: followUpTitle.trim() || "Follow up with " + (selected?.name ?? selected?.email ?? "customer"),
          customer_email: selected?.email,
          prospect_id: selected?.prospectId,
          due_date: edit?.next || localToday(),
          status: "open",
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-crm"] });
      setFollowUpTitle("");
      toast.success("Follow-up added to Tasks");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const loading = activityQ.isLoading || crmQ.isLoading;
  const clients = contacts.filter((c) => c.stage === "client").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!embedded && (
        <>
          <PageHeader
            breadcrumb="Workspace"
            title="Customers & leads"
            description="Everyone who bought or downloaded, plus prospects you add yourself."
            actions={
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add prospect
              </Button>
            }
          />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Contacts" value={contacts.length} />
            <StatTile label="Clients" value={clients} />
            <StatTile label="Manual prospects" value={crmQ.data?.prospects.length ?? 0} />
            <StatTile
              label="Follow-ups due"
              value={
                (crmQ.data?.prospects ?? []).filter((p) => p.next_follow_up_at && p.next_follow_up_at <= localToday())
                  .length
              }
            />
          </div>

          <div className="flex shrink-0 gap-2">
            {["list", "board"].map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={layout === mode ? "default" : "outline"}
                aria-pressed={layout === mode}
                onClick={() => setLayout(mode)}
              >
                {mode === "list" ? "List" : "Board"}
              </Button>
            ))}
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or email…"
                className="h-11 pl-9 text-base"
              />
            </div>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-11 text-base">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No contacts match" description="Try a different search, or add a prospect by hand." />
          ) : layout === "board" ? (
            <div
              className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-auto pb-2"
              aria-label="Customer pipeline"
            >
              {Object.entries(STAGE_LABELS).map(([key, label]) => (
                <section key={key} className="w-64 shrink-0 snap-start rounded-xl border border-border bg-card p-3">
                  <h2 className="mb-3 font-semibold">
                    {label}{" "}
                    <span className="text-muted-foreground">{filtered.filter((c) => c.stage === key).length}</span>
                  </h2>
                  <div className="space-y-2">
                    {filtered
                      .filter((c) => c.stage === key)
                      .map((c) => (
                        <button
                          key={c.key}
                          onClick={() => openDetail(c)}
                          className="w-full rounded-lg border border-border bg-background p-3 text-left"
                        >
                          <div className="truncate text-sm font-medium">{c.name ?? c.email ?? "Unknown customer"}</div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">{c.email}</div>
                          <div className="mt-2 text-xs">
                            {c.nextFollowUp ? "Follow up " + c.nextFollowUp : "Set next action"}
                          </div>
                        </button>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {filtered.map((c) => (
                <Surface key={c.key} className="p-0">
                  <button
                    onClick={() => openDetail(c)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{c.name ?? c.email ?? "Unknown"}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.email ?? "No email on file"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.nextFollowUp ? "Next follow-up: " + c.nextFollowUp : "No follow-up scheduled"}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StageChip stage={c.stage} />
                        <span className="text-[11px] text-muted-foreground">
                          {c.purchases} purchase{c.purchases === 1 ? "" : "s"} · {c.downloads} download
                          {c.downloads === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">{money(c.spendCents)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : "—"}
                      </div>
                    </div>
                  </button>
                </Surface>
              ))}
            </div>
          )}
        </>
      )}
      {embedded && !selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) onClose?.();
          }}
        >
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Customer</SheetTitle>
            </SheetHeader>
            <p className="p-4">{loading ? "Loading customer…" : "No customer activity found for " + initialEmail}</p>
          </SheetContent>
        </Sheet>
      )}
      {/* Detail panel */}
      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setOpenKey(null);
            setEdit(null);
            onClose?.();
          }
        }}
      >
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border/60 p-4">
            <SheetTitle className="truncate">{selected?.name ?? selected?.email ?? "Contact"}</SheetTitle>
          </SheetHeader>
          {selected && edit && (
            <>
              <div className="flex-1 space-y-5 overflow-y-auto p-4">
                <div className="space-y-1 text-sm">
                  <div className="text-muted-foreground">{selected.email ?? "No email on file"}</div>
                  {selected.phone && <div className="text-muted-foreground">{selected.phone}</div>}
                  <div className="text-muted-foreground">
                    {selected.purchases} paid purchase{selected.purchases === 1 ? "" : "s"} ·{" "}
                    {money(selected.spendCents)} total
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select value={edit.stage} onValueChange={(v) => setEdit({ ...edit, stage: v as ProspectStage })}>
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STAGE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-next">Next follow-up</Label>
                  <Input
                    id="c-next"
                    type="date"
                    className="h-11 text-base"
                    value={edit.next}
                    onChange={(e) => setEdit({ ...edit, next: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-notes">Notes</Label>
                  <Textarea
                    id="c-notes"
                    rows={5}
                    className="text-base"
                    value={edit.notes}
                    onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Activity
                  </h3>
                  {selected.activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recorded purchases or downloads.</p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {selected.activity.slice(0, 25).map((r) => (
                        <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate text-sm">{r.beat_title}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {r.kind === "purchase"
                                ? r.paid
                                  ? "Paid sale"
                                  : "Unpaid checkout"
                                : r.kind === "member_download"
                                  ? "Member download"
                                  : "Free download"}
                              {r.agreement_code ? ` · ${r.agreement_code}` : " · License not available"}
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <section className="space-y-3 rounded-lg border border-border p-3">
                  <h3 className="text-sm font-semibold">Linked tasks</h3>
                  {(crmQ.data?.tasks ?? [])
                    .filter(
                      (t) =>
                        (selected.prospectId && t.prospect_id === selected.prospectId) ||
                        (selected.email && norm(t.customer_email) === norm(selected.email)),
                    )
                    .map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>
                          {t.title}
                        </span>
                        <span>{t.status === "done" ? "Completed" : (t.due_date ?? "No due date")}</span>
                      </div>
                    ))}
                  <Label htmlFor="customer-followup-title">Next action</Label>
                  <Input
                    id="customer-followup-title"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                    placeholder="Send license options, call, review brief…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Uses the follow-up date above, or today. Customer is already linked.
                  </p>
                  <Button size="sm" disabled={followUp.isPending} onClick={() => followUp.mutate()}>
                    {followUp.isPending ? "Creating…" : "Schedule follow-up"}
                  </Button>
                </section>
              </div>
              <div className="flex gap-2 border-t border-border/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setOpenKey(null);
                    setEdit(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  className="flex-1"
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate({
                      data: {
                        id: selected.prospectId ?? undefined,
                        email: selected.email,
                        name: selected.name,
                        stage: edit.stage,
                        notes: edit.notes,
                        next_follow_up_at: edit.next || null,
                        source: selected.prospectId ? undefined : "activity",
                      },
                    })
                  }
                >
                  {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add prospect */}
      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/60 p-4">
            <SheetTitle>Add prospect</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {(["name", "email", "phone", "source"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`p-${field}`} className={cn("capitalize")}>
                  {field}
                </Label>
                <Input
                  id={`p-${field}`}
                  className="h-11 text-base"
                  value={draft[field]}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="p-notes">Notes</Label>
              <Textarea
                id="p-notes"
                rows={5}
                className="text-base"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 border-t border-border/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="outline" className="flex-1" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={save.isPending || (!draft.name.trim() && !draft.email.trim())}
              onClick={() =>
                save.mutate(
                  { data: { ...draft, source: draft.source || "manual", stage: "new_lead" } },
                  {
                    onSuccess: () => {
                      setNewOpen(false);
                      setDraft({ name: "", email: "", phone: "", source: "manual", notes: "" });
                    },
                  },
                )
              }
            >
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save prospect
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CustomerRecordDrawer({ email, onClose }: { email: string; onClose: () => void }) {
  return <AdminCustomersPage initialEmail={email} embedded onClose={onClose} />;
}
