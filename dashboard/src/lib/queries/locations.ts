import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function listLocations() {
  return supabase
    .from("locations")
    .select("*")
    .eq("active", true)
    .order("name");
}

export async function getLocation(locationId: string) {
  return supabase.from("locations").select("*").eq("id", locationId).single();
}

export async function listPublicLocations() {
  return supabase
    .from("locations")
    .select("id, name, latitude, longitude, city")
    .eq("active", true);
}
