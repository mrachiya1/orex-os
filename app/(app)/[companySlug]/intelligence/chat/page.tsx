import { redirect } from "next/navigation";

/** Back-compat only (prompts/015 Decisions #13) -- normal navigation never links here anymore. */
export default async function ChatRedirectPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  redirect(`/${companySlug}/intelligence`);
}
