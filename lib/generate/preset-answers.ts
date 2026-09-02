/**
 * Curated demonstration answers for the five cards on Ask a Question. They
 * deliberately live on the client side: choosing a card should demonstrate
 * the complete result experience without invoking retrieval or generation.
 */
export type PresetCitation = {
  kind: "topic";
  nodeId: string;
  title: string;
};

export type PresetAnswer = {
  id: string;
  label: string;
  question: string;
  title: string;
  bodyMarkdown: string;
  quickShare: string;
  citations: PresetCitation[];
};

export const PRESET_ANSWERS: readonly PresetAnswer[] = [
  {
    id: "iso-vs-nso",
    label: "Award Types",
    question: "What's the difference between ISOs and NSOs?",
    title: "ISO vs. NSO",
    bodyMarkdown: `## 1. One-sentence framing

Both are stock options that give the holder the right to buy company shares at a set exercise price, but they differ in who can receive them, how they're taxed, and what compliance rules apply.

## 2. Eligibility

ISOs can only be granted to employees. NSOs can go to anyone: employees, consultants, advisors, board members. This is often the first decision point in plan design.

## 3. Tax at exercise

NSOs trigger ordinary income tax on the spread (FMV minus exercise price) at the time of exercise, plus FICA withholding. ISOs do not trigger ordinary income tax at exercise. However, the spread is an AMT preference item, which means ISO holders may owe Alternative Minimum Tax in the year of exercise even though they haven't sold shares or received cash.

## 4. Holding period requirements

To get long-term capital gains treatment on ISOs, the holder must satisfy two conditions simultaneously: hold the shares at least 2 years from grant date AND at least 1 year from exercise date. Missing either condition by even one day converts the sale into a disqualifying disposition, and the spread is taxed as ordinary income. NSOs have no special holding period; capital gains treatment depends on the standard 1-year rule from the date shares are acquired.

## 5. The $100K ISO limit

ISOs that become exercisable for the first time in any calendar year are limited to $100K in aggregate fair market value (measured at grant date). Any excess is automatically treated as NSOs. This matters for large grants and accelerated vesting schedules.

## 6. Company tax deduction

The company gets a tax deduction when NSOs are exercised (equal to the spread). ISOs in a qualifying disposition generate no deduction for the company. This is a real cost consideration for companies with large option pools.

## 7. Post-termination exercise window

ISOs must be exercised within 90 days of employment termination to retain ISO treatment. After 90 days, they convert to NSOs. NSOs follow whatever post-termination exercise period the plan specifies.`,
    quickShare: `Both are stock options that give the holder the right to buy company shares at a set exercise price, but they differ in eligibility, tax treatment, and compliance rules. ISOs are limited to employees and can receive favorable capital-gains treatment if their holding periods are met, while NSOs can be granted more broadly and create ordinary income at exercise.`,
    citations: [
      { kind: "topic", nodeId: "1.1", title: "Incentive stock options (ISOs)" },
      { kind: "topic", nodeId: "1.2", title: "Non-qualified stock options (NSOs)" },
      { kind: "topic", nodeId: "3.1", title: "Option taxation (ISO/NSO, AMT)" },
      { kind: "topic", nodeId: "3.3", title: "Capital gains, holding periods & 83(b)" },
    ],
  },
  {
    id: "award-family-comparison",
    label: "Award Comparison",
    question: "How do stock options, RSUs, and cash-settled awards compare?",
    title: "Stock options, RSUs, and cash-settled awards",
    bodyMarkdown: `## 1. Framing

Stock options, RSUs, and cash-settled awards (SARs and phantom equity) are the three main families of equity compensation. Each has different mechanics for how value is delivered, when taxes hit, and whether real shares change hands.

## 2. Stock options (ISOs and NSOs)

The holder pays an exercise price to acquire shares. Value comes only from appreciation above the exercise price. The holder bears downside risk: if the stock price is below the exercise price, the option is underwater and worthless. Options require the holder to take action (exercise), and tax timing depends on the option type and when shares are sold.

## 3. RSUs

No exercise price. The company promises to deliver shares (or their cash equivalent) once vesting conditions are met. The holder captures the full value of the shares, not just the appreciation. Taxed as ordinary income on the full FMV at vesting. RSUs always have value as long as the stock price is above zero, which makes them less risky for employees than options.

## 4. Cash-settled awards (SARs and phantom equity)

SARs work like options but settle in cash (or sometimes shares) for the appreciation amount. No exercise price is paid. Phantom stock tracks the full share value (like RSUs) but pays out in cash. Neither SARs nor phantom equity involve actual share issuance, so there is no dilution to existing shareholders. This makes them popular with private companies and LLCs that don't want to issue real equity.

## 5. Tax comparison

Options: taxed at exercise (NSOs) or sale (ISOs, if qualified). RSUs: taxed at vesting as ordinary income. SARs: taxed at exercise as ordinary income. Phantom stock: taxed at payout as ordinary income. All cash-settled awards are subject to Section 409A rules on timing of payment.

## 6. Accounting treatment

Stock-settled awards (options, RSUs settled in shares) are equity-classified under ASC 718: measured once at grant date, expense is fixed. Cash-settled awards (cash SARs, phantom stock) are liability-classified: remeasured at fair value each reporting period until settlement, which means the expense fluctuates. This creates more P&L volatility for the company.

## 7. When companies use which

Options: when the company wants to reward appreciation and the stock has meaningful upside (common in startups). RSUs: when the company wants to guarantee value delivery regardless of stock price movement (common in public companies). Cash-settled awards: when the company wants to avoid dilution, doesn't have publicly traded shares, or has LLC/partnership structure that makes real equity grants complex.`,
    quickShare: `Stock options reward appreciation above an exercise price, RSUs deliver the full share value after vesting, and SARs or phantom equity generally settle in cash. Their mechanics, taxation, dilution, and accounting treatment differ.`,
    citations: [
      { kind: "topic", nodeId: "1.1", title: "Incentive stock options (ISOs)" },
      { kind: "topic", nodeId: "1.2", title: "Non-qualified stock options (NSOs)" },
      { kind: "topic", nodeId: "1.3", title: "RSUs & RSAs" },
      { kind: "topic", nodeId: "1.6", title: "SARs & phantom equity" },
    ],
  },
  {
    id: "section-409a-options",
    label: "Tax & Compliance",
    question: "How does Section 409A affect stock option grants?",
    title: "Section 409A and stock option grants",
    bodyMarkdown: `## 1. What 409A is and why it matters for options

Section 409A of the Internal Revenue Code governs nonqualified deferred compensation. Stock options can fall under 409A if they are not structured correctly. The core rule: a stock option is exempt from 409A only if the exercise price is set at or above the fair market value (FMV) of the underlying stock on the grant date. If the exercise price is below FMV (a "discount option"), 409A applies, and the consequences are severe.

## 2. The FMV exercise price requirement

This is the single most important 409A rule for option grants. The exercise price must equal or exceed the stock's FMV on the date of grant. For public companies, FMV is straightforward (closing price or average of high/low). For private companies, FMV must be determined by a reasonable valuation method, and the safest approach is an independent 409A appraisal.

## 3. Safe harbor valuation methods

The IRS regulations provide three safe harbor methods that shift the burden of proof to the IRS. The most common is an independent appraisal by a qualified appraiser, performed within 12 months of the grant date. If a company uses a safe harbor method, the IRS must prove the valuation was "grossly unreasonable" to challenge it. Without a safe harbor, the company bears the burden of proving its valuation was reasonable.

## 4. Penalties for non-compliance (discount options)

If options are granted below FMV: (a) The spread is treated as deferred compensation subject to 409A. (b) Income is recognized when the option vests (not when exercised), even if the holder hasn't exercised or received any cash. (c) A 20% additional excise tax applies on top of regular income tax. (d) Interest penalties accrue from the date the option vested. The combined tax burden can exceed 45% of the discount value. These penalties fall on the option holder (the employee), not the company.

## 5. Other 409A traps beyond exercise price

Modifications to outstanding options (extending the exercise period, adding a feature) can create a new "grant date" for 409A purposes. If the FMV has risen since the original grant, the modified option may now be a discount option. Repricing underwater options also triggers 409A analysis. Additionally, options on partnership/LLC interests (profits interests structured as options) may have different 409A considerations.

## 6. Practical takeaway

For private companies: get a 409A valuation before every round of option grants, and refresh it at least every 12 months or after any material event (funding round, significant revenue change, M&A activity). For public companies: use the grant-date closing price and document the process. For all companies: be cautious with option modifications and extensions.`,
    quickShare: `Section 409A generally exempts options priced at or above fair market value on the grant date. Discounted options can trigger immediate income inclusion, a 20% additional tax, and interest, so defensible grant-date valuation and careful modifications matter.`,
    citations: [
      { kind: "topic", nodeId: "3.7", title: "Section 409A deferred compensation" },
      { kind: "topic", nodeId: "6.5", title: "409A valuations & fair market value" },
      { kind: "topic", nodeId: "2.1", title: "Grant & acceptance" },
      { kind: "topic", nodeId: "4.3", title: "Modifications" },
    ],
  },
  {
    id: "asc-718-accounting",
    label: "Equity Accounting",
    question: "How does ASC 718 accounting work for stock-based compensation?",
    title: "ASC 718 stock-based compensation",
    bodyMarkdown: `## 1. What ASC 718 requires

ASC 718 (Compensation: Stock Compensation) is the US GAAP standard that requires companies to recognize the cost of stock-based compensation as an expense on their financial statements. The core principle: measure equity awards at fair value on the grant date, then recognize that cost as compensation expense over the requisite service period (typically the vesting period).

## 2. Grant-date fair value measurement

For options: fair value is typically calculated using an option-pricing model (Black-Scholes or a lattice/binomial model). Key inputs: stock price, exercise price, expected term, expected volatility, risk-free interest rate, and expected dividend yield. For RSUs: fair value is generally the stock price on the grant date (simpler). For performance awards with market conditions: Monte Carlo simulation is typically required. Once measured at grant date, the fair value of equity-classified awards is fixed and not remeasured.

## 3. Expense recognition pattern

The total compensation cost (grant-date fair value times number of awards) is recognized ratably over the vesting period. For graded vesting schedules, companies can choose to expense each tranche separately (accelerated method) or expense the entire award on a straight-line basis. The choice is an accounting policy election that must be applied consistently.

## 4. Forfeitures

Companies have a policy election (since ASU 2016-09): either estimate forfeitures at grant and adjust over time, or recognize forfeitures as they occur. Most private companies elect to account for forfeitures as they occur because it's simpler and avoids maintaining forfeiture rate estimates.

## 5. Private company practical expedients

Private companies can use the "simplified method" for expected term (average of vesting period and contractual term) instead of building estimates from historical exercise data they likely don't have. ASU 2021-07 also provides a practical expedient for determining the current share price input for equity-classified awards. These expedients save significant cost and effort.

## 6. Equity-classified vs. liability-classified

Awards settled in shares are generally equity-classified (fixed expense). Awards settled in cash are liability-classified (remeasured each period, creating P&L volatility). The classification also affects where the expense appears on the balance sheet (additional paid-in capital vs. liability).

## 7. Modifications

When award terms are changed (repricing, vesting acceleration, extension of exercise period), ASC 718 requires the company to calculate incremental compensation cost: the difference between the fair value of the modified award and the fair value of the original award immediately before modification. This incremental cost is recognized over the remaining service period.`,
    quickShare: `ASC 718 requires companies to measure stock-based awards at grant-date fair value and recognize compensation expense over the service period. Classification, forfeiture policy, and modifications affect the accounting outcome.`,
    citations: [
      { kind: "topic", nodeId: "4.1", title: "Grant-date fair value" },
      { kind: "topic", nodeId: "4.2", title: "Expense recognition & forfeitures" },
      { kind: "topic", nodeId: "4.3", title: "Modifications" },
      { kind: "topic", nodeId: "1.3", title: "RSUs & RSAs" },
    ],
  },
  {
    id: "double-trigger-rsus",
    label: "Equity Lifecycle",
    question: "How does double-trigger vesting work for RSUs?",
    title: "Double-trigger vesting for RSUs",
    bodyMarkdown: `## 1. What double-trigger means

Double-trigger RSUs require two conditions before shares are delivered and taxable income is recognized. Trigger 1: time-based vesting (the standard schedule, e.g., 4-year with 1-year cliff). Trigger 2: a liquidity event, typically an IPO, acquisition, or company-sponsored tender offer. Both triggers must be satisfied before settlement occurs.

## 2. Why private companies use this structure

The problem double-trigger solves: if RSUs settled at a private company upon time-vesting alone, the employee would owe ordinary income tax on the full FMV of shares they can't sell. There's no public market to sell into, so the employee faces a tax bill with no liquidity to cover it. Double-trigger defers everything (share delivery, income recognition, tax liability) until a liquidity event creates the ability to sell.

## 3. How the two triggers interact

The triggers are independent. Time-vesting continues on its normal schedule even though shares aren't delivered yet. If the liquidity event happens before all shares are time-vested, only the time-vested portion settles at the event. The remaining unvested shares continue on their time-vesting schedule and settle as they vest (assuming the company is now public or has a liquid market). If the employee is fully time-vested before the liquidity event, all shares settle at once when the event occurs.

## 4. Tax timing

No tax at grant. No tax when units time-vest at a private company (because no settlement has occurred). Tax hits when both triggers are satisfied and shares are actually delivered. At that point, the full FMV is ordinary income, and the company must withhold. Because settlement coincides with a liquidity event, employees can typically sell shares to cover the tax bill.

## 5. What happens in an acquisition

The acquisition itself satisfies the second trigger. Time-vested RSUs typically settle at closing, either in acquirer shares or cash. Unvested RSUs may be assumed by the acquirer (converted to acquirer RSUs on a new schedule), accelerated and cashed out, or cancelled, depending on the deal terms. The specific treatment is negotiated in the merger agreement.

## 6. What happens at IPO

The IPO satisfies the second trigger. Time-vested RSUs settle shortly after the IPO (often subject to a lock-up period). Companies typically settle in tranches to manage the tax withholding logistics and avoid flooding the market. Post-IPO, the RSUs convert to standard single-trigger RSUs because the liquidity condition is permanently satisfied.

## 7. Expiration risk

Most double-trigger RSU plans include an expiration date (often 7-10 years from grant). If no liquidity event occurs before expiration, the RSUs expire worthless, even if fully time-vested. Employees should understand this risk, especially at companies with no near-term IPO or acquisition plans.`,
    quickShare: `Double-trigger RSUs require both time-based vesting and a liquidity event before settlement and ordinary-income taxation. The structure helps employees avoid a tax bill on private-company shares that cannot yet be sold.`,
    citations: [
      { kind: "topic", nodeId: "1.3", title: "RSUs & RSAs" },
      { kind: "topic", nodeId: "2.2", title: "Vesting" },
      { kind: "topic", nodeId: "2.4", title: "Settlement & release" },
      { kind: "topic", nodeId: "2.5", title: "Liquidity & exits" },
    ],
  },
];
