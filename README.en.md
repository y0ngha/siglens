# Siglens

<div align="center">

![Status](https://img.shields.io/badge/status-production-brightgreen)
![License](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue)

![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat&logo=amazonaws&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash-00E9A3?style=flat&logo=upstash&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?style=flat&logo=neon&logoColor=white)
![Resend](https://img.shields.io/badge/Resend-000000?style=flat&logo=resend&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white)

![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D25.2.1-green)

## AI Technical Analysis Platform for US Stocks and Crypto

[![Website](https://img.shields.io/badge/Website-siglens.io-blue?style=for-the-badge)](https://siglens.io)
[![Korean](https://img.shields.io/badge/README-Korean-white?style=for-the-badge)](https://github.com/y0ngha/siglens/blob/master/README.md)
[![Docs](https://img.shields.io/badge/Docs-Read%20Docs-green?style=for-the-badge)](https://github.com/y0ngha/siglens/tree/master/docs)
[![Issues](https://img.shields.io/badge/Issues-Report%20Bug-red?style=for-the-badge)](https://github.com/y0ngha/siglens/issues)

</div>

---

## What Is Siglens?

Siglens is an analysis-only service that uses AI to summarize technical analysis for US stocks and cryptocurrencies.

It automates the work of interpreting many indicators at once, including moving averages, MACD, RSI, Bollinger Bands, DMI, candlestick patterns, and chart patterns. Enter a ticker to view charts, indicators, AI reports, news summaries, fear-greed signals, and consolidated scenarios in one place.

For equities, Siglens also covers fundamentals, financial statements, congressional trading, and options-market data. For crypto, it focuses on 24/7 market data through chart, news, fear-greed, and overall analysis pages.

```text
Traditional workflow    Add indicators manually -> read volume -> inspect patterns -> make a final judgment
Siglens                 Enter ticker -> render chart/indicators -> receive an AI analysis report
```

Siglens does not provide order execution. It provides analysis only, and investment decisions are the user's own responsibility.

## Status

Siglens is deployed in production at [siglens.io](https://siglens.io).

## Core Features

- Charts: Candles, volume, technical indicators, and asset-aware multi-timeframe rendering with Lightweight Charts v5
- Asset coverage: US-listed stocks/ETFs/indices and major cryptocurrency symbols
- Indicators: RSI, MACD, Bollinger Bands, ADX, DMI, Stochastic, StochRSI, CCI, VWAP, MA, EMA, Volume Profile, Ichimoku Cloud, ATR, Donchian/Keltner Channel, SuperTrend, OBV, CMF, MFI, Parabolic SAR, Williams %R, Squeeze Momentum, Smart Money Concepts, and more
- Candlestick and chart patterns: Skill-driven detection for single and multi-candle patterns, head and shoulders, wedges, double tops/bottoms, triangles, flags, cup and handle, and more
- AI overall analysis: Korean reports that combine technical analysis, news, and fear-greed signals, with equity-only extensions for fundamentals, financials, options, and congressional trading
- Equity-only analysis: Fundamentals, financial statements, analyst consensus, options chains, Max Pain, Put/Call Ratio, ATM IV, Implied Move, and congressional trading trends
- AI model selection: Claude, Gemini, and ChatGPT models can be selected per analysis page
- BYOK: Users can store encrypted Anthropic, Google, and OpenAI API keys and call models with their own keys
- Accounts and tiers: Anonymous usage by default, with account-based model access, limits, and BYOK features
- AI chatbot: Follow-up natural-language questions grounded in the current analysis result
- Market dashboard: Golden cross, RSI divergence, and Bollinger squeeze scans across 200+ stocks in 11 sectors
- Market news hub: AI news digest for general US, stocks, crypto, forex, and market article categories
- Economy dashboard: US rates, CPI, employment, GDP, Treasury yields, economic calendar, and AI macro briefing
- AI backtesting: Return validation over 100 historical AI analyses from 2024.04 to 2026.04

## Main Pages

### Symbol Pages

| Route | Equities | Crypto | Description |
|---|---:|---:|---|
| `/[symbol]` | Yes | Yes | Chart, technical analysis, and AI report |
| `/[symbol]/news` | Yes | Yes | Symbol-specific news and AI sentiment |
| `/[symbol]/fear-greed` | Yes | Yes | Symbol-specific fear-greed index |
| `/[symbol]/overall` | Yes | Yes | Consolidated analysis using the data axes supported by each asset class |
| `/[symbol]/fundamental` | Yes | No | Fundamentals, valuation, and analyst consensus |
| `/[symbol]/financials` | Yes | No | Income statement, balance sheet, cash flow, and growth analysis |
| `/[symbol]/congress` | Yes | No | Congressional trading trend analysis from US Senate and House disclosures |
| `/[symbol]/options` | Yes | No | Options chain, open interest distribution, Max Pain, and IV-based analysis |

### Product Pages

| Route | Description |
|---|---|
| `/market` | Sector market signal dashboard |
| `/economy` | US macro indicators, Treasury yields, economic calendar, and AI macro briefing |
| `/news` | Category-based market news hub |
| `/news/[category]` | General, stock, crypto, forex, and market news category pages |
| `/backtesting` | AI analysis backtesting results |
| `/share/[id]` | Shareable analysis snapshots |

## Data Sources

| Data | Source | Notes |
|---|---|---|
| Stock/crypto OHLCV | [Financial Modeling Prep](https://site.financialmodelingprep.com) | Stock 5-minute to daily bars; crypto 5-minute, 1-hour, and daily bars |
| Equity fundamentals | FMP `/stable` API | PER, ROE, EPS, consensus, price targets, peer/sector data |
| Financial statements | FMP `/stable` API | Income statement, balance sheet, cash flow, and growth rates |
| News/earnings | FMP `/stable` API | Stock/crypto news sentiment is analyzed in-house with Gemini Flash-Lite |
| Congressional trades | FMP `/stable` API | Senate and House disclosure-based trades |
| Options chain | yahoo-finance2 | Equity options snapshots, OI, IV, and Greeks |
| Macroeconomics | FMP + Siglens DB | US economic indicators, Treasury yields, and economic calendar |

## External Services

Siglens depends on the following external infrastructure and services.

| Service | Purpose |
|---|---|
| AWS | ALB, ASG/EC2, ECR, SSM Parameter Store, CloudWatch Logs/Alarms, S3 ISR cache |
| Upstash | Redis-backed analysis cache, job state, email/auth tokens |
| Neon | PostgreSQL database |
| Resend | Email verification and password reset emails |
| Cloudflare | DNS, edge security, caching/traffic management, Web Analytics |
| Google Cloud Run worker | Long-running AI analysis worker calls |

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16.2, App Router, Turbopack, React Compiler |
| UI | React 19.2, Tailwind CSS 4 |
| Chart | Lightweight Charts v5, custom SVG options OI chart |
| State | TanStack Query v5 |
| AI | Anthropic Claude, Google Gemini, OpenAI ChatGPT |
| Auth | bcryptjs, Google OAuth, Kakao OAuth, encrypted session cookies |
| Database | Drizzle ORM, Neon PostgreSQL |
| Cache | Upstash Redis, Next.js ISR/Data Cache, S3 cache handler |
| Testing | Vitest, Testing Library, jsdom, Playwright |
| Language | TypeScript 5 |
| Package Manager | yarn 4.12.0 |
| Runtime | Node.js 25.2.1 |
| Deploy | AWS ALB + ASG/EC2 + ECR, Cloudflare, Cloud Run worker |

## Quick Start

### Prerequisites

```bash
Node.js 25.2.1
yarn 4.12.0
```

### Installation

```bash
git clone https://github.com/y0ngha/siglens.git
cd siglens
yarn install
```

### Environment

```bash
cp .env.example .env.local
```

Required environment variables:

| Variable | Provider | Purpose |
|---|---|---|
| `FMP_API_KEY` | [Financial Modeling Prep](https://site.financialmodelingprep.com/developer) | Stock/crypto prices, search, fundamentals, and news data |
| `GEMINI_CHAT_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Gemini models, chatbot, options/news/macro interpretation |
| `ANTHROPIC_CHAT_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Claude models |
| `OPENAI_CHAT_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | ChatGPT models |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | [Upstash](https://upstash.com) | Redis cache and job state |
| `DATABASE_URL` | [Neon](https://neon.tech) | PostgreSQL |
| `OAUTH_TOKEN_ENCRYPTION_KEY` / `LLM_API_KEY_ENCRYPTION_KEY` | `openssl rand -hex 32` | Encrypt stored OAuth tokens and user API keys |
| `OAUTH_STATE_HMAC_SECRET` | `openssl rand -hex 32` | Sign OAuth state cookies |
| `CRON_SECRET` | Self-generated | Bearer token for protected cron/actions |
| `SIGLENS_GITHUB_TOKEN` | [GitHub Tokens](https://github.com/settings/tokens) | GitHub Packages token for installing `@y0ngha/siglens-core` |

Optional/operations environment variables:

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_READONLY_TOKEN` | Redis readonly access |
| `TRANSLATE_API_KEY` / `TRANSLATE_MODEL` | Korean asset-name/profile translation |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | Kakao OAuth login |
| `OAUTH_REDIRECT_BASE_URL` | OAuth redirect base URL |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email sending |
| `NEXT_PUBLIC_SITE_URL` | Site canonical URL |
| `NEXT_PUBLIC_ADSENSE_*` | Google AdSense |
| `WORKER_URL` / `WORKER_SECRET` | Cloud Run worker calls |
| `ISR_CACHE_BUCKET` | AWS S3-backed ISR/fetch cache handler |
| `ALARM_EMAIL` | CloudWatch alarm SNS email subscription |
| `DEBUG_VERBOSE_LOGS` | Server-only verbose debug logs |

### Development Server

```bash
yarn dev
```

Open http://localhost:4200.

## Architecture

Siglens uses a six-layer Feature-Sliced Design structure.

```text
app -> pages -> widgets -> features -> entities -> shared
                                                   ^
                           @y0ngha/siglens-core can be imported directly from every layer
```

```text
siglens/
├── src/
│   ├── app/              Next.js App Router, RSC, Route Handlers
│   ├── widgets/          Charts, analysis panels, dashboards, composed page UI
│   ├── features/         Auth, search, chat, premium gate, and user-facing features
│   ├── entities/         user, session, bars, analysis, ticker, and domain entities
│   └── shared/           Shared UI, config, db, email, api, hooks, lib
├── skills/               Markdown definitions for analysis techniques
├── docs/                 Architecture, product, domain, and convention docs
├── infra/aws/            AWS deployment and operations scripts
└── refs/                 Indicator and investment theory references
```

The main analysis domain logic lives in `@y0ngha/siglens-core`. This package is not treated as a generic third-party dependency; it is the extracted Siglens analysis core and may be imported directly from all FSD layers.

See [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) and [SCOPE.md](./docs/architecture/SCOPE.md) for the detailed rules.

## Skills System

Analysis techniques are defined as Markdown files under `skills/`, not hard-coded into the app.

```text
/skills/<category>/my-strategy.md file added -> new analysis technique available
```

`entities/skill` reads the Markdown files and forwards parsed Skill data into the prompt builder in `@y0ngha/siglens-core`. This makes it possible to add or refine analysis techniques without changing domain calculation code.

Current categories:

- `skills/patterns/`: chart patterns
- `skills/indicators/`: technical indicator signal interpretation
- `skills/strategies/`: Elliott Wave, grand-cycle analysis, and related strategies
- `skills/support-resistance/`: Fibonacci, pivot points
- `skills/candlesticks/`: candlestick pattern education
- `skills/fundamental/`: value, growth, and quality-investing perspectives
- `skills/news/`: event-driven, macro-impact, and earnings-reaction analysis

## Documentation

| Document | Contents |
|---|---|
| [SERVICE.md](./docs/product/SERVICE.md) | Service overview, target users, tech stack, Skills system |
| [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) | FSD layer structure, dependency rules, data flow |
| [SCOPE.md](./docs/architecture/SCOPE.md) | Responsibility split between siglens and siglens-core |
| [AUTH.md](./docs/product/AUTH.md) | Auth, sessions, OAuth, email token flow |
| [DOMAIN.md](./docs/product/DOMAIN.md) | Indicator calculation specs, candle patterns, Skills system |
| [API.md](./docs/reference/API.md) | Data/AI APIs and environment variables |
| [CONVENTIONS.md](./docs/conventions/CONVENTIONS.md) | Coding conventions, naming, testing policy |
| [E2E.md](./docs/qa/E2E.md) | Playwright E2E harness, local/CI execution, spec authoring guide |
| [DESIGN.md](./docs/conventions/DESIGN.md) | Color system, Tailwind configuration, chart color constants |
| [GIT_CONVENTIONS.md](./docs/conventions/GIT_CONVENTIONS.md) | Branch, commit message, and PR rules |
| [MISTAKES.md](./docs/workflows/MISTAKES.md) | Recurring mistakes and prevention rules |
| [infra/aws/README.md](./infra/aws/README.md) | AWS operations scripts and deployment procedure |

## Testing

```bash
yarn test                    # full test suite
yarn test-watch              # watch mode
yarn test-coverage           # with coverage
yarn test-coverage-report    # detailed coverage report
yarn test:e2e                # Playwright E2E
```

The coverage target is 90% across the full FSD layer surface. Vitest coverage currently includes `entities/`, `features/`, `shared/`, `widgets/`, `app/`, and `src/proxy.ts`.

Playwright E2E runs separately from the Vitest suite to verify real browser journeys. See [E2E.md](./docs/qa/E2E.md) for harness details and local/CI execution.

## Commands

This is the full `package.json` scripts list.

| Command | Purpose |
|---|---|
| `yarn copy:backtesting` | Copy the backtesting JSON into `public/backtesting` |
| `yarn clear:backtesting` | Remove generated `public/backtesting` files |
| `yarn predev` | Regenerate backtesting files before the dev server starts |
| `yarn prebuild` | Regenerate backtesting files before build |
| `yarn clear:build` | Remove `.next` build output |
| `yarn dev` | Run the Turbopack dev server on port 4200 |
| `yarn build` | Build for production |
| `yarn analyze` | Build with bundle analyzer enabled |
| `yarn start` | Run the Next.js production server |
| `yarn lint` | Run ESLint |
| `yarn lint:fix` | Run ESLint with auto-fix |
| `yarn lint:staged` | Run ESLint auto-fix for staged files |
| `yarn lint:style` | Run Stylelint |
| `yarn lint:style-fix` | Run Stylelint with auto-fix |
| `yarn db:generate` | Generate Drizzle migrations |
| `yarn db:migrate` | Run DB migrations |
| `yarn db:seed:terms` | Seed terms data |
| `yarn db:migrate:tickers` | Seed/update Korean ticker data |
| `yarn db:seed:crypto` | Seed the FMP crypto universe into `crypto_assets` |
| `yarn db:seed:crypto-korean` | Seed Korean crypto names |
| `yarn db:backfill:calendar` | Backfill the economic calendar |
| `yarn db:seed:calendar-analysis` | Seed economic calendar analysis |
| `yarn db:seed:calendar-analysis:batch` | Batch seed economic calendar analysis |
| `yarn db:seed:indicator-translations:batch` | Batch seed economic indicator translations |
| `yarn test` | Run the full Vitest suite |
| `yarn test:quiet` | Run Vitest with the dot reporter |
| `yarn test:related` | Run related Vitest tests |
| `yarn test-watch` | Run Vitest in watch mode |
| `yarn test-coverage` | Run Vitest with coverage |
| `yarn test-coverage-watch` | Run Vitest coverage in watch mode |
| `yarn test-coverage-report` | Run the detailed coverage report |
| `yarn e2e` | Run the E2E harness script |
| `yarn e2e:up` | Start the E2E Docker Compose environment |
| `yarn e2e:down` | Stop the E2E Docker Compose environment and remove volumes |
| `yarn e2e:db` | Run E2E DB global setup |
| `yarn test:e2e` | Run Playwright E2E tests |
| `yarn test:e2e:ui` | Run Playwright UI mode |
| `yarn format` | Format the repo with Prettier |
| `yarn format:staged` | Format staged files with Prettier |
| `yarn typecheck` | Run TypeScript typecheck |
| `yarn validate:skills` | Validate Skills Markdown files |
| `yarn skills:digest-verify` | Verify the Skills digest |
| `yarn skills:digest-update` | Update Skills digest metadata |
| `yarn format:check` | Run Prettier check |
| `yarn prepare` | Install Husky hooks |
| `yarn release` | Run release-it |
| `yarn release:patch` | Create a patch release |
| `yarn release:minor` | Create a minor release |
| `yarn release:major` | Create a major release |
| `yarn fetch-this-week-tasks` | Run the weekly task fetch script |
| `yarn update-popular-tickers` | Update the popular ticker list |
| `yarn update-popular-cryptos` | Update the popular crypto list |

Always use `yarn` for package installation. Do not use `npm` or `pnpm`.

## Contributing

External code contribution is not formally open yet. Please use [Issues](https://github.com/y0ngha/siglens/issues) for bug reports or suggestions.

Skills contributions also do not have a public review and merge workflow yet. The system is designed so adding one Markdown file under `skills/` can extend analysis techniques, but contribution guidance will be published after the frontmatter standard and validation process are finalized.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE)

---

<div align="center">

**[Back to top](#siglens)** · **[Korean README](https://github.com/y0ngha/siglens/blob/master/README.md)**

</div>
