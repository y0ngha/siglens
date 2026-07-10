# www Apex and Symbol SSR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent `www.siglens.io` to apex redirect and strengthen crawler-visible SSR factual content on the `news` and `overall` symbol pages.

> **[2026-07-10 update — www redirect moved to Cloudflare]** The `www -> apex` 301 redirect
> is now implemented as a **Cloudflare dashboard Redirect Rule** (`http.host eq "www.siglens.io"`
> → `concat("https://siglens.io", http.request.uri.path)`, 301, preserve query string), not the
> AWS ALB listener rule below. Cloudflare 301s at the edge, so requests never reach the ALB.
> `infra/aws/reconcile-www-redirect.sh`, its test, the CI/deploy integration, and the ALB IAM
> permissions have been removed. The ACM `www.siglens.io` SAN (`infra/aws/03-acm.sh`) is kept
> defensively for grey-cloud fallback. The ALB-based tasks below are retained as history.

**Architecture:** Canonicalize the `www` host at the AWS ALB HTTPS listener before requests reach Next.js. Add small server-safe factual summary components that reuse data already fetched by the page RSCs, avoiding new external calls and avoiding hidden SEO text.

**Tech Stack:** AWS ALB shell provisioning, Next.js App Router RSC, TypeScript, Vitest, React Testing Library, existing FSD layer rules.

---

## File Structure

- Modify `infra/aws/06-alb-asg.sh`
  - Ensure an idempotent HTTPS listener rule redirects `Host: www.siglens.io` to `https://siglens.io/#{path}?#{query}` with `HTTP_301`.
- Create `src/widgets/news/NewsFactsSummary.tsx`
  - Server-safe visible factual summary for `/[symbol]/news`.
- Create `src/widgets/news/__tests__/NewsFactsSummary.test.tsx`
  - Component tests for populated, empty, equity, crypto, and sentiment branches.
- Modify `src/widgets/news/index.ts`
  - Export `NewsFactsSummary`.
- Modify `src/app/[symbol]/news/page.tsx`
  - Render `NewsFactsSummary` directly below `SymbolPageHeading`, using the existing `newsItems` fetch.
- Modify `src/app/[symbol]/news/__tests__/page.body.test.tsx`
  - Assert the page wires `NewsFactsSummary` with the existing server-fetched news items and asset-class branch.
- Create `src/widgets/overall/OverallFactualFallback.tsx`
  - Server-safe fallback content for `/[symbol]/overall` when `cachedOverall` is absent.
- Create `src/widgets/overall/__tests__/OverallFactualFallback.test.tsx`
  - Component tests for equity, crypto, populated news, empty news, and enrichment count branches.
- Modify `src/widgets/overall/index.ts`
  - Export `OverallFactualFallback`.
- Modify `src/app/[symbol]/overall/page.tsx`
  - Replace cache-miss skeleton-only fallback with `OverallFactualFallback`.
- Modify `src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx`
  - Update cache-miss assertions to expect `OverallFactualFallback`.
- Verify `docs/superpowers/specs/2026-07-08-www-apex-and-symbol-ssr-design.md`
  - Confirm no spec drift after implementation.

## Task 1: Add ALB www to Apex 301 Rule

**Files:**
- Modify: `infra/aws/06-alb-asg.sh`

- [ ] **Step 1: Inspect the current listener setup**

Read the current HTTPS listener block in `infra/aws/06-alb-asg.sh`. Keep the existing create-listener behavior intact:

```bash
sed -n '1,90p' infra/aws/06-alb-asg.sh
```

Expected: the script creates or reuses `siglens-alb`, creates or reuses `siglens-tg`, and creates HTTPS listener port `443` with a default forward action.

- [ ] **Step 2: Add an idempotent redirect rule helper**

After the HTTPS listener creation block, add this code. It must run after a listener exists and before ASG creation starts:

