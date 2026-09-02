"use client";

import { useState } from "react";
import type { Article } from "@/lib/content/schema";

export default function FaqAccordion({ faqs }: { faqs: Article["faqs"] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!faqs.length) return null;

  return (
    <section className="v9-faq-section mt-8">
      <h2 className="v9-faq-title font-head text-heading text-xl mb-3">
        Frequently asked
      </h2>
      <div className="v9-faq-list divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="v9-faq-row">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="v9-faq-question flex w-full items-center gap-3 py-3 text-left min-h-[44px]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="v9-faq-chevron shrink-0 text-[var(--text-muted)]"
                  style={{
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 150ms",
                  }}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                <span className="v9-faq-question-text text-[var(--text-primary)] font-medium">
                  {f.q}
                </span>
              </button>
              {isOpen && (
                <p className="v9-faq-answer pb-4 pl-[26px] text-[var(--text-body)] leading-relaxed">
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
