import ExecutionDetailContent from "@/components/executions/execution-detail-content";

export default function ExecutionDetailPage({ params }: { params: { id: string } }) {
  return <ExecutionDetailContent id={params.id} />;
}
