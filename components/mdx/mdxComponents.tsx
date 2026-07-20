import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import Advanced from "./Advanced";

/**
 * Component map for article MDX bodies. Styles the standard markdown
 * elements to the dark theme and wires in the <Advanced> lens-aware block.
 */
export const mdxComponents: MDXRemoteProps["components"] = {
  Advanced,
  h1: (props) => (
    <h1
      className="font-serif text-heading text-2xl mt-8 mb-3 first:mt-0"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="font-serif text-heading text-xl mt-7 mb-2 first:mt-0"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="text-[var(--text-head)] text-base font-semibold mt-5 mb-1.5"
      {...props}
    />
  ),
  p: (props) => (
    <p className="text-[var(--text-body)] leading-relaxed mb-4" {...props} />
  ),
  ul: (props) => (
    <ul
      className="list-disc pl-5 mb-4 space-y-1 text-[var(--text-body)]"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="list-decimal pl-5 mb-4 space-y-1 text-[var(--text-body)]"
      {...props}
    />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => (
    <strong className="text-[var(--text-primary)] font-semibold" {...props} />
  ),
  em: (props) => <em className="italic" {...props} />,
  a: (props) => (
    <a
      className="text-[var(--accent)] hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="border-l-2 border-[var(--border-strong)] pl-4 italic text-[var(--text-muted)] mb-4"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-sm text-[var(--text-primary)]"
      {...props}
    />
  ),
  hr: () => <hr className="my-6 border-[var(--border)]" />,
};
