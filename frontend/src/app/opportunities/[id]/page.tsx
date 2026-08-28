import { OpportunityDetailContent } from "@/components/opportunities/opportunity-detail-content";

export default function OpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <OpportunityDetailContent id={params.id} />;
}
