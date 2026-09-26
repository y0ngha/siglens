# Ad Landing Pages — Design

Date: 2026-09-26
Branch: `feat/ad-landing-pages`

## Why

Google Ads (Korea) flags ads whose landing page mentions crypto ("암호화폐" policy:
certification required, only exchanges/wallets can get it). Current landings:

- Campaign A `AI 주식 분석` → `https://siglens.io/` — status "정책(암호화폐)" (limited). The home
  page mentions 코인/암호화폐 ~27 times.
- Campaign B `챗GPT 제미나이 주식` / `주식 AI 챗봇` → `https://ai.siglens.io/about` — one approved,
  one disapproved (appeal rejected); the page mentions 코인/비트코인 ~8 times.
- Both sites' global header/footer carry "암호화폐" menu items on every page.

Goal: two ad-only landing pages with no crypto wording anywhere on the page (body, header,
footer), not indexed, used as final URLs for the stock ad groups.

## Pages

| Host | Path | Used by |
|---|---|---|
| siglens.io | `/lp/stock-analysis` | A `AI 주식 분석` ad group |
| ai.siglens.io | `/lp/stock-chat` | B `챗GPT 제미나이 주식` (and `주식 AI 챗봇` if re-enabled) |

Korean only. No locale segment, no i18n catalog entries (copy is hard-coded Korean in the lp
tree; this is an intentional exception to the i18n rule because the pages exist only for
Korean ads and are noindex).

## Routing — a separate root

New App Router root at `src/app/lp/`, sibling to `src/app/[locale]/` and `src/app/ai/`:

- `src/app/lp/layout.tsx` — own `<html lang="ko">`/`<body>`, fonts + `globals.css`, theme init
  script, `GoogleAdsTag` (conversion tracking stays), minimal header, minimal footer. No
  `AuthSessionHeaderClient`, no global `Footer`, no search overlay, no nav verticals, no
  `NextIntlClientProvider`.
- `src/app/lp/stock-analysis/page.tsx`
- `src/app/lp/stock-chat/page.tsx`
- Existing `[locale]` and `ai` layouts, the global header and footer are not modified.

`src/proxy.ts`:
- siglens host: `/lp/*` passes through untouched — add `lp` to `RESERVED_FIRST_SEGMENTS` so it is
  never treated as a ticker (uppercase 301) or locale-rewritten. `/lp/stock-chat` on this host → 404.
- ai host: `/lp/*` is rewritten to `/lp/*` (not `/ai/[locale]/*`); `/lp/stock-analysis` on the ai
  host → 404. Any other `/lp/*` path → 404 on both hosts.
- The existing uppercase-301 scanner test (scans `src/app` route dirs) must keep passing with the
  new `lp` segment.

## Indexing

- `robots: { index: false, follow: false }`, no canonical, no alternates, no JSON-LD.
- Not in any sitemap (no nav link, not in `buildStaticEntries`).
- `X-Robots-Tag: noindex, nofollow` response header for `/lp/*` as a second layer (set in proxy).

## Minimal chrome

- Header: SIGLENS logo (links to the page itself, not the site home — the home carries crypto
  wording) + one CTA button.
  - stock-analysis CTA: "종목 분석 시작" → `https://siglens.io/NVDA`
  - stock-chat CTA: "AI에게 물어보기" → `https://ai.siglens.io/`
- Footer: 개인정보처리방침 (`https://siglens.io/privacy`), 이용약관 (`https://siglens.io/terms`),
  one-line disclaimer "투자 권유가 아닌 참고용 정보입니다. 투자 판단은 본인 책임입니다."

## Content (no crypto wording)

`/lp/stock-analysis`:
1. Hero — "티커 하나로 AI 종합 분석" / sub: 미국 주식과 한국 주식의 차트, 재무, 뉴스, 옵션을 모아
   AI가 정리합니다. CTA.
2. Four feature cards — 차트 지표 AI 해석 (RSI, MACD, 볼린저밴드), 지지선과 저항선 정리,
   공포탐욕지수 (미국과 한국), 옵션과 재무, 뉴스.
3. Popular tickers — NVDA, AAPL, TSLA, 005930.KS(삼성전자), 000660.KS(SK하이닉스), linking to
   `https://siglens.io/<symbol>`.
4. Disclaimer block.

`/lp/stock-chat`:
1. Hero — "주식 전용 AI 챗봇" / sub: 시세와 차트를 직접 조회하고 출처와 기준 시각을 함께
   알려줘요. CTA.
2. Example questions — "삼성전자 요즘 어때?", "엔비디아 지금 비싼 편?", "이번 주 미국 시장 뉴스
   중요한 것만" (display only; the CTA opens the chat).
3. How it answers — 시세 직접 조회 / 지표는 규칙으로 계산 / 답변마다 출처와 기준 시각.
4. FAQ (3 items, no crypto): 어떤 종목을 물어볼 수 있나요 (미국 주식과 ETF, 코스피와 코스닥 종목),
   돈이 드나요 (무료, 로그인하면 더 많이), 투자 추천을 해주나요 (아니요, 데이터로 설명).
5. Disclaimer block.

Copy rules: no middle dot (·), no em dash (—), no 가입/로그인 없이 무료 phrasing.

Reuse existing presentational pieces from `src/views/about` / `src/views/ai-about` only if they
take plain props without pulling nav, i18n or crypto data; otherwise write small local
components under `src/views/lp/` (FSD: views layer).

## Guard

A unit test renders both pages and fails if the rendered text (script tags stripped) matches
`/코인|비트코인|이더리움|암호화폐|가상자산|크립토|crypto|bitcoin/i`. Same check in the E2E
spec against the server HTML with `<script>` removed.

## Tests

- proxy: siglens `/lp/stock-analysis` passes through; ai `/lp/stock-chat` rewrites to `/lp/stock-chat`;
  cross-host and unknown `/lp/*` → 404; `X-Robots-Tag` set; `lp` reserved (no uppercase 301).
- pages: metadata robots noindex/nofollow, no canonical; crypto guard; CTA hrefs.
- sitemap: no `/lp` entries.
- E2E: both pages render 200 on their host with the guard.

## After deploy (ads)

- A `AI 주식 분석` RSA final URL → `https://siglens.io/lp/stock-analysis`.
- B `챗GPT 제미나이 주식` and `주식 AI 챗봇` RSA final URLs → `https://ai.siglens.io/lp/stock-chat`;
  re-enable `주식 AI 챗봇` if review passes.
- Other A groups (fear-greed, per-symbol, options, charts) keep their current final URLs.

## Out of scope

- Other locales, A/B testing, analytics beyond the existing Google Ads tag.
