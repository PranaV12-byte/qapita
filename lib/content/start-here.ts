/**
 * Start Here - six orientation cards for people new to equity compensation.
 * Each links to the most relevant article node. Rendered in forced Plain lens.
 */
export type StartHereCard = {
  slug: string;
  title: string;
  blurb: string;
  nodeId: string;
};

export const START_HERE_CARDS: StartHereCard[] = [
  {
    slug: "what-is-equity-comp",
    title: "What is equity compensation?",
    blurb:
      "Equity compensation gives you a stake in your employer's stock instead of, or on top of, cash. The main forms are stock options, restricted stock units (RSUs), and employee stock purchase plans.",
    nodeId: "1.3",
  },
  {
    slug: "vesting-basics",
    title: "How vesting works",
    blurb:
      "You usually earn your equity over time. Vesting is the schedule that decides when awards become truly yours - often over four years with a one-year cliff.",
    nodeId: "2.2",
  },
  {
    slug: "options-vs-rsus",
    title: "Options vs. RSUs",
    blurb:
      "Options let you buy shares at a set price; RSUs give you shares outright as they vest. They work, and are taxed, very differently.",
    nodeId: "1.1",
  },
  {
    slug: "when-am-i-taxed",
    title: "When am I taxed?",
    blurb:
      "The moment tax applies depends on the award. RSUs are generally taxed at vesting, while options can trigger tax at exercise or sale. Knowing the timing helps you avoid surprises.",
    nodeId: "3.2",
  },
  {
    slug: "exercising-options",
    title: "Exercising your options",
    blurb:
      "Exercising means buying your shares at the strike price. There are several ways to pay for it, and each has different cash and tax consequences.",
    nodeId: "2.3",
  },
  {
    slug: "selling-and-liquidity",
    title: "Selling shares & liquidity",
    blurb:
      "Turning equity into cash depends on whether your company is public or private, and on rules like blackout windows and lock-ups.",
    nodeId: "2.5",
  },
];
