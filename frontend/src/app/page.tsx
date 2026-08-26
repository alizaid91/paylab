import { PageHeader } from "@/components/layout/page-header";
import { ContentContainer } from "@/components/layout/content-container";

export default function HomePage() {
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Workspace"
        title="Welcome to PAYLAB"
        description="Your revenue optimization workspace is ready."
      />
      <div className="mt-8 rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
        Business modules will appear here as they are connected.
      </div>
    </ContentContainer>
  );
}
