import ExecuteStrategyContent from "@/components/strategies/execute-strategy-content";

export default function ExecuteStrategyPage({ params }: { params: { id: string } }) {
  return <ExecuteStrategyContent id={params.id} />;
}
