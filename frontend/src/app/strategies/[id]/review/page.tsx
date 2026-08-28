import AdvisoryPolicyReviewContent from "@/components/strategies/advisory-policy-review-content";

export default function StrategyReviewPage({ params }: { params: { id: string } }) {
  return <AdvisoryPolicyReviewContent id={params.id} />;
}
