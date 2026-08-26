import { describe, expect, it } from "vitest";
import { ArticleSchema } from "../lib/content/schema";

const validArticle = {
  id: "2.2",
  pillar: 2,
  slug: "vesting",
  title: "Vesting",
  status: "signed_off",
  audience: ["admin", "participant"],
  summaryPlain: "Vesting overview.",
  sources: [],
  reviewedBy: null,
  faqs: [],
  updatedAt: "2026-01-01",
  related: [],
};

describe("article content schema", () => {
  it("accepts canonical dotted IDs and lowercase kebab-case slugs", () => {
    expect(ArticleSchema.parse(validArticle).slug).toBe("vesting");
  });

  it.each(["Vesting", "bad/route", "bad route", "bad_route", "eyJmb28iOiJiYXIifQ"]) (
    "rejects unsafe slug %s",
    (slug) => {
      expect(() => ArticleSchema.parse({ ...validArticle, slug })).toThrow();
    }
  );

  it("rejects malformed article IDs", () => {
    expect(() => ArticleSchema.parse({ ...validArticle, id: "vesting" })).toThrow();
  });
});