```bash
HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[?Port==`443`].ListenerArn | [0]' --output text)

WWW_REDIRECT_RULE_ARN=$(aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER_ARN" \
  --query "Rules[?Conditions[?Field=='host-header' && contains(HostHeaderConfig.Values, 'www.siglens.io')]].RuleArn | [0]" \
  --output text 2>/dev/null) || true

if [ "$WWW_REDIRECT_RULE_ARN" = "None" ] || [ -z "$WWW_REDIRECT_RULE_ARN" ]; then
  aws elbv2 create-rule --listener-arn "$HTTPS_LISTENER_ARN" --priority 10 \
    --conditions Field=host-header,Values=www.siglens.io \
    --actions 'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,Host=siglens.io,Path=/#{path},Query=#{query},StatusCode=HTTP_301}' >/dev/null
  log "www.siglens.io -> siglens.io redirect rule created"
else
  log "www.siglens.io -> siglens.io redirect rule exists ($WWW_REDIRECT_RULE_ARN)"
fi
```

If AWS reports priority `10` already in use, replace `--priority 10` with a currently unused priority and add a comment explaining why that value is reserved for host canonicalization.

- [ ] **Step 3: Validate shell syntax**

Run:

```bash
bash -n infra/aws/06-alb-asg.sh
```

Expected: command exits `0` with no output.

- [ ] **Step 4: Document manual/live verification commands in the implementation notes**

Use these commands after deployment or after manually running `infra/aws/06-alb-asg.sh` in the production AWS environment:

```bash
curl -sS -D - -o /dev/null https://www.siglens.io/
curl -sS -D - -o /dev/null 'https://www.siglens.io/AAPL?tf=1Day'
curl -sS -D - -o /dev/null https://www.siglens.io/sitemap.xml
curl -sS -L -D - -o /dev/null 'http://www.siglens.io/AAPL?tf=1Day'
curl -sS https://siglens.io/AAPL/news | rg '최신 뉴스|뉴스 데이터|canonical'
curl -sS https://siglens.io/AAPL/overall | rg '종합 분석|최근 뉴스|canonical'
```

Expected:

```text
https://www.siglens.io/* -> 301 Location: https://siglens.io/*
http://www.siglens.io/*  -> Cloudflare 301 to https://www... then ALB 301 to https://siglens.io/*
```

## Task 2: Add NewsFactsSummary Component

**Files:**
- Create: `src/widgets/news/NewsFactsSummary.tsx`
- Create: `src/widgets/news/__tests__/NewsFactsSummary.test.tsx`
- Modify: `src/widgets/news/index.ts`

- [ ] **Step 1: Write the failing component tests**

