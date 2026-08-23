// Generated from index_v9_standalone.html. Run npm run extract:v9-taxonomy to refresh.
export type V9Leaf = { name: string };
export type V9Subtopic = { id: string; name: string; leaves: V9Leaf[]; comingSoon?: boolean };
export type V9Group = { id: string; name: string; icon: string; color: string; comingSoon?: boolean; subtopics: V9Subtopic[] };

export const V9_TAXONOMY: V9Group[] = [
  {
    "id": "v9-1",
    "name": "Equity Award Types",
    "icon": "ti-certificate",
    "color": "purple",
    "comingSoon": false,
    "subtopics": [
      {
        "id": "v9-1.1",
        "name": "Nonqualified Stock Options (NQSOs)",
        "leaves": [
          {
            "name": "What is a nonqualified stock option?"
          },
          {
            "name": "NQSOs: mechanics and plan design overview"
          },
          {
            "name": "Nonqualified stock options overview (NASPP-aligned)"
          },
          {
            "name": "Non-Qualified Stock Options (NSOs): complete guide"
          },
          {
            "name": "NQSO taxation: when and how"
          },
          {
            "name": "NQSOs vs ISOs: a comparison"
          },
          {
            "name": "Advanced NQSO tax topics"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.2",
        "name": "Incentive Stock Options (ISOs)",
        "leaves": [
          {
            "name": "What is an incentive stock option?"
          },
          {
            "name": "ISOs: mechanics and plan design overview"
          },
          {
            "name": "Incentive stock options overview (NASPP-aligned)"
          },
          {
            "name": "Incentive Stock Options (ISOs): complete guide"
          },
          {
            "name": "ISO taxation: qualifying vs disqualifying dispositions"
          },
          {
            "name": "AMT and ISOs"
          },
          {
            "name": "AMT and ISOs: advanced"
          },
          {
            "name": "ISO vs NQSO - plan design comparison"
          },
          {
            "name": "The $100K ISO limit rule"
          },
          {
            "name": "ISO advanced tax topics"
          },
          {
            "name": "Final ISO regulations: plan design impact"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.3",
        "name": "Restricted Stock & RSUs",
        "leaves": [
          {
            "name": "Restricted stock: mechanics and plan design"
          },
          {
            "name": "RSU tax 101: how RSUs are taxed"
          },
          {
            "name": "Restricted stock and unit plans overview (NASPP-aligned)"
          },
          {
            "name": "Restricted stock vs. RSUs: side-by-side comparison chart"
          },
          {
            "name": "RSU dividends and dividend equivalents: ten things to know"
          },
          {
            "name": "Restricted stock units (RSUs) explained"
          },
          {
            "name": "Why companies grant RSUs instead of options"
          },
          {
            "name": "RSU double-trigger vesting mechanics"
          },
          {
            "name": "Section 83(b) elections for restricted stock"
          },
          {
            "name": "Single-trigger vs. double-trigger RSUs"
          },
          {
            "name": "RSUs vs. stock options: which is better?"
          },
          {
            "name": "RSU settlement and delivery of shares"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.4",
        "name": "Restricted Stock Awards (RSAs)",
        "leaves": [
          {
            "name": "RSA vs RSU: key differences"
          },
          {
            "name": "RSA mechanics and 83(b) election timing"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.5",
        "name": "Performance Awards",
        "leaves": [
          {
            "name": "Performance shares: the basics"
          },
          {
            "name": "Performance stock units (PSUs) and awards (PSAs) explained"
          },
          {
            "name": "Performance awards under market uncertainty"
          },
          {
            "name": "ESG metrics in pay-for-performance awards"
          },
          {
            "name": "Section 162(m) and negative discretion in performance awards"
          },
          {
            "name": "Performance shares: grant structure and metrics"
          },
          {
            "name": "Performance shares: taxation and M&A treatment"
          },
          {
            "name": "Equity refresh grants"
          },
          {
            "name": "Performance awards: industry trends"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.6",
        "name": "Employee Stock Purchase Plans (ESPPs)",
        "leaves": [
          {
            "name": "What is an ESPP?"
          },
          {
            "name": "ESPP mechanics and plan design"
          },
          {
            "name": "Designing an employee stock purchase plan (NASPP-aligned)"
          },
          {
            "name": "Qualifying vs disqualifying dispositions in ESPPs"
          },
          {
            "name": "Guide to educating employees about ESPPs"
          },
          {
            "name": "Section 423 ESPP rules"
          },
          {
            "name": "The $25,000 ESPP limit: compliance and administration"
          },
          {
            "name": "ESPP advanced topics"
          },
          {
            "name": "ESPP plan design mastery: webinar"
          },
          {
            "name": "How prevalent are ESPPs? Podcast"
          },
          {
            "name": "Sample: explanation of the ESPP $25,000 limitation"
          },
          {
            "name": "Sample: purchase checklist for ESPP"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.7",
        "name": "SARs & Phantom Equity",
        "leaves": [
          {
            "name": "What are stock appreciation rights?"
          },
          {
            "name": "What is a phantom stock plan?"
          },
          {
            "name": "SARs: mechanics and plan design"
          },
          {
            "name": "SAR taxation"
          },
          {
            "name": "SARs vs. stock options: vesting, exercise, and tax treatment"
          },
          {
            "name": "SARs vs stock options: participant perspective"
          },
          {
            "name": "SARs: in-the-money vs. underwater, and settlement options"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.8",
        "name": "LLC Equity Instruments",
        "leaves": [
          {
            "name": "Profits interest units (PIUs): how they work"
          },
          {
            "name": "Phantom equity for LLCs"
          },
          {
            "name": "LLC membership interests as compensation"
          },
          {
            "name": "How LLC taxation works"
          },
          {
            "name": "Schedule K-1: equity compensation in partnerships and LLCs"
          },
          {
            "name": "C-Corp vs. LLC: what's the difference?"
          },
          {
            "name": "S-Corp vs. LLC: what's the difference?"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.9",
        "name": "Growth Shares (International)",
        "leaves": [
          {
            "name": "What are growth shares?"
          },
          {
            "name": "Growth share valuation and taxation"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-1.10",
        "name": "Advisory Shares & Warrants",
        "leaves": [
          {
            "name": "What is a stock warrant and how does it work?"
          },
          {
            "name": "Stock options vs. warrants"
          },
          {
            "name": "Advisory shares: a guide for startups"
          },
          {
            "name": "Preferred stock vs. common stock: what's the difference?"
          }
        ],
        "comingSoon": false
      }
    ]
  },
  {
    "id": "v9-2",
    "name": "Grant Lifecycle & Administration",
    "icon": "ti-calendar-event",
    "color": "green",
    "comingSoon": false,
    "subtopics": [
      {
        "id": "v9-2.1",
        "name": "Grant Approval & Documentation",
        "leaves": [
          {
            "name": "What is the process of granting equity awards?"
          },
          {
            "name": "How are grant dates and prices established?"
          },
          {
            "name": "Strike price: what it is and how it's set"
          },
          {
            "name": "How is exercise price determined?"
          },
          {
            "name": "Correcting missed or defective equity grants"
          },
          {
            "name": "Grant acceptance policies: design and enforcement"
          },
          {
            "name": "Translating award documents internationally"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-2.2",
        "name": "Vesting Schedules & Conditions",
        "leaves": [
          {
            "name": "What is a vesting schedule?"
          },
          {
            "name": "Vesting schedules, cliffs, and acceleration"
          },
          {
            "name": "Substantial risk of forfeiture: definition and implications"
          },
          {
            "name": "Rethinking four-year vesting schedules"
          },
          {
            "name": "Types of time-based vesting schedules"
          },
          {
            "name": "Vesting on leave of absence and sabbatical"
          },
          {
            "name": "Vesting acceleration on change-of-control"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-2.3",
        "name": "Exercise Mechanics",
        "leaves": [
          {
            "name": "Cashless exercise: mechanics and tax treatment"
          },
          {
            "name": "Stock swap exercise: mechanics and tax treatment"
          },
          {
            "name": "Exercising stock options: what it means and when to do it"
          },
          {
            "name": "Methods of option exercise"
          },
          {
            "name": "Sell-to-cover exercise"
          },
          {
            "name": "Early exercise of stock options"
          },
          {
            "name": "Cashless exercise: ISO and NSO tax implications"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-2.4",
        "name": "Sale, Settlement & Holding Periods",
        "leaves": [
          {
            "name": "Sale and settlement overview"
          },
          {
            "name": "ESPP holding period requirements"
          },
          {
            "name": "Capital gains rates and calculation"
          },
          {
            "name": "When should participants sell company stock?"
          },
          {
            "name": "ISO holding period requirements"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-2.5",
        "name": "Termination & Post-Employment",
        "leaves": [
          {
            "name": "Termination overview: job events"
          },
          {
            "name": "What happens to unvested options at termination?"
          },
          {
            "name": "Job loss and stock grants"
          },
          {
            "name": "Noncompete and clawback provisions in grant agreements"
          },
          {
            "name": "Accounting for vesting acceleration at termination"
          },
          {
            "name": "Post-termination exercise periods: common plan provisions"
          }
        ],
        "comingSoon": false
      }
    ]
  },
  {
    "id": "v9-3",
    "name": "Taxation",
    "icon": "ti-receipt-tax",
    "color": "amber",
    "comingSoon": false,
    "subtopics": [
      {
        "id": "v9-3.1",
        "name": "Federal Income Tax & Withholding",
        "leaves": [
          {
            "name": "US tax withholding for stock compensation (NASPP-aligned)"
          },
          {
            "name": "US tax reporting for stock compensation (NASPP-aligned)"
          },
          {
            "name": "How stock options are taxed: a complete guide"
          },
          {
            "name": "FICA withholding on RSUs: common errors and corrections"
          },
          {
            "name": "US tax withholding rates reference table"
          },
          {
            "name": "Excess tax withholding: what you need to know"
          },
          {
            "name": "When and how are NQSOs taxed?"
          },
          {
            "name": "W-2 reporting after NQSO exercise"
          },
          {
            "name": "W-2 reporting after RSU vesting"
          },
          {
            "name": "Tax withholding methods for equity awards"
          },
          {
            "name": "ISO tax planning: dispositions and AMT exposure"
          },
          {
            "name": "Restricted and performance stock tax guide"
          },
          {
            "name": "ESPP taxes: qualifying vs disqualifying dispositions"
          },
          {
            "name": "Taxation of retirement provisions in equity awards"
          },
          {
            "name": "ISO vs NSO: tax comparison"
          },
          {
            "name": "Answering common employee stock option tax questions"
          },
          {
            "name": "Business tax deadlines 2026: corporations and LLCs"
          },
          {
            "name": "Tax planning for startups"
          },
          {
            "name": "TCJA sunset: impact on equity compensation"
          },
          {
            "name": "Tax withholding practices: podcast"
          },
          {
            "name": "Tax reporting guide for equity plans: webinar"
          },
          {
            "name": "Year-end US tax reporting guide (webinar)"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-3.2",
        "name": "Alternative Minimum Tax (AMT) & ISOs",
        "leaves": [
          {
            "name": "What is the Alternative Minimum Tax?"
          },
          {
            "name": "How ISO exercises trigger AMT"
          },
          {
            "name": "ISO strategies to minimise AMT exposure"
          },
          {
            "name": "The AMT credit: mechanics and recapture"
          },
          {
            "name": "The ISO tax trap and the AMT credit myth"
          },
          {
            "name": "Form 6251: AMT reporting for ISO exercises"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-3.3",
        "name": "Section 83(b) Elections",
        "leaves": [
          {
            "name": "What is a Section 83(b) election?"
          },
          {
            "name": "Should I make a Section 83(b) election?"
          },
          {
            "name": "How to make a timely and complete 83(b) election"
          },
          {
            "name": "New IRS form for 83(b) elections"
          },
          {
            "name": "83(b) elections and RSUs: why 83(b) does not apply to RSUs"
          },
          {
            "name": "Filing an 83(b) election: what every founder needs to know"
          },
          {
            "name": "Early exercise options and 83(b): accounting implications"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-3.4",
        "name": "Multi-State & Mobile Employee Taxation",
        "leaves": [
          {
            "name": "RSU taxation when an employee relocates between states"
          },
          {
            "name": "Remote work: tax return reporting complications"
          },
          {
            "name": "Five rules of multi-state taxation of equity awards"
          },
          {
            "name": "Multi-state living and working challenges"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-3.5",
        "name": "International & Global Tax",
        "leaves": [
          {
            "name": "Global withholding obligations on equity awards"
          },
          {
            "name": "Global Tax Guide: 50+ country reference"
          },
          {
            "name": "W-8BEN certification for non-US employees"
          },
          {
            "name": "India: Tax Collected at Source on equity compensation"
          },
          {
            "name": "Equity cash-outs: global tax and regulatory considerations"
          },
          {
            "name": "Modern mobility: managing globally mobile employees"
          },
          {
            "name": "Equity compensation for mobile employees abroad"
          },
          {
            "name": "Mobility compliance trends: podcast"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-3.6",
        "name": "Year-End Tax Reporting",
        "leaves": [
          {
            "name": "What is Form 3921?"
          },
          {
            "name": "Section 6039 filings: Forms 3921 and 3922"
          },
          {
            "name": "RSU cost basis errors: avoiding W-2 reporting mistakes"
          },
          {
            "name": "Year-end reporting: Forms 3921, 3922, and W-2"
          },
          {
            "name": "Form 3922 for ESPPs"
          },
          {
            "name": "Tax return reporting for options, RSUs, and ESPPs"
          },
          {
            "name": "Planning for year-end: admin checklist"
          },
          {
            "name": "Year-end tax updates"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-3.7",
        "name": "Qualified Small Business Stock (QSBS)",
        "leaves": [
          {
            "name": "QSBS fundamentals: Section 1202 exclusion explained"
          },
          {
            "name": "Section 1045 rollover: deferring QSBS gains"
          },
          {
            "name": "Qualified Small Business Stock (QSBS): FAQ"
          },
          {
            "name": "QSBS eligibility guide: requirements and pitfalls"
          },
          {
            "name": "QSBS stacking and packing strategies"
          },
          {
            "name": "How CFOs can manage QSBS and avoid tax mistakes"
          },
          {
            "name": "QSBS calculator"
          }
        ],
        "comingSoon": false
      }
    ]
  },
  {
    "id": "v9-4",
    "name": "SEC Law & Compliance",
    "icon": "ti-gavel",
    "color": "blue",
    "comingSoon": false,
    "subtopics": [
      {
        "id": "v9-4.1",
        "name": "Insider Trading Compliance",
        "leaves": [
          {
            "name": "What is insider trading?"
          },
          {
            "name": "Blackout periods and window periods: policy design"
          },
          {
            "name": "Civil and criminal penalties for insider trading"
          },
          {
            "name": "4 trends in trading blackout periods"
          },
          {
            "name": "Insider trading prevention: case study"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-4.2",
        "name": "Section 16 & Insider Reporting",
        "leaves": [
          {
            "name": "Section 16: the basics of Forms 3, 4, and 5"
          },
          {
            "name": "Section 16(b): the short-swing profit rule explained"
          },
          {
            "name": "Section 16: who is an insider and what must they report?"
          },
          {
            "name": "Correcting Form 4 errors"
          },
          {
            "name": "Section 16 reporting enforcement trends"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-4.3",
        "name": "Rule 10b5-1 Trading Plans",
        "leaves": [
          {
            "name": "What is a Rule 10b5-1 trading plan?"
          },
          {
            "name": "Understanding Rule 10b5-1 plans (NASPP resource)"
          },
          {
            "name": "10b5-1 plan interpretations and FAQs"
          },
          {
            "name": "Best practices for 10b5-1 plan design"
          },
          {
            "name": "How advisors craft effective 10b5-1 plans"
          },
          {
            "name": "New SEC 10b5-1 rules: webinar"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-4.4",
        "name": "Rule 144 & Resale of Restricted Securities",
        "leaves": [
          {
            "name": "What are restricted securities?"
          },
          {
            "name": "Affiliate status and resale restrictions"
          },
          {
            "name": "Volume limitations under Rule 144 for affiliates"
          },
          {
            "name": "Rule 144 resale requirements"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-4.5",
        "name": "Executive Compensation Disclosure",
        "leaves": [
          {
            "name": "Proxy disclosure: executive compensation tables"
          },
          {
            "name": "Section 162(m) and negative discretion in performance awards"
          },
          {
            "name": "Clawback policies: Dodd-Frank requirements"
          },
          {
            "name": "10-K and 10-Q equity disclosure best practices: webinar"
          },
          {
            "name": "Private company reporting requirements: webinar"
          }
        ],
        "comingSoon": false
      }
    ]
  },
  {
    "id": "v9-5",
    "name": "Plan Design & Administration",
    "icon": "ti-settings",
    "color": "purple",
    "comingSoon": false,
    "subtopics": [
      {
        "id": "v9-5.1",
        "name": "Share Reserve & Equity Pool Management",
        "leaves": [
          {
            "name": "What is a cap table?"
          },
          {
            "name": "What is contributed capital?"
          },
          {
            "name": "Basics of employee equity plans and option pools"
          },
          {
            "name": "Equity plan reserve sizing and management"
          },
          {
            "name": "Evergreen provisions and ISS scrutiny"
          },
          {
            "name": "Burn rate and overhang: ISS and Glass Lewis standards"
          },
          {
            "name": "Equity plan recharge provisions"
          },
          {
            "name": "Cap table management essentials"
          },
          {
            "name": "Share dilution: mechanics and impact"
          },
          {
            "name": "Option pool sizing and dilution"
          },
          {
            "name": "How to set up an ESOP that scales with your startup"
          },
          {
            "name": "Modeling dilution: planning your equity roadmap"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-5.2",
        "name": "Plan Governance & Shareholder Approval",
        "leaves": [
          {
            "name": "Rule 701: equity compensation for private companies"
          },
          {
            "name": "Stock plan administration staffing and structure"
          },
          {
            "name": "Beneficiary designation programs: best practices"
          },
          {
            "name": "S-Corp vs. C-Corp: a guide to corporate tax classifications"
          },
          {
            "name": "Plan amendments: when is shareholder approval required?"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-5.3",
        "name": "409A Valuation & Private Company Pricing",
        "leaves": [
          {
            "name": "What is fair market value (FMV)?"
          },
          {
            "name": "Private company equity pricing and 409A valuations"
          },
          {
            "name": "409A valuation methodology explained"
          },
          {
            "name": "Equity incentive plans for corporations and LLCs"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-5.4",
        "name": "Repricing, Modifications & Tender Offers",
        "leaves": [
          {
            "name": "What is a tender offer? Exchange programs explained"
          },
          {
            "name": "Accounting for cancellations with no consideration"
          },
          {
            "name": "Repricing options: approaches and considerations"
          },
          {
            "name": "ASC 718 accounting for plan modifications"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-5.5",
        "name": "Corporate Actions: Stock Splits & Adjustments",
        "leaves": [
          {
            "name": "What is a stock split?"
          },
          {
            "name": "Stock split administration: operational checklist"
          },
          {
            "name": "Stock split impact on stock option grants"
          },
          {
            "name": "Stock split impact on ESPPs"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-5.6",
        "name": "Participant Communications & Broker Coordination",
        "leaves": [
          {
            "name": "Participant communications: design and delivery"
          },
          {
            "name": "Equity compensation in financial wellness programs"
          },
          {
            "name": "Broker selection and company-approved broker policies"
          },
          {
            "name": "3 tips to improve an equity participant education strategy"
          },
          {
            "name": "Participant communications: correcting mistakes"
          },
          {
            "name": "Employee communication strategies: webinar"
          },
          {
            "name": "Employee education: podcast"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-5.7",
        "name": "Equity Plan Technology, Automation & HRIS Integration",
        "leaves": [
          {
            "name": "The CFO's guide to evaluating equity management software"
          },
          {
            "name": "Real-time processing and reporting for equity compensation"
          },
          {
            "name": "Switching equity plan providers during macro uncertainty"
          },
          {
            "name": "Advanced automation for equity compensation plan management"
          }
        ],
        "comingSoon": false
      }
    ]
  },
  {
    "id": "v9-6",
    "name": "Accounting & Financial Reporting",
    "icon": "ti-report-analytics",
    "color": "green",
    "comingSoon": false,
    "subtopics": [
      {
        "id": "v9-6.1",
        "name": "ASC 718 Fundamentals",
        "leaves": [
          {
            "name": "What is ASC 718?"
          },
          {
            "name": "What is ASC 820? A guide to fair value measurement"
          },
          {
            "name": "Share-based payments: accounting overview"
          },
          {
            "name": "US equity compensation accounting (NASPP-aligned)"
          },
          {
            "name": "Principles of ASC 718 accounting"
          },
          {
            "name": "6 ways equity plan accounting differs for private companies"
          },
          {
            "name": "Journal entries for stock compensation: reference guide"
          },
          {
            "name": "ASC 718: grant date fair value and expense recognition"
          },
          {
            "name": "When did stock option expensing become mandatory?"
          },
          {
            "name": "Black-Scholes and option valuation models"
          },
          {
            "name": "Comparing stock option valuation models"
          },
          {
            "name": "ASC 718 compliance and audit readiness for CFOs"
          },
          {
            "name": "Accounting 101 for equity compensation: podcast"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-6.2",
        "name": "Performance Award Accounting",
        "leaves": [
          {
            "name": "Performance awards under market uncertainty"
          },
          {
            "name": "ESG metrics in performance awards"
          },
          {
            "name": "Performance shares: expense recognition and true-up"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-6.3",
        "name": "Modifications, Cancellations & Repricing (ASC 718)",
        "leaves": [
          {
            "name": "ASC 718 treatment of plan modifications"
          },
          {
            "name": "Israel Section 102 modifications: accounting implications"
          },
          {
            "name": "Early exercise options: accounting treatment"
          },
          {
            "name": "Accounting for acceleration of vesting upon termination"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-6.4",
        "name": "EPS Dilution",
        "leaves": [
          {
            "name": "What is dilution and why does it matter?"
          },
          {
            "name": "EPS dilution: treasury stock method"
          }
        ],
        "comingSoon": false
      }
    ]
  },
  {
    "id": "v9-7",
    "name": "Financial Planning & Advisory",
    "icon": "ti-chart-line",
    "color": "amber",
    "comingSoon": false,
    "subtopics": [
      {
        "id": "v9-7.1",
        "name": "Exercise & Disposition Strategies",
        "leaves": [
          {
            "name": "Financial planning strategies overview"
          },
          {
            "name": "Including equity compensation in a financial plan"
          },
          {
            "name": "Building wealth with stock awards"
          },
          {
            "name": "What happens to equity compensation if I leave the company?"
          },
          {
            "name": "How to develop a stock option exercise strategy"
          },
          {
            "name": "Ten financial planning rules for stock options"
          },
          {
            "name": "RSU disposition strategies: hold or sell at vesting?"
          },
          {
            "name": "Year-end planning under market uncertainty"
          },
          {
            "name": "Financial planning with equity compensation: 7 tips"
          },
          {
            "name": "Managing equity compensation in a down market"
          },
          {
            "name": "Startup equity calculator"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-7.2",
        "name": "Year-End Tax Planning",
        "leaves": [
          {
            "name": "Year-end stock compensation planning checklist"
          },
          {
            "name": "Top ideas for year-end tax planning with stock compensation"
          },
          {
            "name": "Year-end strategies for RSUs and performance shares"
          },
          {
            "name": "Year-end strategies for ESPPs"
          },
          {
            "name": "Year-end tax updates"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-7.3",
        "name": "Concentrated Stock & Diversification",
        "leaves": [
          {
            "name": "Managing concentrated company stock positions"
          },
          {
            "name": "The risk of overconcentration in company stock"
          },
          {
            "name": "Diversification strategies for equity compensation"
          },
          {
            "name": "Hedging employee stock options"
          },
          {
            "name": "Strategies for hedging concentrated stock positions"
          },
          {
            "name": "How to diversify company stock holdings"
          },
          {
            "name": "Why overconcentration is risky, and how to avoid it"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-7.4",
        "name": "Retirement Planning",
        "leaves": [
          {
            "name": "Social Security and stock compensation"
          },
          {
            "name": "Pre-retirement planning with stock options and RSUs"
          },
          {
            "name": "Optimising equity compensation for retirement drawdown"
          },
          {
            "name": "Roth IRA strategies with stock compensation"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-7.5",
        "name": "Life Events",
        "leaves": [
          {
            "name": "Equity awards in divorce proceedings"
          },
          {
            "name": "Divorce and equity compensation"
          },
          {
            "name": "Disability: impact on stock grants"
          },
          {
            "name": "Death and stock options: estate administration"
          },
          {
            "name": "College funding with stock options and RSUs"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-7.6",
        "name": "High Net Worth & Estate Planning",
        "leaves": [
          {
            "name": "GRATs with company stock"
          },
          {
            "name": "Charitable remainder trusts and company stock"
          },
          {
            "name": "Gifts and charitable donations of company stock"
          },
          {
            "name": "High net worth equity compensation strategies"
          },
          {
            "name": "Estate planning with equity compensation"
          },
          {
            "name": "Estate tax planning for large company stock holdings"
          },
          {
            "name": "Advanced tax strategies for donating equity awards"
          }
        ],
        "comingSoon": false
      }
    ]
  },
  {
    "id": "v9-8",
    "name": "Special Situations",
    "icon": "ti-building-bank",
    "color": "red",
    "comingSoon": false,
    "subtopics": [
      {
        "id": "v9-8.1",
        "name": "Fundraising Instruments",
        "leaves": [
          {
            "name": "What is a SAFE agreement?"
          },
          {
            "name": "What is a convertible note?"
          },
          {
            "name": "What is a seed investment round?"
          },
          {
            "name": "What is a special purpose vehicle (SPV)?"
          },
          {
            "name": "SAFE tax treatment: a guide for startups and SAFE investors"
          },
          {
            "name": "Pre-money SAFE vs. post-money SAFE: what's the difference?"
          },
          {
            "name": "When to raise money for a startup"
          },
          {
            "name": "Series A cap table: what investors check and how to prepare"
          },
          {
            "name": "Startup funding rounds: what to know from seed to IPO"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-8.2",
        "name": "Down Rounds",
        "leaves": [
          {
            "name": "Down rounds: impact on employee equity"
          },
          {
            "name": "What happens to equity in a down round?"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-8.3",
        "name": "Private Company Equity Administration",
        "leaves": [
          {
            "name": "What is an accredited investor?"
          },
          {
            "name": "Cap tables 101 for founders"
          },
          {
            "name": "Securities law considerations for private companies"
          },
          {
            "name": "IRS guidance on Section 83(i) deferred income"
          },
          {
            "name": "Vested equity and employee exits at private companies"
          },
          {
            "name": "Private company equity compensation market data"
          },
          {
            "name": "Key private company equity terms"
          },
          {
            "name": "Equity compensation for companies that never go public"
          },
          {
            "name": "SEC proposes updates to Form S-8 and Rule 701"
          },
          {
            "name": "FASB simplifies private company stock valuation"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-8.4",
        "name": "Tender Offers & Secondary Liquidity Programs",
        "leaves": [
          {
            "name": "The basics of equity compensation"
          },
          {
            "name": "A beginner's guide to liquidity"
          },
          {
            "name": "Benefits of company-led tender offers"
          },
          {
            "name": "Tender Tips: running and participating in a tender offer"
          },
          {
            "name": "Taxes when selling private stock and options"
          },
          {
            "name": "Secondary markets for private company stock"
          },
          {
            "name": "Selling private company shares in the secondary market"
          },
          {
            "name": "Private stock transfer restrictions"
          },
          {
            "name": "Selling your private stock: understanding the essentials"
          },
          {
            "name": "Understanding the bid-ask spread"
          },
          {
            "name": "Investing intelligently in private companies"
          },
          {
            "name": "Tender offer eligibility"
          },
          {
            "name": "Investing tender offer proceeds"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-8.5",
        "name": "Private Company Liquidity: Employee & Employer Guides",
        "leaves": [
          {
            "name": "Understanding equity dilution and anti-dilution provisions"
          },
          {
            "name": "Helping employees navigate a tender offer"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-8.6",
        "name": "M&A: Plan Treatment & Administration",
        "leaves": [
          {
            "name": "M&A basics: impact on equity awards"
          },
          {
            "name": "SPACs and equity compensation"
          },
          {
            "name": "M&A: detailed impact on grants"
          },
          {
            "name": "M&A taxation of equity awards"
          },
          {
            "name": "What happens to stock options when a company is acquired?"
          },
          {
            "name": "What happens to unvested grants in an acquisition?"
          },
          {
            "name": "Purchase price allocation (PPA) in M&A"
          },
          {
            "name": "Leveraged buyout (LBO): impact on equity holders"
          },
          {
            "name": "Waterfall analysis: how proceeds flow in an exit"
          },
          {
            "name": "Liquidation preferences: mechanics and priority"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-8.7",
        "name": "IPO & Pre-IPO Administration",
        "leaves": [
          {
            "name": "What is private equity and how does it work?"
          },
          {
            "name": "Pre-IPO equity compensation: basics"
          },
          {
            "name": "Going public: what changes for equity compensation?"
          },
          {
            "name": "Five things to know about private company options and RSUs"
          },
          {
            "name": "Direct listings: how they work for employees"
          },
          {
            "name": "SPAC mergers: equity compensation impact"
          },
          {
            "name": "Secondary market transactions for private company shares"
          },
          {
            "name": "Tender offer mechanics: employee perspective"
          },
          {
            "name": "How to sell private company stock"
          },
          {
            "name": "What happens in a liquidity event"
          },
          {
            "name": "Equity management from startup to IPO"
          },
          {
            "name": "IPO equity administration readiness guide"
          },
          {
            "name": "Early exercise options at pre-IPO companies"
          },
          {
            "name": "IPO readiness checklist"
          },
          {
            "name": "Staying transaction-ready for IPO in uncertain markets"
          },
          {
            "name": "Private company liquidity events"
          },
          {
            "name": "Pre-IPO company equity: 6 actions to take now"
          }
        ],
        "comingSoon": false
      },
      {
        "id": "v9-8.8",
        "name": "Job Transitions & Negotiations",
        "leaves": [
          {
            "name": "Job search and equity negotiation overview"
          },
          {
            "name": "Hiring overview: equity in offer letters"
          },
          {
            "name": "Consultants and contractors: equity compensation basics"
          },
          {
            "name": "Negotiating stock options and RSUs: seven things to know"
          },
          {
            "name": "Noncompete and clawback strings in grant agreements"
          },
          {
            "name": "Employee compensation: a founder's guide to packages"
          },
          {
            "name": "Startup stock options: a guide for founders and employees"
          }
        ],
        "comingSoon": false
      }
    ]
  },
  {
    "id": "v9-9",
    "name": "Reference & Tools",
    "icon": "ti-tool",
    "color": "gray",
    "comingSoon": true,
    "subtopics": [
      {
        "id": "v9-9.1",
        "name": "Calculators & Modelling Tools",
        "leaves": [
          {
            "name": "ESPP $25K limit worksheet"
          },
          {
            "name": "Cap table template"
          },
          {
            "name": "myTools: full calculator suite"
          },
          {
            "name": "Black-Scholes option valuation calculator"
          },
          {
            "name": "SARs value calculator"
          },
          {
            "name": "QSBS calculator"
          },
          {
            "name": "AMT calculator"
          },
          {
            "name": "RSU vs options calculator"
          },
          {
            "name": "Option pool calculator"
          },
          {
            "name": "Burn rate calculator"
          },
          {
            "name": "Startup equity calculator"
          }
        ],
        "comingSoon": true
      },
      {
        "id": "v9-9.2",
        "name": "Glossary & Definitions",
        "leaves": [
          {
            "name": "Equity compensation glossary (referenced against NASPP terminology)"
          }
        ],
        "comingSoon": true
      },
      {
        "id": "v9-9.3",
        "name": "Continuing Education & Certification",
        "leaves": [
          {
            "name": "NASPP CEU credits: earning and tracking"
          },
          {
            "name": "Continuing education course catalog"
          }
        ],
        "comingSoon": true
      },
      {
        "id": "v9-9.4",
        "name": "NASPP Resource Library",
        "leaves": [
          {
            "name": "ESPPs: NASPP award type resource centre"
          },
          {
            "name": "Restricted stock and RSUs: NASPP award type resource centre"
          },
          {
            "name": "Stock options: NASPP award type resource centre"
          },
          {
            "name": "Private company stock plans: NASPP topic hub"
          },
          {
            "name": "Company insiders: NASPP topic hub"
          },
          {
            "name": "Disclosures and financial reporting: NASPP topic hub"
          },
          {
            "name": "NASPP regional chapter events"
          },
          {
            "name": "From incorporation to tax season: equity compliance guide"
          },
          {
            "name": "Global stock plans: country guides"
          },
          {
            "name": "NASPP Advisor newsletter"
          },
          {
            "name": "Sample summary of RSUs for management: template"
          }
        ],
        "comingSoon": true
      }
    ]
  }
];
