import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function listLanes(locationId: string) {
  return supabase
    .from("lanes")
    .select("*")
    .eq("location_id", locationId)
    .order("name");
}

export async function getLane(laneId: string) {
  return supabase.from("lanes").select("*").eq("id", laneId).single();
}
