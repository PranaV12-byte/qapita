import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ── Pure function tests ───────────────────────────────────────────────────────

import {
  DEFAULT_PLACEHOLDER,
  getNodePlaceholder,
  isSubmitDisabled,
  getCopyLabel,
  validateEmail,
} from "@/lib/generate-utils";

describe("isSubmitDisabled", () => {
  it("returns true when query is empty", () => {
    expect(isSubmitDisabled("", false)).toBe(true);
  });

  it("returns true when query is only whitespace", () => {
    expect(isSubmitDisabled("   ", false)).toBe(true);
  });

  it("returns true when loading=true regardless of query", () => {
    expect(isSubmitDisabled("some query", true)).toBe(true);
  });

  it("returns false when query has content and not loading", () => {
    expect(isSubmitDisabled("vest question", false)).toBe(false);
  });
});

describe("getCopyLabel", () => {
  it("returns 'Copy text' when not copied", () => {
    expect(getCopyLabel(false)).toBe("Copy text");
  });

  it("returns 'Copied ✓' when copied", () => {
    expect(getCopyLabel(true)).toBe("Copied ✓");
  });
});

describe("validateEmail", () => {
  it("returns true for valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("returns false for missing @", () => {
    expect(validateEmail("notanemail")).toBe(false);
  });

  it("returns false for missing domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(validateEmail("")).toBe(false);
  });
});

describe("getNodePlaceholder", () => {
  it("returns a question referencing the node title", () => {
    expect(getNodePlaceholder("RSU Vesting")).toBe(
      "What do you need to explain about RSU Vesting?"
    );
  });
});

describe("DEFAULT_PLACEHOLDER", () => {
  it("contains the spec-required example text", () => {
    expect(DEFAULT_PLACEHOLDER).toContain("taxes were withheld at vest");
  });
});

// ── Source file checks ────────────────────────────────────────────────────────

const root = path.resolve(__dirname, "..");

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

describe("GenerateClient source contains required strings", () => {
  const src = readSrc("app/generate/client.tsx");

  it("has 'use client'", () => {
    expect(src).toContain('"use client"');
  });

  it("shows fallback notice with spec wording", () => {
    expect(src).toContain("couldn");
    expect(src).toContain("confidently answer");
  });

  it("shows error heading 'Something went wrong'", () => {
    expect(src).toContain("Something went wrong");
  });

  it("shows empty-submit hint", () => {
    expect(src).toContain("Please describe what you need help with.");
  });

  it("imports ScenarioChips", () => {
    expect(src).toContain("ScenarioChips");
  });

  it("imports ArtifactResult", () => {
    expect(src).toContain("ArtifactResult");
  });

  it("has two loading stages", () => {
    expect(src).toContain("Searching the knowledge base");
    expect(src).toContain("Drafting your answer");
  });

  it("handles offline scenario", () => {
    expect(src).toContain("offline");
    expect(src).toContain("navigator.onLine");
  });
});

describe("ArtifactResult source contains required strings", () => {
  const src = readSrc("components/ArtifactResult.tsx");

  it("has 'use client'", () => {
    expect(src).toContain('"use client"');
  });

  it("has three tab labels: Text, PDF, Quick-share", () => {
    expect(src).toContain('"Text"');
    expect(src).toContain('"PDF"');
    expect(src).toContain("Quick-share");
  });

  it("has copy button using getCopyLabel", () => {
    expect(src).toContain("getCopyLabel");
  });

  it("has 'Based on' citation label", () => {
    expect(src).toContain("Based on");
  });

  it("has 'Open PDF' button", () => {
    expect(src).toContain("Open PDF");
  });

  it("has email action", () => {
    expect(src).toContain("Email this");
  });

  it("has 'no email sent' success message", () => {
    expect(src).toContain("no email sent");
  });

  it("has min-h-[44px] tap targets", () => {
    expect(src).toContain("min-h-[44px]");
  });

  it("has 16px font size on email input", () => {
    expect(src).toContain('fontSize: "16px"');
  });
});

describe("GeneratePage source", () => {
  const src = readSrc("app/generate/page.tsx");

  it("awaits searchParams", () => {
    expect(src).toContain("await searchParams");
  });

  it("wraps in Suspense", () => {
    expect(src).toContain("Suspense");
  });

  it("passes initialQuery and initialNodeId to GenerateClient", () => {
    expect(src).toContain("initialQuery");
    expect(src).toContain("initialNodeId");
  });
});

describe("ScenarioChips source", () => {
  const src = readSrc("components/ScenarioChips.tsx");

  it("has 'use client'", () => {
    expect(src).toContain('"use client"');
  });

  it("imports SCENARIOS", () => {
    expect(src).toContain("SCENARIOS");
  });

  it("has disabled prop handling", () => {
    expect(src).toContain("disabled");
  });

  it("has min-h-[44px] tap target", () => {
    expect(src).toContain("min-h-[44px]");
  });
});
