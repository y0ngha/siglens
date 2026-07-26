# Siglens

<div align="center">

**AI technical analysis for US stocks and crypto — enter a ticker, get the read.**

![Status](https://img.shields.io/badge/status-production-brightgreen)
![License](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Node.js](https://img.shields.io/badge/node-25.2.1-green)

[![Website](https://img.shields.io/badge/Website-siglens.io-blue?style=for-the-badge)](https://siglens.io)
[![Korean](https://img.shields.io/badge/README-Korean-white?style=for-the-badge)](https://github.com/y0ngha/siglens/blob/master/README.ko.md)
[![Docs](https://img.shields.io/badge/Docs-Read%20Docs-green?style=for-the-badge)](https://github.com/y0ngha/siglens/tree/master/docs)
[![Issues](https://img.shields.io/badge/Issues-Report%20Bug-red?style=for-the-badge)](https://github.com/y0ngha/siglens/issues)

</div>

---

Reading a chart means stacking indicators by hand, checking volume, hunting for patterns, then judging it all at once. Siglens does that reading for you.

```text
The usual way    add indicators manually → read volume → inspect patterns → judge
Siglens          enter a ticker → chart and indicators render → read the AI report
```

Type `AAPL` and you get candles with indicators, a pattern scan, an AI analysis report, a news digest, a fear-greed reading, and a consolidated scenario — on one page. Equities add fundamentals, financial statements, congressional trading, and the options market. Crypto stays on the 24/7 axes: chart, news, fear-greed, overall.

**Siglens never places an order.** It is analysis only, and every investment decision is the reader's own.

Live in production at **[siglens.io](https://siglens.io)**. The UI and every AI report are Korean; source and this README are English, and `docs/` is Korean.

### Contents

[Features](#features) · [Pages](#pages) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Skills](#skills-system) · [Operations](#operations) · [Docs](#documentation) · [Testing](#testing) · [Commands](#commands)

---

## Features

**The analysis itself**

- **AI reports in Korean** that fuse technical signals, news, and fear-greed — extended for equities with fundamentals, financials, options, and congressional trading
- **Pattern detection** driven by Skills: single and multi-candle patterns, head and shoulders, wedges, double tops/bottoms, triangles, flags, cup and handle
- **Charts** on Lightweight Charts v5 — candles, volume, indicator overlays, and timeframes that adapt per asset class
- **Equity-only depth**: valuation and analyst consensus, income/balance/cash-flow statements, options chains with Max Pain, Put/Call Ratio, ATM IV, Implied Move, and Senate/House disclosure trends

**Choosing how it thinks**

- **Model selection per page** — DeepSeek (default), Claude, Gemini, ChatGPT
- **Reasoning toggle** — signed-in users flip extended reasoning on or off per analysis; the free tier runs with it off
- **BYOK** — store your own Anthropic, Google, OpenAI, or DeepSeek key, encrypted, and run on your own quota
- **Follow-up chat** grounded in the analysis you are looking at

**Your own position**

- **Holdings** — register symbol, quantity, and average cost, then see where your cost sits inside the volume-by-price band distribution
- **Accounts are optional** — everything core works anonymously; signing in unlocks tier-based models, limits, and BYOK

**Market-wide**

- **Sector dashboard** scanning 81 large-cap stocks across 11 sectors for golden crosses, RSI divergence, and Bollinger squeezes
- **News hub** with AI digests for general US, stocks, crypto, forex, and market articles
- **Macro dashboard** — rates, CPI, employment, GDP, Treasury yields, economic calendar, AI briefing
- **Backtesting** — real returns for 100 historical AI analyses entered between 2024.11 and 2026.03

<details>
<summary><b>Full indicator list</b></summary>

RSI · MACD · Bollinger Bands · ADX · DMI · Stochastic · StochRSI · CCI · VWAP · MA · EMA · Volume Profile · Ichimoku Cloud · ATR · Donchian Channel · Keltner Channel · SuperTrend · OBV · CMF · MFI · Parabolic SAR · Williams %R · Squeeze Momentum · Smart Money Concepts, and more.

Calculation specs live in [DOMAIN.md](./docs/product/DOMAIN.md).

</details>

## Pages

### Symbol pages

| Route | Equities | Crypto | What it shows |
|---|:---:|:---:|---|
| `/[symbol]` | ✓ | ✓ | Chart, technical analysis, AI report |
| `/[symbol]/news` | ✓ | ✓ | Symbol news and AI sentiment |
| `/[symbol]/fear-greed` | ✓ | ✓ | Symbol-level fear-greed index |
| `/[symbol]/overall` | ✓ | ✓ | Every axis the asset class supports, consolidated |
| `/[symbol]/position` | ✓ | ✓ | Where your average cost sits in the volume-by-price bands |
| `/[symbol]/fundamental` | ✓ | — | Fundamentals, valuation, analyst consensus |
| `/[symbol]/financials` | ✓ | — | Income statement, balance sheet, cash flow, growth |
| `/[symbol]/congress` | ✓ | — | Congressional trading trends from US disclosures |
| `/[symbol]/options` | ✓ | — | Options chain, OI distribution, Max Pain, IV analysis |

### Product pages

| Route | What it shows |
|---|---|
| `/market` | Sector signal dashboard |
| `/economy` | Macro indicators, Treasury yields, calendar, AI briefing |
| `/news`, `/news/[category]` | News hub — general, stock, crypto, forex, market |
| `/backtesting` | AI analysis backtesting results |
| `/portfolio` | Manage registered holdings |
| `/onboarding` | Post-signup holdings registration |
| `/share/[id]` | Shareable analysis snapshots |

<details>
<summary><b>Account and operational routes</b></summary>

**Account**

| Route | Purpose |
|---|---|
| `/login`, `/signup` | Email and OAuth sign-in / sign-up |
| `/signup/oauth/consent` | Terms consent step for OAuth sign-up |
| `/forgot-password`, `/reset-password` | Password reset via email token |
| `/account` | Settings, tier, BYOK key management |
| `/account/delete` | Account deletion |
| `/terms`, `/privacy` | Terms of service, privacy policy |

**Operational endpoints**

| Route | Purpose |
|---|---|
| `/api/health` | Shallow liveness probe — the ALB target group polls this |
| `/api/ready` | Deep readiness probe (DB and Redis reachability) |
| `/api/cron/seo-prewarm` | EventBridge-driven pre-warm batch (Bearer `CRON_SECRET`) |
| `/api/sitemap`, `/api/sitemap/{static,popular,crypto,longtail/[page]}` | Sitemap index and segments |
| `/api/jobs/cancel` | Cancel an in-flight analysis job |
| `/api/auth/[provider]/start`, `/api/auth/callback/[provider]` | OAuth start and callback |

</details>

### Where the data comes from

| Data | Source | Notes |
|---|---|---|
| Stock/crypto OHLCV | [Financial Modeling Prep](https://site.financialmodelingprep.com) | Stocks 5-minute→daily; crypto 5-minute, 1-hour, daily |
| Fundamentals, statements, news, congressional trades | FMP `/stable` | News sentiment is scored in-house with Gemini Flash-Lite |
| Options chain | yahoo-finance2 | Snapshots, OI, IV, Greeks |
| Macroeconomics | FMP + Siglens DB | Indicators, Treasury yields, economic calendar |

## Quick Start

```bash
git clone https://github.com/y0ngha/siglens.git
cd siglens
yarn install          # needs SIGLENS_GITHUB_TOKEN — see below
cp .env.example .env.local
yarn dev              # → http://localhost:4200
```

Requires **Node.js 25.2.1** and **yarn 4.12.0**. `yarn install` resolves `@y0ngha/siglens-core` from GitHub Packages, so `SIGLENS_GITHUB_TOKEN` must exist before you install.

**Keys you cannot boot without:**

| Variable | Where to get it | Used for |
|---|---|---|
| `FMP_API_KEY` | [Financial Modeling Prep](https://site.financialmodelingprep.com/developer) | Prices, search, fundamentals, news |
| `DEEPSEEK_CHAT_API_KEY` | [DeepSeek](https://platform.deepseek.com/api_keys) | DeepSeek models — the default analysis provider |
| `GEMINI_CHAT_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Gemini models, chatbot, options/news/macro reads |
| `ANTHROPIC_CHAT_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Claude models |
| `OPENAI_CHAT_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | ChatGPT models |
| `DATABASE_URL` | [Neon](https://neon.tech) | PostgreSQL |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | [Upstash](https://upstash.com) | Analysis cache, job state, ISR tag store |
| `OAUTH_TOKEN_ENCRYPTION_KEY`, `LLM_API_KEY_ENCRYPTION_KEY`, `OAUTH_STATE_HMAC_SECRET` | `openssl rand -hex 32` | Encrypt stored tokens and user keys; sign OAuth state |
| `CRON_SECRET` | Generate one | Bearer token guarding cron routes and actions |
| `SIGLENS_GITHUB_TOKEN` | [GitHub Tokens](https://github.com/settings/tokens) | Installing `@y0ngha/siglens-core` |

<details>
<summary><b>Optional and operational variables</b></summary>

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_READONLY_TOKEN` | Redis readonly access |
| `TRANSLATE_API_KEY` / `TRANSLATE_MODEL` | Korean asset-name and profile translation |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | Kakao OAuth login |
| `OAUTH_REDIRECT_BASE_URL` | OAuth redirect base |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email delivery |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |
| `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` / `NEXT_PUBLIC_ADSENSE_SLOT_*` / `NEXT_PUBLIC_ADSENSE_ENABLED` | Google AdSense |
| `WORKER_URL` / `WORKER_SECRET` | Cloud Run analysis worker |
| `ISR_CACHE_BUCKET` | S3-backed ISR/fetch cache handler |
| `ALARM_EMAIL` | CloudWatch alarm SNS subscription |
| `DEBUG_VERBOSE_LOGS` | Server-only verbose logging |

</details>

## Architecture

Six-layer Feature-Sliced Design. Imports flow one way only:

```text
app → pages → widgets → features → entities → shared
                                                 ↑
                    @y0ngha/siglens-core — importable from every layer
```

```text
siglens/
├── src/
│   ├── app/              Next.js App Router, RSC, route handlers
│   ├── views/            FSD "pages" layer — page-level composition
│   ├── widgets/          Charts, analysis panels, dashboards
│   ├── features/         Auth, search, chat, portfolio, premium gate
│   ├── entities/         user, session, bars, analysis, ticker, portfolio…
│   └── shared/           UI, config, db, email, api, hooks, lib
├── skills/               Analysis techniques as Markdown
├── docs/                 Architecture, product, domain, conventions
├── e2e/                  Playwright specs and harness
├── cache-handler/        S3-backed ISR/fetch cache handler
├── infra/aws/            Deployment and operations scripts
└── refs/                 Indicator and investment-theory references
```

Two things about this tree surprise people:

**The `pages` layer lives in `src/views/`.** Creating `src/pages/` in an App Router project would activate the legacy Pages Router, so the FSD layer is named `views` instead. The mapping is enforced by `eslint-plugin-boundaries` in `eslint.config.mjs` — violations fail the build, not review.

**`@y0ngha/siglens-core` is not a third-party dependency.** It is Siglens' own analysis domain, extracted into a package: indicator math, pattern detection, signal logic, prompt building. Any layer may import it directly. What belongs there versus here is decided in [SCOPE.md](./docs/architecture/SCOPE.md); the layer rules themselves are in [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md).

## Skills System

Analysis techniques are Markdown, not code:

```text
add skills/<category>/my-strategy.md  →  the technique is live
```

`entities/skill` parses those files and hands the result to the prompt builder in `@y0ngha/siglens-core`, so a new technique never touches calculation code. `yarn validate:skills` enforces the frontmatter contract, and `yarn skills:digest-verify` checks the catalog digest that feeds the analysis cache key.

| Category | Contents |
|---|---|
| `_core/` | Conventions applied across every category |
| `indicators/` | Indicator signal interpretation |
| `patterns/` | Chart patterns |
| `strategies/` | Elliott Wave, grand-cycle analysis |
| `candlesticks/` | Candlestick pattern education |
| `support-resistance/` | Fibonacci, pivot points |
| `fundamental/` | Value, growth, quality perspectives |
| `news/` | Event-driven, macro-impact, earnings reaction |

## Operations

Deployment is tag-driven. Pushing a `v*` tag runs `.github/workflows/deploy.yml`, which gates on typecheck and unit tests, builds and pushes the image to ECR, then rolls the ASG through an instance refresh.

Runs on AWS (ALB + ASG/EC2, ECR, SSM, EventBridge, CloudWatch, S3 ISR cache) with Upstash Redis, Neon PostgreSQL, Resend email, Cloudflare in front, and a Cloud Run worker for long AI jobs.

| When you need to… | Read |
|---|---|
| Deploy, roll back, triage an incident, answer an alarm | [DEPLOY_RUNBOOK.md](./docs/architecture/DEPLOY_RUNBOOK.md) |
| Run AWS scripts, bake a golden AMI, pass the env gate | [infra/aws/README.md](./infra/aws/README.md) |
| Touch the S3 ISR cache, kill switches, or tag store | [ISR_CACHE_HANDLER.md](./docs/architecture/ISR_CACHE_HANDLER.md) |
| Change a page's revalidate window | [ISR_REVALIDATE.md](./docs/architecture/ISR_REVALIDATE.md) |
| Adjust Cloudflare caching, WAF, or bot protection | [CDN_CACHING.md](./docs/architecture/CDN_CACHING.md) |
| Work on the pre-warm cron or its alarms | [CRON.md](./docs/reference/CRON.md) |

## Documentation

Start at **[docs/README.md](./docs/README.md)** for the full index. The ones you will reach for first:

| Document | Contents |
|---|---|
| [SERVICE.md](./docs/product/SERVICE.md) | Service overview, target users, Skills system |
| [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) | Layer structure, dependency rules, data flow |
| [SCOPE.md](./docs/architecture/SCOPE.md) | What belongs in siglens vs siglens-core |
| [DOMAIN.md](./docs/product/DOMAIN.md) | Indicator specs, candle patterns, business rules |
| [AUTH.md](./docs/product/AUTH.md) | Auth, sessions, OAuth, email tokens |
| [API.md](./docs/reference/API.md) | Data/AI APIs and environment variables |
| [CONVENTIONS.md](./docs/conventions/CONVENTIONS.md) | Coding conventions, naming, testing policy |
| [E2E.md](./docs/qa/E2E.md) | Playwright harness, local/CI runs, writing specs |
| [DESIGN.md](./docs/conventions/DESIGN.md) | Color system, Tailwind theme, chart constants |
| [GIT_CONVENTIONS.md](./docs/conventions/GIT_CONVENTIONS.md) | Branch, commit, and PR rules |
| [MISTAKES.md](./docs/workflows/MISTAKES.md) | Recurring mistakes and how to avoid them |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting |

## Testing

```bash
yarn test            # full Vitest suite
yarn test-coverage   # with coverage
yarn test:e2e        # Playwright
```

Roughly 1,000 Vitest files and 41 Playwright specs. The coverage target is **90%**, measured over `entities/`, `features/`, `shared/`, `widgets/`, `app/`, `src/proxy.ts`, and `cache-handler/` — the last one because it is production code living outside `src/`, and leaving it out would let its coverage rot silently. Note that `src/views/` is not currently in the measured set.

E2E runs against a real production build in a browser, separately from Vitest; see [E2E.md](./docs/qa/E2E.md). Note that `git push` triggers a Husky gate running format check, lint, typecheck, unit tests, and a full production build — expect it to take a while.

## Commands

Day to day:

```bash
yarn dev             # dev server on :4200
yarn build           # production build
yarn lint            # ESLint          (lint:fix to autofix)
yarn typecheck       # tsgo            (typecheck:tsc for tsc)
yarn format          # Prettier        (format:check to verify)
yarn test            # Vitest
```

Always install with `yarn`. `npm` and `pnpm` are not used.

<details>
<summary><b>Every script in package.json</b></summary>

| Command | Purpose |
|---|---|
| `yarn dev` | Turbopack dev server on port 4200 |
| `yarn build` | Production build |
| `yarn analyze` | Build with the bundle analyzer |
| `yarn start` | Next.js production server |
| `yarn clear:build` | Remove `.next` output |
| `yarn copy:backtesting` | Copy backtesting JSON into `public/backtesting` |
| `yarn clear:backtesting` | Remove generated `public/backtesting` files |
| `yarn predev` / `yarn prebuild` | Regenerate backtesting files before dev/build |
| `yarn lint` | ESLint |
| `yarn lint:fix` | ESLint with autofix |
| `yarn lint:staged` | ESLint autofix for staged files |
| `yarn lint:style` | Stylelint |
| `yarn lint:style-fix` | Stylelint with autofix |
| `yarn format` | Prettier write |
| `yarn format:staged` | Prettier for staged files |
| `yarn format:check` | Prettier check |
| `yarn typecheck` | Typecheck with `tsgo` |
| `yarn typecheck:tsc` | Typecheck with `tsc` |
| `yarn db:generate` | Generate Drizzle migrations |
| `yarn db:migrate` | Run migrations |
| `yarn db:seed:terms` | Seed terms data |
| `yarn db:migrate:tickers` | Seed/update Korean ticker data |
| `yarn db:seed:crypto` | Seed the FMP crypto universe into `crypto_assets` |
| `yarn db:seed:crypto-korean` | Seed Korean crypto names |
| `yarn db:backfill:calendar` | Backfill the economic calendar |
| `yarn db:seed:calendar-analysis` | Seed economic calendar analysis |
| `yarn db:seed:calendar-analysis:batch` | Batch seed calendar analysis |
| `yarn db:seed:indicator-translations:batch` | Batch seed indicator translations |
| `yarn test` | Full Vitest suite |
| `yarn test:quiet` | Vitest with the dot reporter |
| `yarn test:related` | Vitest for changed files |
| `yarn test-watch` | Vitest watch mode |
| `yarn test-coverage` | Vitest with coverage |
| `yarn test-coverage-watch` | Coverage in watch mode |
| `yarn test-coverage-report` | Verbose coverage report |
| `yarn e2e` | Run the E2E harness script |
| `yarn e2e:up` / `yarn e2e:down` | Start / tear down the E2E Compose stack |
| `yarn e2e:db` | E2E DB global setup |
| `yarn test:e2e` | Playwright tests |
| `yarn test:e2e:ui` | Playwright UI mode |
| `yarn validate:skills` | Validate Skills Markdown |
| `yarn skills:digest-verify` | Verify the Skills digest |
| `yarn skills:digest-update` | Update Skills digest metadata |
| `yarn prepare` | Install Husky hooks |
| `yarn release` | release-it |
| `yarn release:patch` / `:minor` / `:major` | Versioned releases |
| `yarn fetch-this-week-tasks` | Weekly task fetch script |
| `yarn update-popular-tickers` | Refresh the popular ticker list |
| `yarn update-popular-cryptos` | Refresh the popular crypto list |

</details>

## Security

Please don't open a public issue for a vulnerability — [SECURITY.md](./SECURITY.md) has the reporting process.

## Contributing

External code contribution isn't formally open yet. Bug reports and suggestions are welcome in [Issues](https://github.com/y0ngha/siglens/issues).

Skills have no public review-and-merge workflow yet either. The system is deliberately built so that one Markdown file extends the analysis, and a contribution guide will follow once the frontmatter standard and validation are settled.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE)

---

<div align="center">

**[Back to top](#siglens)** · **[한국어 README](https://github.com/y0ngha/siglens/blob/master/README.ko.md)**

</div>
