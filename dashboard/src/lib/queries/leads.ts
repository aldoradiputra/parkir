import { createClient } from "@/lib/supabase/client";
import type { LeadStatus, LeadSource } from "@/types";

const supabase = createClient();

export async function listLeads(opts?: {
  search?: string;
  status?: LeadStatus;
  source?: LeadSource;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts?.search) {
    query = query.or(
      `name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,facility_name.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`
    );
  }
  if (opts?.status) {
    query = query.eq("status", opts.status);
  }
  if (opts?.source) {
    query = query.eq("source", opts.source);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }
  if (opts?.offset) {
    query = query.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  }

  return query;
}

export async function getLead(leadId: string) {
  return supabase.from("leads").select("*").eq("id", leadId).single();
}

export async function createLead(data: {
  name: string;
  email: string;
  phone: string;
  facility_name: string;
  source?: LeadSource;
}) {
  return supabase
    .from("leads")
    .insert({ ...data, status: "new", source: data.source ?? "landing_page" })
    .select()
    .single();
}

export async function updateLead(
  leadId: string,
  data: Partial<{
    status: LeadStatus;
    notes: string;
    city: string;
    address: string;
    latitude: number;
    longitude: number;
    entry_lanes: number;
    exit_lanes: number;
    current_system: string;
    daily_volume: number;
    preferred_date: string;
    onboarded_at: string;
  }>
) {
  return supabase
    .from("leads")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select()
    .single();
}

export async function deleteLead(leadId: string) {
  return supabase.from("leads").delete().eq("id", leadId);
}

export async function convertLeadToProject(leadId: string) {
  const { data: lead, error } = await getLead(leadId);
  if (error || !lead) throw new Error("Lead not found");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      lead_id: leadId,
      facility_name: lead.facility_name,
      contact_name: lead.name,
      contact_email: lead.email,
      contact_phone: lead.phone,
      city: lead.city,
      address: lead.address,
      latitude: lead.latitude,
      longitude: lead.longitude,
      entry_lanes: lead.entry_lanes ?? 1,
      exit_lanes: lead.exit_lanes ?? 1,
      status: "planning",
    })
    .select()
    .single();

  if (projectError) throw projectError;

  await supabase
    .from("leads")
    .update({
      status: "converted",
      converted_at: new Date().toISOString(),
      project_id: project.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  return project;
}
