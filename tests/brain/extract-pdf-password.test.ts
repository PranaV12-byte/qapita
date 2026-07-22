// Isolated from extract.test.ts on purpose: vi.mock("unpdf", ...) is
// file-scoped but applies to every dynamic import("unpdf") in this file's
// module graph, which would also stub out the real PDF fixtures' tests if
// they shared a file. SPEC-BRAIN.md Phase 0 explicitly deferred generating a
// real password-protected PDF (hand-rolling PDF encryption was judged too
// high-risk to get subtly right) and flagged this simulated-error approach
// as the Phase 2 follow-through — this file is that follow-through.
import { describe, it, expect, vi } from "vitest";

vi.mock("unpdf", async () => {
  const actual = await vi.importActual<typeof import("unpdf")>("unpdf");
  return {
    ...actual,
    getDocumentProxy: vi.fn(async () => {
      const err = new Error("No password given");
      err.name = "PasswordException";
      throw err;
    }),
  };
});

describe("extractDocument: password-protected PDF (simulated pdf.js PasswordException)", () => {
  it("maps a password-required error to the password_protected code", async () => {
    const { extractDocument } = await import("@/lib/brain/extract");
    const result = await extractDocument("secret.pdf", Buffer.from("%PDF-1.4 fake"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("password_protected");
      expect(result.message).toMatch(/password/i);
    }
  });
});