Create `src/widgets/news/__tests__/NewsFactsSummary.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { NewsFactsSummary } from '@/widgets/news';

function item(overrides: Partial<NewsDisplayItem> = {}): NewsDisplayItem {
    return {
        id: overrides.id ?? 'n1',
        publishedAt: overrides.publishedAt ?? '2026-07-08T10:00:00.000Z',
        titleEn: overrides.titleEn ?? 'Apple supplier shares rise',
        titleKo: overrides.titleKo ?? null,
        sentiment: overrides.sentiment ?? null,
        category: overrides.category ?? null,
        bodyKo: overrides.bodyKo ?? null,
        summaryKo: overrides.summaryKo ?? null,
        priceImpact: overrides.priceImpact ?? null,
        url: overrides.url ?? 'https://example.com/news',
        source: overrides.source ?? 'Example',
    };
}

describe('NewsFactsSummary', () => {
    it('renders count, latest date, analyzed count, and recent headlines', () => {
        render(
            <NewsFactsSummary
                symbol="AAPL"
                displayName="Apple Inc."
                assetClass="equity"
                items={[
                    item({
                        id: 'n1',
                        titleKo: '애플 공급망 뉴스',
                        sentiment: 'bullish',
                    }),
                    item({
                        id: 'n2',
                        titleEn: 'Apple analyst note',
                        sentiment: 'neutral',
                    }),
                    item({
                        id: 'n3',
                        titleEn: 'Apple regulation concern',
                        sentiment: 'bearish',
                    }),
                ]}
            />
        );

        expect(
            screen.getByRole('heading', {
                name: 'Apple Inc. 최근 뉴스 데이터 요약',
            })
        ).toBeInTheDocument();
        expect(screen.getByText(/최근 뉴스 3건/)).toBeInTheDocument();
        expect(screen.getByText(/최신 기사는/)).toBeInTheDocument();
        expect(screen.getByText(/AI 뉴스 카드 분석은 3건/)).toBeInTheDocument();
        expect(screen.getByText(/긍정 1건/)).toBeInTheDocument();
        expect(screen.getByText(/중립 1건/)).toBeInTheDocument();
        expect(screen.getByText(/부정 1건/)).toBeInTheDocument();
        expect(screen.getByText('애플 공급망 뉴스')).toBeInTheDocument();
        expect(screen.getByText('Apple analyst note')).toBeInTheDocument();
    });

    it('renders an honest empty state without fabricated analysis', () => {
        render(
            <NewsFactsSummary
                symbol="AAPL"
                displayName="Apple Inc."
                assetClass="equity"
                items={[]}
            />
        );

        expect(
            screen.getByText(
                /Apple Inc. 최신 뉴스 데이터가 아직 준비되지 않았습니다/
            )
        ).toBeInTheDocument();
        expect(screen.queryByText(/긍정/)).not.toBeInTheDocument();
    });

    it('uses crypto-specific support copy for crypto assets', () => {
        render(
            <NewsFactsSummary
                symbol="BTCUSD"
                displayName="Bitcoin"
                assetClass="crypto"
                items={[item({ titleEn: 'Bitcoin ETF flow update' })]}
            />
        );

        expect(
            screen.getByText(/코인 뉴스의 핵심 이슈와 분위기/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/어닝 일정/)).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
yarn vitest run src/widgets/news/__tests__/NewsFactsSummary.test.tsx
```

Expected: FAIL because `NewsFactsSummary` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/widgets/news/NewsFactsSummary.tsx`:

```tsx
import type { NewsDisplayItem } from '@/shared/lib/types';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';

interface NewsFactsSummaryProps {
    symbol: string;
    displayName: string;
    assetClass: string;
    items: readonly NewsDisplayItem[];
}

const MAX_HEADLINES = 5;

const SENTIMENT_LABEL = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
} as const;

function getHeadline(item: NewsDisplayItem): string {
    return item.titleKo ?? item.titleEn;
}

function countSentiment(
    items: readonly NewsDisplayItem[],
    sentiment: NonNullable<NewsDisplayItem['sentiment']>
): number {
    return items.filter(item => item.sentiment === sentiment).length;
}

