import CampaignsContent from "@/components/campaigns/campaigns-content";

export default function CampaignDetailsPage({ params }: { params: { id: string } }) {
  return <CampaignsContent campaignId={params.id} />;
}
