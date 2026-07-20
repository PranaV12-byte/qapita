import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), "utf-8");
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(root, relPath));
}

// 1. CSS tokens exist in globals.css
describe("globals.css CSS tokens", () => {
  const css = readFile("app/globals.css");

  const tokens: [string, string][] = [
    ["--bg", "#0A0A0B"],
    ["--surface-1", "#1A1A1F"],
    ["--surface-2", "#24242B"],
    ["--border", "#3A3A44"],
    ["--border-strong", "#55555F"],
    ["--text-head", "#F0EEE8"],
    ["--text-primary", "#D4D4DA"],
    ["--text-body", "#B6B6BE"],
    ["--text-muted", "#9A9AA5"],
    ["--accent", "#5FAE9E"],
    ["--accent-solid", "#357A69"],
    ["--accent-on", "#EAF3F0"],
    ["--accent-line", "#4E9E8C"],
    ["--draft", "#D6A85C"],
    ["--certified", "#7FB972"],
    ["--danger", "#D97070"],
  ];

  tokens.forEach(([token, value]) => {
    it(`contains ${token}: ${value}`, () => {
      expect(css).toContain(`${token}: ${value}`);
    });
  });
});

// 2. Tailwind config maps tokens
describe("tailwind.config.ts maps CSS variable tokens", () => {
  it("references CSS variables in theme extension", () => {
    const tw = readFile("tailwind.config.ts");
    expect(tw).toContain("var(--bg)");
    expect(tw).toContain("var(--surface-1)");
    expect(tw).toContain("var(--surface-2)");
    expect(tw).toContain("var(--accent)");
    expect(tw).toContain("var(--text-head)");
    expect(tw).toContain("var(--text-body)");
    expect(tw).toContain("var(--draft)");
  });

  it("has colors/backgroundColor/textColor extensions", () => {
    const tw = readFile("tailwind.config.ts");
    expect(tw).toContain("colors");
    expect(tw).toContain("backgroundColor");
    expect(tw).toContain("textColor");
  });
});

// 3. .env.example exists and contains all required vars
describe(".env.example", () => {
  it("exists", () => {
    expect(fileExists(".env.example")).toBe(true);
  });

  const required = [
    "LLM_PROVIDER",
    "GROQ_API_KEY",
    "ANTHROPIC_API_KEY",
    "RETRIEVAL_FALLBACK_THRESHOLD",
    "MOCK_DELAY",
    "NEXT_PUBLIC_SITE_URL",
  ];

  const envContent = readFile(".env.example");
  required.forEach((key) => {
    it(`contains ${key}`, () => {
      expect(envContent).toContain(key);
    });
  });
});

// 4. noindex meta tag
describe("app/layout.tsx", () => {
  const layout = readFile("app/layout.tsx");

  it('contains <meta name="robots" content="noindex">', () => {
    expect(layout).toContain('noindex');
  });
});

// 5. DraftStrip contains exact microcopy
describe("DraftStrip component", () => {
  it("contains exact draft strip microcopy", () => {
    const strip = readFile("components/DraftStrip.tsx");
    expect(strip).toContain(
      "Draft — AI-generated, not reviewed · Educational only, not advice"
    );
  });
});

// 6. Footer disclaimer exact text
describe("Footer disclaimer", () => {
  it("layout.tsx contains the exact footer disclaimer text", () => {
    const layout = readFile("app/layout.tsx");
    expect(layout).toContain(
      "This is an AI-generated draft that has not been reviewed by a professional."
    );
    expect(layout).toContain(
      "It is educational only and is not tax, legal, or investment advice. US only."
    );
  });
});

// 7. All route files exist
describe("Route files exist", () => {
  const routes = [
    "app/page.tsx",
    "app/browse/page.tsx",
    "app/generate/page.tsx",
    "app/glossary/page.tsx",
    "app/search/page.tsx",
    "app/start-here/page.tsx",
    "app/legal/disclaimer/page.tsx",
    "app/p/[pillar]/page.tsx",
    "app/a/[pillar]/[slug]/page.tsx",
    "app/glossary/[term]/page.tsx",
  ];

  routes.forEach((route) => {
    it(`${route} exists`, () => {
      expect(fileExists(route)).toBe(true);
    });
  });
});

// 8. NASPP appears ONLY in the authorized co-brand lockup (CLAUDE.md rule #6)
describe("NASPP marks confined to the brand lockup", () => {
  function getAllTsxFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next") {
        results.push(...getAllTsxFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  // The one sanctioned location for the NASPP mark.
  const ALLOWED = path.normalize("components/brand/Logos.tsx");

  it("no .tsx outside components/brand/Logos.tsx contains 'NASPP'", () => {
    const appFiles = getAllTsxFiles(path.join(root, "app"));
    const compFiles = getAllTsxFiles(path.join(root, "components"));
    const allFiles = [...appFiles, ...compFiles];

    const hits: string[] = [];
    for (const file of allFiles) {
      const rel = path.relative(root, file);
      if (path.normalize(rel) === ALLOWED) continue;
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("NASPP")) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

  it("the brand lockup does carry the NASPP mark", () => {
    expect(readFile("components/brand/Logos.tsx")).toContain("NASPP");
  });
});
