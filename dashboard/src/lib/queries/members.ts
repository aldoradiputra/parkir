import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function listMembers(
  locationId: string,
  opts?: { search?: string; active?: boolean }
) {
  let query = supabase
    .from("members")
    .select("*")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false });

  if (opts?.search) {
    query = query.or(
      `name.ilike.%${opts.search}%,plate.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`
    );
  }
  if (opts?.active !== undefined) {
    query = query.eq("active", opts.active);
  }

  return query;
}

export async function getMember(memberId: string) {
  return supabase.from("members").select("*").eq("id", memberId).single();
}

export async function createMember(data: {
  location_id: string;
  plate: string;
  vehicle_type: string;
  name: string;
  phone: string;
  valid_from: string;
  valid_until: string;
}) {
  return supabase.from("members").insert(data).select().single();
}

export async function updateMember(
  memberId: string,
  data: Partial<{ active: boolean; valid_until: string; name: string; phone: string }>
) {
  return supabase.from("members").update(data).eq("id", memberId).select().single();
}

export async function deactivateMember(memberId: string) {
  return updateMember(memberId, { active: false });
}
