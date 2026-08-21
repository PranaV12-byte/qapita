import Link from "next/link";
import { DISPLAY_PILLARS } from "@/lib/content/tree";

const suggestions = [
  "Explain an RSU vesting event to employees in clear language.",
  "Prepare an update about changes to our stock option plan.",
  "Draft a professional note about tax withholding for an exercise.",
];

export default function HomePage() {
  return <div className="v9-page v9-home">
    <section className="v9-home-hero">
      <div className="v9-home-copy">
        <span className="v9-endorsement"><i /> Endorsed by NASPP</span>
        <h1>The equity answers you need,<br />backed by NASPP.</h1>
        <p>Clear stock plan guidance and employee-ready communications, built for the teams who run equity programs.</p>
      </div>
    </section>
    <section className="v9-home-prompt-wrap">
      <form action="/generate" method="get" className="v9-home-prompt">
        <label htmlFor="home-question">What do you need to communicate?</label>
        <div className="v9-home-input-row"><textarea id="home-question" name="q" rows={2} placeholder="Describe the stock plan situation or employee communication you need to prepare..." /><button type="submit">Ask EquityIQ <span aria-hidden="true">→</span></button></div>
      </form>
      <div className="v9-suggestion-row">{suggestions.map((suggestion) => <Link key={suggestion} href={`/generate?q=${encodeURIComponent(suggestion)}`}>{suggestion}</Link>)}</div>
    </section>
    <section className="v9-home-next">
      <div><p className="v9-eyebrow">Start where you are</p><h2>Move from question to clear next step.</h2></div>
      <div className="v9-home-choices">
        <Link href="/generate" className="v9-choice-card"><span className="v9-choice-icon">↗</span><div><h3>Ask a question</h3><p>Describe the situation and prepare a professional first draft.</p><strong>Prepare a draft →</strong></div></Link>
        <Link href="/browse" className="v9-choice-card"><span className="v9-choice-icon">⌘</span><div><h3>Learn a topic</h3><p>Browse practical guidance across the EquityIQ Knowledge Tree.</p><strong>Explore the Knowledge Tree →</strong></div></Link>
      </div>
    </section>
    <section className="v9-home-library">
      <div className="v9-home-library-head"><div><p className="v9-eyebrow">Knowledge Tree</p><h2>Explore the topics behind the work.</h2></div><Link href="/browse">View all topics →</Link></div>
      <div className="v9-pillar-preview">{DISPLAY_PILLARS.slice(0, 6).map((pillar) => <Link key={pillar.id} href={`/p/${pillar.slug}`}><small>{String(pillar.id).padStart(2, "0")}</small><strong>{pillar.title}</strong><span>{pillar.nodes.length} topics</span></Link>)}</div>
    </section>
  </div>;
}