export function NewsFactsSummary({
    symbol,
    displayName,
    assetClass,
    items,
}: NewsFactsSummaryProps) {
    const isCrypto = assetClass === 'crypto';
    const analyzedCount = items.filter(item => item.sentiment !== null).length;
    const latest = items[0];
    const latestText = latest
        ? formatNewsPublishedAt(latest.publishedAt)
        : null;
    const bullish = countSentiment(items, 'bullish');
    const neutral = countSentiment(items, 'neutral');
    const bearish = countSentiment(items, 'bearish');
    const headlines = items.slice(0, MAX_HEADLINES);

    return (
        <section
            aria-labelledby={`${symbol}-news-facts-heading`}
            className="border-secondary-800 bg-secondary-800/30 space-y-3 rounded-lg border p-5"
        >
            <h2
                id={`${symbol}-news-facts-heading`}
                className="text-secondary-300 text-base font-semibold"
            >
                {displayName} 최근 뉴스 데이터 요약
            </h2>
            {items.length === 0 ? (
                <p className="text-secondary-400 text-sm leading-relaxed">
                    {displayName} 최신 뉴스 데이터가 아직 준비되지 않았습니다.
                    뉴스 카드가 분석되면 최근 기사와 분위기 요약이 이 영역에
                    표시됩니다.
                </p>
            ) : (
                <>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        {displayName} ({symbol}) 페이지는 최근 뉴스 {items.length}
                        건을 기준으로 구성되어 있습니다.
                        {latestText ? ` 최신 기사는 ${latestText} 기준입니다.` : ''}{' '}
                        AI 뉴스 카드 분석은 {analyzedCount}건 완료됐습니다.
                    </p>
                    {analyzedCount > 0 && (
                        <p className="text-secondary-400 text-sm leading-relaxed">
                            분석된 뉴스 분위기는 {SENTIMENT_LABEL.bullish}{' '}
                            {bullish}건, {SENTIMENT_LABEL.neutral} {neutral}건,{' '}
                            {SENTIMENT_LABEL.bearish} {bearish}건입니다.
                        </p>
                    )}
                    <ul className="space-y-1.5">
                        {headlines.map(item => (
                            <li
                                key={item.id}
                                className="text-secondary-400 text-sm leading-relaxed"
                            >
                                {getHeadline(item)}
                            </li>
                        ))}
                    </ul>
                    <p className="text-secondary-500 text-xs leading-relaxed">
                        {isCrypto
                            ? '코인 뉴스의 핵심 이슈와 분위기를 함께 확인할 수 있습니다.'
                            : '뉴스 흐름과 함께 어닝 일정, 최근 실적, 애널리스트 등급 변경을 이어서 확인할 수 있습니다.'}
                    </p>
                </>
            )}
        </section>
    );
}
```

- [ ] **Step 4: Export the component**

Modify `src/widgets/news/index.ts`:

```ts
export { NewsFactsSummary } from './NewsFactsSummary';
```

Keep existing exports unchanged.

- [ ] **Step 5: Run the component test**

Run:

```bash
yarn vitest run src/widgets/news/__tests__/NewsFactsSummary.test.tsx
```

Expected: PASS.

## Task 3: Add OverallFactualFallback Component

**Files:**
- Create: `src/widgets/overall/OverallFactualFallback.tsx`
- Create: `src/widgets/overall/__tests__/OverallFactualFallback.test.tsx`
- Modify: `src/widgets/overall/index.ts`

- [ ] **Step 1: Write the failing component tests**

Create `src/widgets/overall/__tests__/OverallFactualFallback.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { OverallFactualFallback } from '@/widgets/overall';

function news(overrides: Partial<NewsDisplayItem> = {}): NewsDisplayItem {
    return {
        id: overrides.id ?? 'n1',
        publishedAt: overrides.publishedAt ?? '2026-07-08T10:00:00.000Z',
        titleEn: overrides.titleEn ?? 'Apple demand update',
        titleKo: overrides.titleKo ?? null,
        sentiment: overrides.sentiment ?? null,
        category: overrides.category ?? null,
        bodyKo: overrides.bodyKo ?? null,
        summaryKo: overrides.summaryKo ?? null,
        priceImpact: overrides.priceImpact ?? null,
        url: overrides.url ?? 'https://example.com/news',
        source: overrides.source ?? 'Example',
    };
}

