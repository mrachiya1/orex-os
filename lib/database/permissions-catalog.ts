import "server-only";
import { createServerSupabaseClient } from "@/lib/database/server";

export interface CatalogPermission {
  key: string;
  label: string;
  category: string;
}

export async function listAllPermissions(): Promise<CatalogPermission[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("permissions").select("key, label, category").order("category");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRolePermissionKeys(roleId: string): Promise<Set<string>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permissions(key)")
    .eq("role_id", roleId);
  if (error) throw new Error(error.message);
  const keys = (data ?? []).map((r) => {
    const p = r.permissions as { key: string } | { key: string }[] | null;
    return Array.isArray(p) ? p[0]?.key : p?.key;
  });
  return new Set(keys.filter(Boolean) as string[]);
}
