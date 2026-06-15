import { createClient } from "@/lib/supabase/client";
import type { Session } from "@/types";

const supabase = createClient();

export async function listSessions(
  locationId: string,
  opts?: { limit?: number; offset?: number; plate?: string; status?: string }
) {
  let query = supabase
    .from("parking_sessions")
    .select("*", { count: "exact" })
    .eq("location_id", locationId)
    .order("entry_time", { ascending: false });

  if (opts?.plate) {
    query = query.ilike("plate", `%${opts.plate}%`);
  }
  if (opts?.status) {
    query = query.eq("payment_status", opts.status);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }
  if (opts?.offset) {
    query = query.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  }

  return query;
}

export async function getSession(sessionId: string) {
  return supabase
    .from("parking_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
}

export async function getActiveSessions(locationId: string) {
  return supabase
    .from("parking_sessions")
    .select("*")
    .eq("location_id", locationId)
    .eq("session_status", "active")
    .order("entry_time", { ascending: false });
}

export async function getTodayRevenue(locationId: string) {
  const today = new Date().toISOString().split("T")[0];
  return supabase
    .from("parking_sessions")
    .select("fee_paid, payment_method")
    .eq("location_id", locationId)
    .gte("exit_time", `${today}T00:00:00`)
    .eq("payment_status", "paid");
}
