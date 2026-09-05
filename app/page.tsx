import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyCompanies } from "@/app/actions/team";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const companies = await listMyCompanies();
  if (companies && companies.length > 0) {
    redirect(`/${companies[0].slug}`);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <p className="text-sm text-[var(--muted)]">
        You don&apos;t have access to any company yet. Ask a founder or director to invite you.
      </p>
    </div>
  );
}