describe('OverallFactualFallback', () => {
    it('renders equity axes and news enrichment state without AI conclusion', () => {
        render(
            <OverallFactualFallback
                symbol="AAPL"
                displayName="Apple Inc."
                assetClass="equity"
                newsItems={[
                    news({ id: 'n1', sentiment: 'bullish' }),
                    news({ id: 'n2', sentiment: null }),
                ]}
            />
        );

        expect(
            screen.getByRole('heading', {
                name: 'Apple Inc. 종합 분석 데이터 상태',
            })
        ).toBeInTheDocument();
        expect(screen.getByText(/차트, 뉴스, 펀더멘털, 옵션/)).toBeInTheDocument();
        expect(screen.getByText(/최근 뉴스는 2건/)).toBeInTheDocument();
        expect(screen.getByText(/1건은 AI 뉴스 카드 분석/)).toBeInTheDocument();
        expect(screen.getByText(/아직 캐시되지 않았습니다/)).toBeInTheDocument();
        expect(screen.queryByText(/강세 시나리오:/)).not.toBeInTheDocument();
    });

    it('renders crypto axes without equity-only wording', () => {
        render(
            <OverallFactualFallback
                symbol="BTCUSD"
                displayName="Bitcoin"
                assetClass="crypto"
                newsItems={[news({ id: 'n1', sentiment: 'neutral' })]}
            />
        );

        expect(
            screen.getByText(/차트, 뉴스, 공포 탐욕 지수/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/펀더멘털/)).not.toBeInTheDocument();
        expect(screen.queryByText(/옵션/)).not.toBeInTheDocument();
    });

    it('renders an honest empty news state', () => {
        render(
            <OverallFactualFallback
                symbol="AAPL"
                displayName="Apple Inc."
                assetClass="equity"
                newsItems={[]}
            />
        );

        expect(
            screen.getByText(/최근 뉴스 데이터는 아직 준비되지 않았습니다/)
        ).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
yarn vitest run src/widgets/overall/__tests__/OverallFactualFallback.test.tsx
```

Expected: FAIL because `OverallFactualFallback` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/widgets/overall/OverallFactualFallback.tsx`:

```tsx
import type { NewsDisplayItem } from '@/shared/lib/types';

interface OverallFactualFallbackProps {
    symbol: string;
    displayName: string;
    assetClass: string;
    newsItems: readonly NewsDisplayItem[];
}

function getAxesText(assetClass: string): string {
    if (assetClass === 'crypto') {
        return '차트, 뉴스, 공포 탐욕 지수';
    }
    return '차트, 뉴스, 펀더멘털, 옵션, 공포 탐욕 지수';
}

export function OverallFactualFallback({
    symbol,
    displayName,
    assetClass,
    newsItems,
}: OverallFactualFallbackProps) {
    const analyzedNewsCount = newsItems.filter(
        item => item.sentiment !== null
    ).length;
    const axesText = getAxesText(assetClass);

    return (
        <section
            aria-labelledby={`${symbol}-overall-facts-fallback-heading`}
            className="border-secondary-800 bg-secondary-800/30 space-y-3 rounded-lg border p-5"
        >
            <h2
                id={`${symbol}-overall-facts-fallback-heading`}
                className="text-secondary-300 text-base font-semibold"
            >
                {displayName} 종합 분석 데이터 상태
            </h2>
            <p className="text-secondary-400 text-sm leading-relaxed">
                {displayName} ({symbol}) 종합 분석은 {axesText}를 함께 봅니다.
            </p>
            {newsItems.length > 0 ? (
                <p className="text-secondary-400 text-sm leading-relaxed">
                    현재 서버가 확인한 최근 뉴스는 {newsItems.length}건이며, 이
                    중 {analyzedNewsCount}건은 AI 뉴스 카드 분석이 완료됐습니다.
                </p>
            ) : (
                <p className="text-secondary-400 text-sm leading-relaxed">
                    최근 뉴스 데이터는 아직 준비되지 않았습니다. 뉴스 카드가
                    분석되면 종합 분석의 뉴스 축 상태도 함께 반영됩니다.
                </p>
            )}
            <p className="text-secondary-500 text-sm leading-relaxed">
                종합 AI 결론이 아직 캐시되지 않았습니다. 분석 결과가 준비되면
                강세, 중립, 약세 시나리오와 위험 요인이 이 영역에 표시됩니다.
            </p>
        </section>
    );
}
```

- [ ] **Step 4: Export the component**

Modify `src/widgets/overall/index.ts`:

```ts
export { OverallFactualFallback } from './OverallFactualFallback';
```

Keep existing exports unchanged.

- [ ] **Step 5: Run the component test**

Run:

```bash
yarn vitest run src/widgets/overall/__tests__/OverallFactualFallback.test.tsx
```

Expected: PASS.

## Task 4: Wire NewsFactsSummary into the News Page

**Files:**
- Modify: `src/app/[symbol]/news/page.tsx`
- Modify: `src/app/[symbol]/news/__tests__/page.body.test.tsx`

- [ ] **Step 1: Add page wiring tests**

Modify `src/app/[symbol]/news/__tests__/page.body.test.tsx`.

Add the mock and import:

```ts
vi.mock('@/widgets/news/NewsFactsSummary', () => ({
    NewsFactsSummary: () => null,
}));

import { NewsFactsSummary } from '@/widgets/news/NewsFactsSummary';
import { getNewsList } from '@/entities/news-article/api';
import { findElementByType } from '@/__tests__/utils/findElementByType';
```

Add this fixture near the asset fixtures:

```ts
const READY_NEWS = [
    {
        id: 'news-1',
        symbol: 'AAPL',
        source: 'Example',
        url: 'https://example.com/aapl',
        publishedAt: '2026-07-08T10:00:00.000Z',
        titleEn: 'Apple supplier shares rise',
        bodyEn: null,
        titleKo: '애플 공급망 뉴스',
        bodyKo: null,
        summaryKo: '요약',
        sentiment: 'bullish' as const,
        category: 'product' as const,
        priceImpact: 'medium' as const,
        analyzedAt: new Date('2026-07-08T10:05:00.000Z'),
    },
];
```

Add this test:

```ts
it('equity symbol → NewsFactsSummary receives fetched news items and equity assetClass', async () => {
    mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
    vi.mocked(getNewsList).mockResolvedValue(READY_NEWS);

    const tree = await NewsPage({
        params: Promise.resolve({ symbol: 'aapl' }),
    });
    const factLayer = findElementByType(tree, NewsFactsSummary);

    expect(factLayer).not.toBeNull();
    expect(
        factLayer?.props as {
            symbol: string;
            displayName: string;
            assetClass: string;
            items: unknown[];
        }
    ).toMatchObject({
        symbol: 'AAPL',
        displayName: 'Apple Inc.',
        assetClass: 'equity',
        items: READY_NEWS,
    });
});
```

Add this degraded-state wiring test:

```ts
it('getNewsList throw → NewsFactsSummary receives empty items without page crash', async () => {
    mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
    vi.mocked(getNewsList).mockRejectedValue(new Error('DB connection refused'));

    const tree = await NewsPage({
        params: Promise.resolve({ symbol: 'aapl' }),
    });
    const factLayer = findElementByType(tree, NewsFactsSummary);

    expect(factLayer).not.toBeNull();
    expect(
        factLayer?.props as {
            symbol: string;
            items: unknown[];
        }
    ).toMatchObject({
        symbol: 'AAPL',
        items: [],
    });
});
```

- [ ] **Step 2: Run the failing page test**

Run:

```bash
yarn vitest run 'src/app/[symbol]/news/__tests__/page.body.test.tsx'
```

Expected: FAIL because `NewsFactsSummary` is not rendered yet.

- [ ] **Step 3: Render NewsFactsSummary in the page**

Modify `src/app/[symbol]/news/page.tsx`.

Add import:

```ts
import { NewsFactsSummary } from '@/widgets/news/NewsFactsSummary';
```

Render it immediately after `SymbolPageHeading` and before the existing `sr-only` overview:

```tsx
<NewsFactsSummary
    symbol={upper}
    displayName={displayName}
    assetClass={assetClass}
    items={newsItems}
/>
```

The result should look like:

```tsx
<SymbolPageHeading>
    {isEquity
        ? `${displayName} 최신 뉴스와 어닝 일정`
        : `${displayName} 최신 코인 뉴스`}
</SymbolPageHeading>
<NewsFactsSummary
    symbol={upper}
    displayName={displayName}
    assetClass={assetClass}
    items={newsItems}
/>
<section className="sr-only">
```

- [ ] **Step 4: Run the page test**

Run:

```bash
yarn vitest run 'src/app/[symbol]/news/__tests__/page.body.test.tsx'
```

Expected: PASS.

## Task 5: Wire OverallFactualFallback into the Overall Page

**Files:**
- Modify: `src/app/[symbol]/overall/page.tsx`
- Modify: `src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx`

- [ ] **Step 1: Update fact-layer tests for cache-miss fallback**

Modify `src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx`.

Update the widget mock:

```ts
vi.mock('@/widgets/overall', () => ({
    OverallFactsSummary: () => null,
    OverallFactualFallback: () => null,
}));
```

Update imports:

```ts
import {
    OverallFactsSummary,
    OverallFactualFallback,
} from '@/widgets/overall';
```

Replace the old cache-miss assertions with:

```ts
it('Worst: peek MISS(null)면 OverallFactualFallback을 SSR fallback으로 렌더한다', async () => {
    const newsItems = [
        {
            id: 'news-1',
            symbol: 'AAPL',
            source: 'Example',
            url: 'https://example.com/aapl',
            publishedAt: '2026-07-08T10:00:00.000Z',
            titleEn: 'Apple supplier shares rise',
            bodyEn: null,
            titleKo: '애플 공급망 뉴스',
            bodyKo: null,
            summaryKo: '요약',
            sentiment: 'bullish' as const,
            category: 'product' as const,
            priceImpact: 'medium' as const,
            analyzedAt: new Date('2026-07-08T10:05:00.000Z'),
        },
    ];
    mockStatic.mockImplementation(async (key: readonly unknown[]) => {
        if (key[0] === NEWS_LIST_CACHE_KEY) {
            return newsItems as never;
        }
        return null as never;
    });

    const tree = await OverallPage({
        params: Promise.resolve({ symbol: 'aapl' }),
    });
    const fallback = findSuspenseFallback(tree);
    const summary = findElementByType(fallback, OverallFactsSummary);
    const factualFallback = findElementByType(fallback, OverallFactualFallback);

    expect(summary).toBeNull();
    expect(factualFallback).not.toBeNull();
    expect(
        factualFallback?.props as {
            symbol: string;
            displayName: string;
            assetClass: string;
            newsItems: unknown[];
        }
    ).toMatchObject({
        symbol: 'AAPL',
        displayName: 'Apple Inc.',
        assetClass: 'equity',
        newsItems,
    });
});
```

Update the rejected-cache test name and expected fallback:

```ts
it('Worst: staticSymbolCache 실패 시 fallback은 OverallFactualFallback으로 degrade한다', async () => {
    mockStatic.mockRejectedValue(new Error('redis infra down'));

    const tree = await OverallPage({
        params: Promise.resolve({ symbol: 'aapl' }),
    });
    const fallback = findSuspenseFallback(tree);
    const factualFallback = findElementByType(fallback, OverallFactualFallback);

    expect(factualFallback).not.toBeNull();
});
```

- [ ] **Step 2: Run the failing page test**

Run:

```bash
yarn vitest run 'src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx'
```

Expected: FAIL because `OverallFactualFallback` is not rendered yet.

- [ ] **Step 3: Render OverallFactualFallback on cache miss**

Modify `src/app/[symbol]/overall/page.tsx`.

Update import:

```ts
import { OverallFactsSummary, OverallFactualFallback } from '@/widgets/overall';
```

Replace the cache-miss skeleton in the Suspense fallback:

```tsx
fallback={
    cachedOverall ? (
        <OverallFactsSummary symbol={upper} analysis={cachedOverall} />
    ) : (
        <OverallFactualFallback
            symbol={upper}
            displayName={displayName}
            assetClass={assetClass}
            newsItems={newsItems}
        />
    )
}
```

Remove `SUSPENSE_SKELETON_COUNT` if it becomes unused.

- [ ] **Step 4: Run the page test**

Run:

```bash
yarn vitest run 'src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx'
```

Expected: PASS.

## Task 6: Focused and Full Validation

**Files:**
- Verify all modified files from Tasks 1-5.

- [ ] **Step 1: Run focused tests**

Run:

```bash
yarn vitest run \
  src/widgets/news/__tests__/NewsFactsSummary.test.tsx \
  src/widgets/overall/__tests__/OverallFactualFallback.test.tsx \
  'src/app/[symbol]/news/__tests__/page.body.test.tsx' \
  'src/app/[symbol]/overall/__tests__/page.factlayer.test.tsx'
```

Expected: PASS.

- [ ] **Step 2: Run shell syntax validation**

Run:

```bash
bash -n infra/aws/06-alb-asg.sh
```

Expected: exits `0`.

- [ ] **Step 3: Run project validation**

Run:

```bash
yarn typecheck
yarn lint
yarn test
```

Expected: all pass.

- [ ] **Step 4: Inspect local diff**

Run:

```bash
git diff --stat
git diff --check
```

Expected:

```text
git diff --check
```

prints no whitespace errors.

- [ ] **Step 5: Prepare deployment verification notes**

Add these notes to the final implementation summary:

```text
Post-deploy verification:
- https://www.siglens.io/ returns 301 to https://siglens.io/
- https://www.siglens.io/AAPL?tf=1Day returns 301 preserving path/query
- https://www.siglens.io/sitemap.xml returns 301 to apex sitemap
- http://www.siglens.io/AAPL?tf=1Day follows Cloudflare HTTPS redirect, then apex redirect
- https://siglens.io/AAPL/news HTML contains the NewsFactsSummary text before JS execution
- https://siglens.io/AAPL/overall HTML contains either OverallFactsSummary or OverallFactualFallback before JS execution
- apex news/overall HTML still exposes apex canonical URLs
- GSC follow-up: check discovered/indexed www URLs, canonical selection, and representative news/overall URL fetch after recrawl
```

## Self-Review

### Spec coverage

- `www.siglens.io` 200 problem: Task 1 adds an ALB HTTPS host redirect rule and Task 6 defines live verification.
- Query/path preservation: Task 1 uses `Path=/#{path}` and `Query=#{query}`.
- `http://www` behavior: Task 1 and Task 6 explicitly verify the existing Cloudflare hop plus new ALB hop.
- `news` SSR factual layer: Tasks 2 and 4 add and wire visible factual content from existing `newsItems`.
- `news` empty/degraded state: Task 2 covers empty rendering and Task 4 covers `getNewsList` failure passing empty items to the fact layer.
- `overall` cache-miss fallback: Tasks 3 and 5 replace skeleton-only fallback with deterministic factual content.
- Hidden keyword/stuffing avoidance: component implementations render visible sections and use counts/headlines/status only.
- No new external fetch: page wiring passes already-fetched `newsItems`; components are pure render functions.
- Indexability gate unchanged: no task modifies sitemap/noindex policy.

### Placeholder scan

No task relies on `TBD`, unspecified error handling, or "write tests for this" without code. Shell live verification cannot be unit-tested locally because it depends on AWS ALB state; the plan covers local `bash -n` plus post-deploy curl verification.

### Type consistency

- `NewsFactsSummary.items` and `OverallFactualFallback.newsItems` both use `readonly NewsDisplayItem[]`.
- Page wiring passes `newsItems` returned by `getNewsList`, whose `NewsRow` extends `NewsDisplayItem`.
- `assetClass` is passed as `string` to avoid coupling the widgets to market-profile internals; components only branch on `'crypto'`.
