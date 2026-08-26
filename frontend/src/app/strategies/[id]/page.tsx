import StrategyReviewContent from "@/components/strategies/strategy-review-content";

export default function StrategyReviewPage({ params }: { params: { id: string } }) {
  return <StrategyReviewContent id={params.id} />;
}
