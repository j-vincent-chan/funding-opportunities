import { notFound } from "next/navigation";
import { FundingOpportunityDetailPageClient } from "@/components/funding/funding-opportunity-detail-page-client";
import { loadFundingOpportunityPeek } from "@/lib/funding-opportunities/funding-opportunity-peek";
import { createClient } from "@/lib/supabase/server";

export default async function FundingOpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await loadFundingOpportunityPeek(supabase, params.id);
  if (!data) notFound();

  return <FundingOpportunityDetailPageClient data={data} loggedIn={!!user} />;
}
