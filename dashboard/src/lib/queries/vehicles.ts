import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function linkPlateToPhone(plate: string, phone: string) {
  const plateNormalized = plate.replace(/\s+/g, "").toUpperCase();

  return supabase
    .from("vehicles")
    .upsert(
      {
        plate,
        plate_normalized: plateNormalized,
        phone,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "plate_normalized" }
    )
    .select()
    .single();
}

export async function getVehicleByPlate(plate: string) {
  const plateNormalized = plate.replace(/\s+/g, "").toUpperCase();

  return supabase
    .from("vehicles")
    .select("*")
    .eq("plate_normalized", plateNormalized)
    .single();
}
