![Fortuna Banner](./images/banner.png)

# Product Vision, Features, and Strategy

> Fortuna is the Roman goddess of fortune: chance, prosperity, and the turning of the wheel. This app is a small attempt to make that wheel a little less random by trading guesswork about money for an honest, forward-looking picture you can actually plan around.

This document is the North Star for Fortuna. It explains what the product is for, who it serves, and where it's going. It's intentionally high-level.

---

## Mission

Give people an honest, forward-looking picture of their money: not just where they stand today, but where they're headed.

## Vision

Most money apps are rear-view mirrors. They tell you what you spent last month across a handful of accounts and leave the most important question unanswered: *will I be okay?*

Fortuna is built to answer that question. It unifies everything you own, owe, earn, and spend into a single source of truth, then projects it forward, months and years out, so the long-term consequences of today's decisions become visible. It thinks in decades, not billing cycles.

It's free, open source, and built in public. Your financial data is the most sensitive data you have, so Fortuna treats ownership, privacy, and the right to walk away with your data as first-class features, not afterthoughts.

## Why I'm Building It

Fortuna is a solo project, built in the open, that started by scratching my own itch.

I wanted to know whether the decisions I make today (a big purchase, a career change, how aggressively I invest) leave me in a good place ten years from now. The honest answer lived in a sprawling, fragile spreadsheet that I dreaded touching. Every existing app was great at telling me what already happened and useless at telling me what comes next.

So this is two things at once: a tool I genuinely want to use, and a portfolio project I'm building in public to share how a real, production-grade application gets designed and shipped end to end, from architecture decisions to privacy compliance. Building it openly keeps me honest about both.

## Problems Fortuna Solves

1. **Fragmentation.** Money is scattered across checking accounts, credit cards, brokerages, retirement accounts, and spreadsheets. No single place shows the whole picture, so nobody actually knows their real net worth.

2. **Rear-view bias.** Tracking apps are excellent historians and poor forecasters. Knowing you spent $340 on dining last month doesn't tell you whether you can afford the move, the sabbatical, or retirement.

3. **Spreadsheet fatigue.** DIY forecasting in a spreadsheet is powerful but brittle. One wrong formula, one forgotten account, and the model quietly lies to you. Maintaining it is a part-time job most people abandon.

4. **Opaque trade-offs.** It's nearly impossible to see how a single decision today reshapes the long-term picture. What does a 15% raise actually do to your timeline? A market downturn? A new car every five years? The trade-offs stay invisible until it's too late to change them.

## Core Features

Fortuna is built on a simple premise: *you can't forecast what you can't see.* So the foundation is a complete picture of your finances, and the differentiator is what Fortuna does with it.

### 1. Holistic net worth: the foundation

A single source of truth for everything financial.

- Track accounts, assets, and liabilities side by side: cash, cards, loans, property, investments.
- Manual entry that's fast and frictionless, with imports for people who'd rather not type.
- Multi-currency aware, so accounts and assets in different currencies roll up into one honest total.
- One number, always current: your real net worth, and how it's trending.

### 2. Long-term cash-flow forecasting: the wedge

The reason Fortuna exists. Turn today's picture into tomorrow's projection.

- Project net worth and cash flow months and years into the future from your income, spending, and growth assumptions.
- See the runway clearly: when goals are reached, when money runs short, when you cross the line into "okay."
- Adjustable assumptions (income changes, inflation, returns) so the forecast reflects your reality, not a generic template.
- Designed to answer one question above all: *will I be okay?*

### 3. Spending and income tracking

The raw material the forecast is built from.

- Categorize transactions and surface trends without ceremony.
- Recurring income and expenses feed directly into the forecast, so the projection updates as life does.

### 4. Investment tracking

Because for most people, the long-term picture is mostly investments.

- Track holdings across asset classes: equities, funds, fixed income, crypto.
- See allocation, contributions, and performance as part of net worth, not a separate silo.
- Investment growth assumptions flow into the long-term forecast.

### 5. Goals and milestones

Give the forecast something to aim at.

- Define targets: an emergency fund, a down payment, financial independence, retirement.
- Track progress against the projection, not just against today's balance.
- Know not only *how far* you are from a goal, but *when* you're on track to reach it.

### 6. Scenarios and what-ifs

Make invisible trade-offs visible.

- Model a decision (a job change, a big purchase, a market dip, a new monthly cost) and see how it reshapes the long-term picture.
- Compare scenarios side by side before committing real money to them.

### 7. Privacy and data ownership

Treated as a feature, not fine print.

- Privacy-by-design: clear data controls, full export, and real account deletion (already shipped, and built to LGPD/GDPR standards).
- Open source and self-hostable. Run your own Fortuna if you'd rather not trust anyone with your money data.
- Your data is yours. Leaving is always easy.

## Integrations and Ecosystem

Fortuna works on day one with zero integrations. Manual entry and file imports (CSV/OFX) are first-class, not fallbacks. Integrations make it more convenient, never mandatory.

- **Account aggregation.** Optional connections to banks and brokerages via open-banking aggregators, so balances and transactions stay current without manual upkeep.
- **Import and export anywhere.** Bring data in from spreadsheets and statements; take all of it out at any time, in open formats.
- **Open by default.** Because the codebase is open source and self-hostable, the ecosystem is extensible by design: fork it, host it, or build on top of it.

## Target Audience

1. **The long-term planner.** Wants a credible answer to "will I be okay in 5, 10, 20 years?" and is willing to put in the inputs to get one.

2. **The spreadsheet graduate.** Has outgrown a DIY forecasting spreadsheet and wants its power without its fragility and upkeep.

3. **The multi-account juggler.** Money spread across several banks, brokerages, and currencies; needs one honest total instead of mental math.

4. **The privacy-conscious and self-hosters.** Distrust closed money apps and want ownership, transparency, and the option to run it themselves.

## Sustainability and Monetization

Fortuna is, first and foremost, a personal and portfolio project. It is free and open source, and there are no paywalls or monetization plans today.

If it ever needs to sustain itself, the model is deliberately simple and non-predatory: an optional hosted tier for people who want a managed instance with bank sync handled for them, while the full core stays free and self-hostable. Fortuna will never sell or monetize user data. That would betray the entire point of the product.

## Why Now

1. **Open banking has matured.** Account-aggregation APIs are now accessible enough for a solo developer to offer convenient, optional sync.

2. **Financial anxiety is high.** Inflation, volatile rates, and less linear careers have made *forward-looking* planning, not just budgeting, what people actually want.

3. **Data ownership is mainstream.** Self-hosting and skepticism of closed apps holding sensitive data have gone from niche to expected, especially for money.

4. **The stack makes it feasible solo.** A modern foundation (Next.js, NestJS, PostgreSQL) makes a polished, private, forecasting-grade app something one person can realistically build and ship.
