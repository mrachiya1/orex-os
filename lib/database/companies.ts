import "server-only";
import { createServerSupabaseClient } from "@/lib/database/server";

export async function getCompanyBySlug(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, organisation_id, accent_color_key")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
