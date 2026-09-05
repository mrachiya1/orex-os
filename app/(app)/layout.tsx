import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Pure auth gate. The Orex OS app shell (sidebar, company switcher) needs
 * the active company slug to build company-scoped nav links, so it renders
 * one level down in `[companySlug]/layout.tsx` rather than here — this
 * layout's only job is "no session, no access to anything under (app)".
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return <>{children}</>;
}
