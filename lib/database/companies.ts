import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/database/server";

/**
 * React.cache() so the layout and every page under it (20+ call sites) share
 * one query per request instead of re-fetching the same row. Request-scoped
 * only -- never shared across requests or users.
 */
export const getCompanyBySlug = cache(async (slug: string) => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, organisation_id, accent_color_key")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});
