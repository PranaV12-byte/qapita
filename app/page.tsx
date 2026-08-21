import Link from "next/link";

export default function HomePage() {
  return <div className="v9-page v9-home">
    <section className="v9-home-hero">
      <div className="v9-home-copy">
        <h1>The equity answers you need,<br /><span>backed by NASPP.</span></h1>
        <p>Ask anything about equity compensation and get a real answer, sourced and ready to share.</p>
      </div>
    </section>
    <section className="v9-home-prompt-wrap">
      <form action="/generate" method="get" className="v9-home-prompt">
        <label htmlFor="home-question">What are you working on?</label>
        <div className="v9-home-input-row"><input id="home-question" name="q" placeholder="What are you working on?" /><button type="submit">Ask EquityIQ <span aria-hidden="true">→</span></button></div>
      </form>
    </section>
    <section className="v9-home-next">
      <div><p className="v9-eyebrow">Start here</p><h2>Get the answer you need, then keep moving.</h2></div>
      <div className="v9-home-choices">
        <Link href="/generate" className="v9-choice-card"><span className="v9-choice-icon">↗</span><div><h3>Ask a question</h3><p>Tell us what you&apos;re dealing with. Get an answer you can send to someone.</p><strong>ISO vs NSO · W-2 cost basis · Acquisition</strong></div></Link>
        <Link href="/browse" className="v9-choice-card"><span className="v9-choice-icon">⌘</span><div><h3>Learn a topic</h3><p>Award types, tax rules, compliance, and more. Browse and read at your pace.</p><strong>ISOs · RSUs & RSAs · Multi-state taxation · ESPPs</strong></div></Link>
      </div>
    </section>
  </div>;
}
