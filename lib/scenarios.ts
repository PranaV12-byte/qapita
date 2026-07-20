export type Scenario = {
  id: string;
  label: string;
  keywords: string[];
  nodeIds: string[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: "rsu-vesting-tax",
    label: "How RSU vesting and tax withholding work",
    keywords: [
      "RSU",
      "restricted stock unit",
      "vesting",
      "tax withholding",
      "ordinary income",
      "W-2",
      "supplemental rate",
    ],
    nodeIds: ["1.3", "3.2", "3.4"],
  },
  {
    id: "iso-exercise-amt",
    label: "ISO exercise decisions and AMT impact",
    keywords: [
      "ISO",
      "incentive stock option",
      "exercise",
      "alternative minimum tax",
      "AMT",
      "preference item",
      "minimum tax credit",
    ],
    nodeIds: ["1.1", "3.1", "3.3"],
  },
  {
    id: "espp-enrollment",
    label: "ESPP enrollment explained for new hires",
    keywords: [
      "ESPP",
      "employee stock purchase plan",
      "enrollment",
      "offering period",
      "payroll deduction",
      "discount",
      "lookback",
    ],
    nodeIds: ["1.4", "3.2"],
  },
  {
    id: "double-trigger-ipo",
    label: "Double-trigger RSU vesting at IPO",
    keywords: [
      "double trigger",
      "RSU",
      "IPO",
      "liquidity event",
      "vesting",
      "delivery",
      "tax withholding",
    ],
    nodeIds: ["1.3", "2.5"],
  },
  {
    id: "post-termination",
    label: "What happens to your equity when you leave",
    keywords: [
      "termination",
      "post-termination",
      "exercise window",
      "forfeiture",
      "unvested",
      "vested options",
      "separation",
    ],
    nodeIds: ["2.3", "7.3"],
  },
  {
    id: "10b5-1-blackouts",
    label: "Setting up a 10b5-1 plan and navigating blackout windows",
    keywords: [
      "10b5-1",
      "trading plan",
      "blackout window",
      "insider trading",
      "cooling-off period",
      "MNPI",
      "SEC rule",
    ],
    nodeIds: ["5.3", "5.2"],
  },
  {
    id: "83b-election",
    label: "Filing an 83(b) election: deadline and process",
    keywords: [
      "83(b)",
      "election",
      "restricted stock",
      "30-day deadline",
      "IRS filing",
      "capital gains",
      "early exercise",
    ],
    nodeIds: ["1.3", "3.3"],
  },
  {
    id: "year-end-reporting",
    label: "Year-end equity reporting checklist (W-2, 3921, 3922)",
    keywords: [
      "W-2",
      "Form 3921",
      "Form 3922",
      "year-end",
      "IRS reporting",
      "ISO exercise",
      "ESPP purchase",
      "payroll reporting",
    ],
    nodeIds: ["5.6", "3.6"],
  },
];
