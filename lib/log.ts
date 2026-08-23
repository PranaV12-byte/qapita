import fs from "node:fs";
import path from "node:path";

export type LogData = {
  mode?: string;
  query?: string;
  scenarioId?: string;
  matchedNodeIds?: string[];
  format?: string;
  deliveredVia?: string;
  emailTo?: string;
  fallbackUsed?: boolean;
};

function getLogPath(): string {
  return (
    process.env.ARTIFACT_LOG_PATH ??
    path.join(process.cwd(), "data", "artifact-log.jsonl")
  );
}

export async function logArtifact(
  data: LogData
): Promise<{ logged: boolean }> {
  try {
    const entry = JSON.stringify({ ts: new Date().toISOString(), ...data });
    if (process.env.VERCEL || process.env.NETLIFY) {
      console.log(entry);
      return { logged: true };
    }
    fs.appendFileSync(getLogPath(), entry + "\n");
    return { logged: true };
  } catch {
    return { logged: false };
  }
}
