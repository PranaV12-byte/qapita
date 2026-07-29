export type TreeNode = {
  id: string;
  pillar: number;
  slug: string;
  title: string;
  pillarSlug: string;
};

export type Pillar = {
  id: number;
  title: string;
  slug: string;
  nodes: TreeNode[];
};

export const PILLARS: Pillar[] = [
  {
    id: 1,
    title: "Award types & mechanics",
    slug: "awards",
    nodes: [
      { id: "1.1", pillar: 1, slug: "isos", title: "Incentive stock options (ISOs)", pillarSlug: "awards" },
      { id: "1.2", pillar: 1, slug: "nsos", title: "Non-qualified stock options (NSOs)", pillarSlug: "awards" },
      { id: "1.3", pillar: 1, slug: "rsus-rsas", title: "RSUs & RSAs", pillarSlug: "awards" },
      { id: "1.4", pillar: 1, slug: "espps", title: "Employee stock purchase plans (ESPPs)", pillarSlug: "awards" },
      { id: "1.5", pillar: 1, slug: "psus", title: "Performance share units (PSUs)", pillarSlug: "awards" },
      { id: "1.6", pillar: 1, slug: "sars-phantom", title: "SARs & phantom equity", pillarSlug: "awards" },
      { id: "1.7", pillar: 1, slug: "dividends", title: "Dividends & dividend equivalents", pillarSlug: "awards" },
    ],
  },
  {
    id: 2,
    title: "Equity lifecycle",
    slug: "lifecycle",
    nodes: [
      { id: "2.1", pillar: 2, slug: "grant-acceptance", title: "Grant & acceptance", pillarSlug: "lifecycle" },
      { id: "2.2", pillar: 2, slug: "vesting", title: "Vesting", pillarSlug: "lifecycle" },
      { id: "2.3", pillar: 2, slug: "exercise", title: "Exercise", pillarSlug: "lifecycle" },
      { id: "2.4", pillar: 2, slug: "settlement-release", title: "Settlement & release", pillarSlug: "lifecycle" },
      { id: "2.5", pillar: 2, slug: "liquidity-exits", title: "Liquidity & exits", pillarSlug: "lifecycle" },
    ],
  },
  {
    id: 3,
    title: "Tax & withholding",
    slug: "tax",
    nodes: [
      { id: "3.1", pillar: 3, slug: "option-taxation", title: "Option taxation (ISO/NSO, AMT)", pillarSlug: "tax" },
      { id: "3.2", pillar: 3, slug: "rsu-espp-tax", title: "RSU & ESPP tax", pillarSlug: "tax" },
      { id: "3.3", pillar: 3, slug: "cap-gains-83b", title: "Capital gains, holding periods & 83(b)", pillarSlug: "tax" },
      { id: "3.4", pillar: 3, slug: "payroll-withholding", title: "Payroll & withholding mechanics", pillarSlug: "tax" },
      { id: "3.5", pillar: 3, slug: "multistate-mobility", title: "Multistate & mobility", pillarSlug: "tax" },
      { id: "3.6", pillar: 3, slug: "cost-basis-reporting", title: "Cost basis & reporting", pillarSlug: "tax" },
      { id: "3.7", pillar: 3, slug: "section-409a", title: "Section 409A deferred compensation", pillarSlug: "tax" },
      { id: "3.8", pillar: 3, slug: "280g-golden-parachute", title: "280G golden parachute", pillarSlug: "tax" },
    ],
  },
  {
    id: 4,
    title: "Equity accounting (ASC 718)",
    slug: "accounting",
    nodes: [
      { id: "4.1", pillar: 4, slug: "grant-date-fv", title: "Grant-date fair value", pillarSlug: "accounting" },
      { id: "4.2", pillar: 4, slug: "expense-forfeitures", title: "Expense recognition & forfeitures", pillarSlug: "accounting" },
      { id: "4.3", pillar: 4, slug: "modifications", title: "Modifications", pillarSlug: "accounting" },
      { id: "4.4", pillar: 4, slug: "eps-dilution", title: "EPS & dilution", pillarSlug: "accounting" },
    ],
  },
  {
    id: 5,
    title: "Securities law",
    slug: "securities-law",
    nodes: [
      { id: "5.1", pillar: 5, slug: "sec-rule701-s8", title: "SEC registration, Rule 701 & Form S-8", pillarSlug: "securities-law" },
      { id: "5.2", pillar: 5, slug: "section-16", title: "Section 16 & Forms 3/4/5", pillarSlug: "securities-law" },
      { id: "5.3", pillar: 5, slug: "10b5-1-blackouts", title: "10b5-1 plans & blackout windows", pillarSlug: "securities-law" },
      { id: "5.4", pillar: 5, slug: "proxy-exec-comp", title: "Proxy & executive compensation", pillarSlug: "securities-law" },
      { id: "5.5", pillar: 5, slug: "10k-10q", title: "10-K / 10-Q equity disclosures", pillarSlug: "securities-law" },
      { id: "5.6", pillar: 5, slug: "year-end-filings", title: "Year-end IRS filings (W-2, 3921, 3922)", pillarSlug: "securities-law" },
      { id: "5.7", pillar: 5, slug: "rule-144", title: "Rule 144 & resale restrictions", pillarSlug: "securities-law" },
    ],
  },
  {
    id: 6,
    title: "Plan design",
    slug: "plan-design",
    nodes: [
      { id: "6.1", pillar: 6, slug: "design-pool-sizing", title: "Plan design & share pool sizing", pillarSlug: "plan-design" },
      { id: "6.2", pillar: 6, slug: "share-reserve-limits", title: "Share reserve & award limits", pillarSlug: "plan-design" },
      { id: "6.3", pillar: 6, slug: "award-design-trends", title: "Award design trends", pillarSlug: "plan-design" },
      { id: "6.4", pillar: 6, slug: "benchmarking", title: "Benchmarking", pillarSlug: "plan-design" },
      { id: "6.5", pillar: 6, slug: "409a-valuations", title: "409A valuations & fair market value", pillarSlug: "plan-design" },
    ],
  },
  {
    id: 7,
    title: "Admin & operations",
    slug: "admin-ops",
    nodes: [
      { id: "7.1", pillar: 7, slug: "day-to-day-admin", title: "Day-to-day plan administration", pillarSlug: "admin-ops" },
      { id: "7.2", pillar: 7, slug: "participant-comms", title: "Participant communications", pillarSlug: "admin-ops" },
      { id: "7.3", pillar: 7, slug: "job-life-events", title: "Job & life events", pillarSlug: "admin-ops" },
      { id: "7.4", pillar: 7, slug: "advisor-broker", title: "Advisor & broker coordination", pillarSlug: "admin-ops" },
      { id: "7.5", pillar: 7, slug: "compliance-calendar", title: "Compliance calendar", pillarSlug: "admin-ops" },
    ],
  },
];

export const ALL_NODES: TreeNode[] = PILLARS.flatMap((p) => p.nodes);

// The visible Knowledge Tree mirrors the complete content taxonomy.
export const DISPLAY_PILLARS: Pillar[] = PILLARS;

export function getNode(id: string): TreeNode | undefined {
  return ALL_NODES.find((n) => n.id === id);
}

export function getPillar(slug: string): Pillar | undefined {
  return PILLARS.find((p) => p.slug === slug);
}
