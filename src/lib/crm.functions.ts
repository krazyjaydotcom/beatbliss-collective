import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProspectStage = "new_lead" | "contacted" | "qualified" | "client" | "archived";

export type Prospect = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  stage: ProspectStage;
  source: string;
  notes: string;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  title: string;
  details: string;
  due_date: string | null;
  status: "open" | "done";
  prospect_id: string | null;
  customer_email: string | null;
  completed_at: string | null;
  created_at: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const adminListCrm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ prospects: Prospect[]; tasks: Task[] }> => {
    await assertAdmin(context as any);
    const sb = (context as any).supabase;
    const [p, t] = await Promise.all([
      sb.from("crm_prospects").select("*").order("updated_at", { ascending: false }).limit(2000),
      sb.from("crm_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(2000),
    ]);
    if (p.error) throw new Error(p.error.message);
    if (t.error) throw new Error(t.error.message);
    return { prospects: (p.data ?? []) as Prospect[], tasks: (t.data ?? []) as Task[] };
  });

export type ProspectInput = {
  id?: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  stage?: ProspectStage;
  source?: string;
  notes?: string;
  next_follow_up_at?: string | null;
};

export const adminSaveProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ProspectInput) => {
    if (!data || typeof data !== "object") throw new Error("Invalid input");
    if (!data.id && !data.email && !data.name) throw new Error("Name or email is required");
    return data;
  })
  .handler(async ({ data, context }): Promise<Prospect> => {
    await assertAdmin(context as any);
    const sb = (context as any).supabase;

    const payload: Record<string, unknown> = {};
    if (data.email !== undefined) payload.email = data.email ? data.email.trim().toLowerCase() : null;
    if (data.name !== undefined) payload.name = data.name?.trim() || null;
    if (data.phone !== undefined) payload.phone = data.phone?.trim() || null;
    if (data.stage !== undefined) payload.stage = data.stage;
    if (data.source !== undefined) payload.source = data.source;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.next_follow_up_at !== undefined) payload.next_follow_up_at = data.next_follow_up_at || null;

    if (data.id) {
      const { data: row, error } = await sb
        .from("crm_prospects").update(payload).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row as Prospect;
    }

    // Reuse an existing prospect record for the same email instead of duplicating.
    const email = (payload.email as string | null) ?? null;
    if (email) {
      const { data: existing } = await sb
        .from("crm_prospects").select("id").ilike("email", email).limit(1).maybeSingle();
      if (existing?.id) {
        const { data: row, error } = await sb
          .from("crm_prospects").update(payload).eq("id", existing.id).select("*").single();
        if (error) throw new Error(error.message);
        return row as Prospect;
      }
    }

    payload.created_by = (context as any).userId;
    const { data: row, error } = await sb.from("crm_prospects").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row as Prospect;
  });

export type TaskInput = {
  id?: string;
  title?: string;
  details?: string;
  due_date?: string | null;
  status?: "open" | "done";
  prospect_id?: string | null;
  customer_email?: string | null;
};

export const adminSaveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TaskInput) => {
    if (!data || typeof data !== "object") throw new Error("Invalid input");
    if (!data.id && !data.title?.trim()) throw new Error("Title is required");
    return data;
  })
  .handler(async ({ data, context }): Promise<Task> => {
    await assertAdmin(context as any);
    const sb = (context as any).supabase;

    const payload: Record<string, unknown> = {};
    if (data.title !== undefined) payload.title = data.title.trim();
    if (data.details !== undefined) payload.details = data.details;
    if (data.due_date !== undefined) payload.due_date = data.due_date || null;
    if (data.prospect_id !== undefined) payload.prospect_id = data.prospect_id || null;
    if (data.customer_email !== undefined) {
      payload.customer_email = data.customer_email ? data.customer_email.trim().toLowerCase() : null;
    }
    if (data.status !== undefined) {
      payload.status = data.status;
      payload.completed_at = data.status === "done" ? new Date().toISOString() : null;
    }

    if (data.id) {
      const { data: row, error } = await sb
        .from("crm_tasks").update(payload).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row as Task;
    }

    payload.created_by = (context as any).userId;
    const { data: row, error } = await sb.from("crm_tasks").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row as Task;
  });

export const adminDeleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("id required");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context as any);
    const { error } = await (context as any).supabase.from("crm_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
