import { Suspense } from "react";
import GenerateClient from "./client";
import PreparingAnswer from "@/components/generate/PreparingAnswer";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; nodeId?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={<div className="v9-ask-wrap"><PreparingAnswer /></div>}
    >
      <GenerateClient
        initialQuery={params.q ?? ""}
        initialNodeId={params.nodeId}
      />
    </Suspense>
  );
}
