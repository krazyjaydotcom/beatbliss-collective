import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared admin design-system primitives: restrained charcoal surfaces, crisp type. */

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border/60 pb-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && (
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {breadcrumb}
          </div>
        )}
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground break-words sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Surface({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-card/60", className)}>{children}</div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-4 pb-2">
      <h2 className="min-w-0 truncate text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export const STAGE_LABELS: Record<string, string> = {
  new_lead: "New lead",
  contacted: "Contacted",
  qualified: "Qualified",
  client: "Client",
  archived: "Archived",
};

export function StageChip({ stage }: { stage: string }) {
  const tone =
    stage === "client"
      ? "bg-primary/15 text-primary border-primary/30"
      : stage === "qualified"
        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
        : stage === "archived"
          ? "bg-muted text-muted-foreground border-border"
          : "bg-secondary text-secondary-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", tone)}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}
