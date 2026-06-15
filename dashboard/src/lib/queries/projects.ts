import { createClient } from "@/lib/supabase/client";
import type { ProjectStatus } from "@/types";

const supabase = createClient();

export async function listProjects(opts?: {
  search?: string;
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from("projects")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts?.search) {
    query = query.or(
      `facility_name.ilike.%${opts.search}%,contact_name.ilike.%${opts.search}%,city.ilike.%${opts.search}%`
    );
  }
  if (opts?.status) {
    query = query.eq("status", opts.status);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }
  if (opts?.offset) {
    query = query.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  }

  return query;
}

export async function getProject(projectId: string) {
  return supabase.from("projects").select("*").eq("id", projectId).single();
}

export async function updateProject(
  projectId: string,
  data: Partial<{
    status: ProjectStatus;
    start_date: string;
    target_live: string;
    actual_live: string;
    notes: string;
  }>
) {
  return supabase
    .from("projects")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select()
    .single();
}

export async function deleteProject(projectId: string) {
  return supabase.from("projects").delete().eq("id", projectId);
}
