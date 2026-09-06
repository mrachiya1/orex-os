import { redirect } from "next/navigation";

/** Back-compat only (prompts/015 Decisions #13) -- history now lives in the in-page drawer. */
export default async function SessionsRedirectPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  redirect(`/${companySlug}/intelligence`);
}
