import type { Citation, RetrievalChunk } from "../rag/types";
import {
  buildQuickShare,
  compressMarkdownToCharacterLimit,
  composeWikiAnswer,
  type EvidenceProfile,
} from "./answer-composer";
import { PARTIAL_CONTENT_GAP_MESSAGE } from "./query-batch";
import { titleFromQuery } from "./title";
import type { ArtifactResult } from "./types";
import type { QueryIntent } from "./query-intent";

export type AnswerPart = {
  query: string;
  intent: QueryIntent;
  profile?: EvidenceProfile;
  chunks: RetrievalChunk[];
  citations: Citation[];
};

export type BatchComposition = ArtifactResult & {
  answerAvailable: boolean;
  supportedPartCount: number;
};

function partTitle(part: AnswerPart): string {
  if (part.intent.kind === "definition") return part.intent.title;
  return titleFromQuery(part.query);
}

function uniqueCitations(parts: AnswerPart[]): Citation[] {
  const seen = new Set<string>();
  return parts.flatMap((part) => part.citations).filter((citation) => {
    const key = `${citation.kind ?? "topic"}:${citation.sourceId ?? citation.nodeId ?? citation.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Builds one answer in input order for every independently grounded question.
 * There is no editorial word budget here; the shared character compressor is
 * used only after all complete sections have been assembled. */
export function composeBatchAnswer(parts: AnswerPart[]): BatchComposition {
  const blocks: string[] = [];
  let supportedPartCount = 0;

  parts.forEach((part) => {
    const composed = part.chunks.length
      ? composeWikiAnswer(part.query, part.chunks, part.intent, {
        profile: part.profile,
        includeOpeningHeading: false,
      })
      : null;
    const title = partTitle(part);
    if (!composed) {
      blocks.push(`## ${title}\n\n${PARTIAL_CONTENT_GAP_MESSAGE}`);
      return;
    }
    supportedPartCount += 1;
    blocks.push(`## ${title}\n\n${composed.bodyMarkdown}`);
  });

  const bodyMarkdown = compressMarkdownToCharacterLimit(blocks.join("\n\n"), {
    query: parts.map((part) => part.query).join(" "),
    requiredHeadingKeys: parts.map(partTitle),
  });
  const citations = uniqueCitations(parts.filter((part) => part.chunks.length > 0));
  return {
    title: "Answers to your equity compensation questions",
    bodyMarkdown,
    quickShare: buildQuickShare(bodyMarkdown),
    citations,
    answerAvailable: supportedPartCount > 0,
    supportedPartCount,
  };
}
