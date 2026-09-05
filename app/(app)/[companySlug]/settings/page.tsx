import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { requireCurrentUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/database/server";
import { getMyPrivateProfile } from "@/app/actions/people";
import { PageHeader } from "@/components/ui/Surface";
import { WorkProfileCard } from "@/components/people/WorkProfileCard";
import { PrivateProfileCard } from "@/components/people/PrivateProfileCard";
import { ConnectionsCard } from "@/components/people/ConnectionsCard";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const user = await requireCurrentUser();
  const supabase = await createServerSupabaseClient();

  const [{ data: profile }, privateProfile] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, display_name, email, job_title, department, timezone, skills")
      .eq("id", user.id)
      .maybeSingle(),
    getMyPrivateProfile(),
  ]);

  if (!profile) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Settings" description="Your personal profile, privacy, and connections." />
      <div className="grid grid-cols-1 gap-3.5 p-8 pt-6 lg:grid-cols-2">
        <WorkProfileCard
          profile={{
            userId: profile.id,
            displayName: profile.display_name,
            fullName: profile.full_name,
            email: profile.email,
            jobTitle: profile.job_title,
            department: profile.department,
            timezone: profile.timezone,
            skills: profile.skills ?? [],
          }}
          isSelf
        />
        <PrivateProfileCard initial={privateProfile} />
        <ConnectionsCard />
      </div>
    </div>
  );
}
