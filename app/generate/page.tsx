import { Suspense } from "react";
import GenerateClient from "./client";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; nodeId?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="h-32 rounded-lg bg-[var(--surface-1)] animate-pulse" />
        </div>
      }
    >
      <GenerateClient
        initialQuery={params.q ?? ""}
        initialNodeId={params.nodeId}
      />
    </Suspense>
  );
}
