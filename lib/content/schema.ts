import { z } from "zod";

export const ArticleSchema = z.object({
  id: z.string().regex(/^\d+\.\d+$/, "Article id must use the legacy dotted numeric format."),
  pillar: z.number().int().min(1).max(9),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Article slug must be lowercase kebab-case."),
  title: z.string(),
  status: z.enum(["generated", "signed_off"]),
  audience: z.array(z.enum(["admin", "participant"])),
  summaryPlain: z.string(),
  sources: z.array(
    z.object({
      label: z.string(),
      url: z.string().url().optional(),
    })
  ),
  reviewedBy: z.string().nullable(),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  updatedAt: z.string(),
  related: z.array(z.string()),
});

export type Article = z.infer<typeof ArticleSchema>;
