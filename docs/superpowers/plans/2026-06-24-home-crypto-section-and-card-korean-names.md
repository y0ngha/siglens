# 홈 암호화폐 섹션 + 카드 한글명 + 정렬/Placeholder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면에 '암호화폐 인기 종목' 카드 섹션을 신설하고, 주식·크립토 카드 칩을 한글명+티커로 통일하며, 검색 placeholder와 987px 정렬 깨짐을 수정한다.

**Architecture:** 주식·크립토 두 섹션이 동일한 카드 구조를 갖도록 프레젠테이션 컴포넌트 `CategoryCardGrid`를 추출해 양쪽이 공유한다. 데이터는 정적 config(주식=`TICKER_CATEGORIES` shape 변경, 크립토=신규 `CRYPTO_CATEGORIES`). 새 fetch/API 없음.

**Tech Stack:** Next.js 16(App Router, RSC), React, TypeScript, Tailwind CSS v4, Vitest + Testing Library.

**작업 디렉토리:** `/Users/y0ngha/Project/siglens/.claude/worktrees/home-crypto-section` (브랜치 `feat/home-crypto-section`). 모든 경로는 이 워크트리 기준.

**스펙:** `docs/superpowers/specs/2026-06-24-home-crypto-section-and-card-korean-names-design.md`

---

## ⚠️ 커밋 정책 (이 프로젝트 전용)

이 레포는 **메인 세션/구현 subagent가 직접 커밋하지 않는다**(CLAUDE.md). 각 Task는 커밋하지 말고 **변경 + 테스트 green 상태로 워크트리에 남긴다**. 모든 Task 완료 후 오케스트레이터가 review-agent → mistake-managing-agent → git-agent 순서로 라우팅하여 **git-agent가 1회 커밋 + PR**을 만든다. 따라서 각 Task의 마지막 단계는 "커밋"이 아니라 "관련 테스트 green 확인"이다.

## 공통 명령

```bash
# 단일 테스트 파일 실행 (워크트리 루트에서)
yarn test <path>           # 예: yarn test src/widgets/home/__tests__/CategoryCardGrid.test.tsx
# 전체 테스트
yarn test
# 린트
yarn lint
# 타입체크 포함 빌드
yarn build
```

---

## 파일 구조 (생성/수정 맵)

| 파일 | 책임 | 작업 |
|---|---|---|
| `src/features/ticker-search/ui/TickerAutocomplete.tsx` | 검색 input placeholder | 수정(Task 1) |
| `src/app/page.tsx` | hero 정렬 트리거 | 수정(Task 2) |
| `src/widgets/home/StatsBar.tsx` | StatsBar 정렬 트리거 | 수정(Task 2) |
| `src/features/ticker-search/ui/SymbolSearchPanel.tsx` | 최근검색 정렬 트리거 | 수정(Task 2) |
| `src/widgets/home/ui/CategoryCardGrid.tsx` | 공유 카드 그리드 프레젠테이션 | **생성**(Task 3) |
| `src/widgets/home/__tests__/CategoryCardGrid.test.tsx` | 공유 컴포넌트 테스트 | **생성**(Task 3) |
| `src/shared/lib/types.ts` | `TickerCategory.items` shape + `CryptoCategory` | 수정(Task 4, 5) |
| `src/shared/config/crypto-categories.ts` | 큐레이션 크립토 카테고리 | **생성**(Task 4) |
| `src/shared/config/__tests__/crypto-categories.test.ts` | 크립토 config 테스트 | **생성**(Task 4) |
| `src/widgets/home/CryptoShowcase.tsx` | 크립토 섹션 → 카드형 | 수정(Task 4) |
| `src/shared/config/popular-tickers.ts` | 주식 카테고리 한글명 | 수정(Task 5) |
| `src/widgets/home/TickerCategories.tsx` | 주식 섹션 → 공유 컴포넌트 사용 | 수정(Task 5) |
| `src/shared/config/__tests__/popular-tickers.test.ts` | shape 단언 갱신 | 수정(Task 5) |
| `src/widgets/home/__tests__/TickerCategories.test.tsx` | mock/단언 갱신 | 수정(Task 5) |
| `src/__integration__/homePageCategoryBrowse.test.tsx` | mock/쿼리 갱신 | 수정(Task 5) |
| `src/__integration__/journeyNewUser.test.tsx` | mock 갱신 | 수정(Task 5) |

---

## Task 1: 검색 Placeholder 변경

**Files:**
- Modify: `src/features/ticker-search/ui/TickerAutocomplete.tsx:87`

- [ ] **Step 1: placeholder 문자열 교체**

`TickerAutocomplete.tsx`에서 아래 한 줄을 찾는다(line 87 부근):

```tsx
placeholder="종목 입력… 예: AAPL, 애플"
```

다음으로 교체:

```tsx
placeholder="종목 입력 (예: AAPL, 애플, BTC, 비트코인)"
```

- [ ] **Step 2: 변경 확인**

Run: `grep -n "종목 입력 (예: AAPL, 애플, BTC, 비트코인)" src/features/ticker-search/ui/TickerAutocomplete.tsx`
Expected: line 87에 일치 1건. `aria-label="종목 티커 검색"`(line 72)은 그대로 남아 있어야 한다.

- [ ] **Step 3: 관련 테스트 green 확인 (있으면)**

Run: `yarn test src/features/ticker-search`
Expected: PASS (placeholder를 단언하는 테스트가 있으면 새 문자열로 함께 갱신).

---

## Task 2: 987px 정렬 통일 (`lg:` → `md:`)

**배경:** hero 좌측정렬 전환이 `lg:`(1024px)에 묶여 768–1023px에서 hero만 가운데, 검색창·하단 섹션은 좌측이라 어긋난다. hero 정렬 트리거를 `md:`로 내려 일관성 확보. **2-column 그리드 전환(`page.tsx:254 lg:grid-cols-[...]`)은 변경하지 않는다.**

**Files:**
- Modify: `src/app/page.tsx:265,292,296`
- Modify: `src/widgets/home/StatsBar.tsx:21,46`
- Modify: `src/features/ticker-search/ui/SymbolSearchPanel.tsx:22`

- [ ] **Step 1: `page.tsx` hero 텍스트 컬럼 정렬 (line 265)**

```tsx
<div className="text-center lg:text-left">
```
→
```tsx
<div className="text-center md:text-left">
```

- [ ] **Step 2: `page.tsx` 검색 래퍼 정렬 (line 292)**

```tsx
className="mt-8 flex w-full justify-center lg:justify-start"
```
→
```tsx
className="mt-8 flex w-full justify-center md:justify-start"
```

- [ ] **Step 3: `page.tsx` quick links 정렬 (line 296)**

```tsx
<div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
```
→
```tsx
<div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 md:justify-start">
```

- [ ] **Step 4: `StatsBar.tsx` 본체 + 스켈레톤 정렬 (line 21, 46)**

line 21:
```tsx
className="text-secondary-400 mt-6 flex list-none flex-wrap items-center justify-center gap-x-2 p-0 font-mono text-xs lg:justify-start"
```
→ 끝의 `lg:justify-start` → `md:justify-start`.

line 46:
```tsx
className="mt-6 flex flex-wrap items-center justify-center gap-x-2 lg:justify-start"
```
→ 끝의 `lg:justify-start` → `md:justify-start`.

- [ ] **Step 5: `SymbolSearchPanel.tsx` 최근검색 행 정렬 (line 22)**

```tsx
<div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
```
→
```tsx
<div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
```

- [ ] **Step 6: 잔여 `lg:justify-start`/`lg:text-left` 점검**

Run: `grep -rn "lg:justify-start\|lg:text-left" src/app/page.tsx src/widgets/home/StatsBar.tsx src/features/ticker-search/ui/SymbolSearchPanel.tsx`
Expected: 위에서 바꾼 항목 외에 hero 관련 잔여 없음(다른 무관한 섹션이 있으면 건드리지 않는다 — hero/검색/StatsBar/최근검색만 대상).

- [ ] **Step 7: 빌드/타입 영향 없음 확인**

Run: `yarn test src/widgets/home/__tests__/StatsBar.test.tsx` (존재 시)
Expected: PASS. (정렬은 시각 검증은 Task 6에서 브라우저로 실측.)

---

## Task 3: 공유 컴포넌트 `CategoryCardGrid` (TDD)

**책임:** 섹션 헤딩 + 카드 그리드를 렌더하는 순수 프레젠테이션 컴포넌트. 주식·크립토가 공유. 데이터/색상 클래스를 props로 주입받는다. 칩은 한글명(메인) + 티커(보조 작은 글씨)를 표시하고 `/${symbol}`로 링크.

**Files:**
- Create: `src/widgets/home/ui/CategoryCardGrid.tsx`
- Test: `src/widgets/home/__tests__/CategoryCardGrid.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/widgets/home/__tests__/CategoryCardGrid.test.tsx`:

```tsx
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { CategoryCardGrid, type CategoryCard } from '../ui/CategoryCardGrid';

const CARDS: CategoryCard[] = [
    {
        id: 'major',
        label: '메이저',
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
        items: [{ symbol: 'BTCUSD', name: '비트코인' }],
    },
];

describe('CategoryCardGrid', () => {
    it('섹션 헤딩과 nav 랜드마크를 렌더한다', () => {
        render(
            <CategoryCardGrid
                heading="암호화폐 인기 종목"
                ariaLabel="암호화폐 인기 종목 탐색"
                cards={CARDS}
            />
        );
        expect(
            screen.getByRole('heading', { name: '암호화폐 인기 종목' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('navigation', { name: '암호화폐 인기 종목 탐색' })
        ).toBeInTheDocument();
    });

    it('카드 라벨을 헤딩으로 렌더한다', () => {
        render(
            <CategoryCardGrid heading="h" ariaLabel="a" cards={CARDS} />
        );
        expect(
            screen.getByRole('heading', { name: '메이저' })
        ).toBeInTheDocument();
    });

    it('칩에 한글명과 티커를 모두 표시하고 /symbol로 링크한다', () => {
        render(
            <CategoryCardGrid heading="h" ariaLabel="a" cards={CARDS} />
        );
        const link = screen.getByRole('link', { name: /BTCUSD/ });
        expect(link).toHaveAttribute('href', '/BTCUSD');
        expect(link).toHaveTextContent('비트코인');
        expect(link).toHaveTextContent('BTCUSD');
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/widgets/home/__tests__/CategoryCardGrid.test.tsx`
Expected: FAIL — `Cannot find module '../ui/CategoryCardGrid'`.

- [ ] **Step 3: 컴포넌트 구현**

`src/widgets/home/ui/CategoryCardGrid.tsx`:

```tsx
import Link from 'next/link';

import { cn } from '@/shared/lib/cn';

export type CategoryCardItem = {
    symbol: string;
    name: string;
};

export type CategoryCard = {
    id: string;
    label: string;
    /** Tailwind left-border 색상 클래스, 예: 'border-l-primary-400' */
    borderColor: string;
    /** Tailwind 텍스트 색상 클래스, 예: 'text-primary-400' */
    textColor: string;
    items: readonly CategoryCardItem[];
};

type CategoryCardGridProps = {
    heading: string;
    ariaLabel: string;
    cards: readonly CategoryCard[];
};

// 주식(섹터)·암호화폐 두 섹션이 동일한 카드 디자인을 공유하도록 추출한
// 순수 프레젠테이션 컴포넌트. 데이터와 색상 클래스는 호출부가 주입한다.
export function CategoryCardGrid({
    heading,
    ariaLabel,
    cards,
}: CategoryCardGridProps) {
    return (
        <nav
            aria-label={ariaLabel}
            className="px-6 py-10 lg:pr-[10vw] lg:pl-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">
                {heading}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cards.map(card => (
                    <div
                        key={card.id}
                        id={card.id}
                        className={cn(
                            'border-secondary-700 bg-secondary-800/50 scroll-mt-20 rounded-lg border p-5',
                            'border-l-2',
                            card.borderColor
                        )}
                    >
                        <h3
                            className={cn(
                                'mb-3 text-xs font-semibold tracking-wider uppercase',
                                card.textColor
                            )}
                        >
                            {card.label}
                        </h3>
                        <ul
                            className="flex touch-manipulation flex-wrap gap-2"
                            aria-label={`${card.label} 종목 목록`}
                        >
                            {card.items.map(item => (
                                <li key={item.symbol}>
                                    <Link
                                        href={`/${item.symbol}`}
                                        title={`${item.symbol} 분석`}
                                        className="border-secondary-700 text-secondary-300 hover:border-primary-600/40 hover:text-primary-400 focus-visible:ring-primary-500 inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        <span>{item.name}</span>
                                        <span className="text-secondary-500 text-[10px]">
                                            {item.symbol}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </nav>
    );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/widgets/home/__tests__/CategoryCardGrid.test.tsx`
Expected: PASS (3 tests).

---

## Task 4: 크립토 카테고리 데이터 + `CryptoShowcase` 카드화 (TDD)

**Files:**
- Modify: `src/shared/lib/types.ts` (add `CryptoCategoryId`, `CryptoCategory`)
- Create: `src/shared/config/crypto-categories.ts`
- Test: `src/shared/config/__tests__/crypto-categories.test.ts`
- Modify: `src/widgets/home/CryptoShowcase.tsx`

- [ ] **Step 1: 타입 추가 (`src/shared/lib/types.ts`)**

`CategoryId`/`TickerCategory` 정의 근처(라인 73~91 영역)에 아래를 추가한다(기존 정의는 이 Task에서 변경하지 않음):

```ts
/** 암호화폐 큐레이션 카테고리 id. */
export type CryptoCategoryId = 'major' | 'altcoin';

/** 암호화폐 큐레이션 카테고리(id + label + 멤버 심볼/한글명). */
export interface CryptoCategory {
    id: CryptoCategoryId;
    label: string;
    items: readonly { symbol: string; name: string }[];
}
```

- [ ] **Step 2: 실패하는 config 테스트 작성**

`src/shared/config/__tests__/crypto-categories.test.ts`:

```ts
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';

describe('CRYPTO_CATEGORIES', () => {
    it('각 그룹은 최소 5개 종목을 가진다', () => {
        for (const category of CRYPTO_CATEGORIES) {
            expect(category.items.length).toBeGreaterThanOrEqual(5);
        }
    });

    it('모든 심볼은 검증된 POPULAR_CRYPTOS에 포함된다', () => {
        const valid = new Set<string>(POPULAR_CRYPTOS);
        for (const category of CRYPTO_CATEGORIES) {
            for (const item of category.items) {
                expect(valid.has(item.symbol)).toBe(true);
            }
        }
    });

    it('전체 심볼에 중복이 없다', () => {
        const symbols = CRYPTO_CATEGORIES.flatMap(c =>
            c.items.map(i => i.symbol)
        );
        expect(new Set(symbols).size).toBe(symbols.length);
    });

    it('모든 한글명이 비어있지 않다', () => {
        for (const category of CRYPTO_CATEGORIES) {
            for (const item of category.items) {
                expect(item.name.length).toBeGreaterThan(0);
            }
        }
    });

    it('major와 altcoin 그룹이 존재한다', () => {
        const ids = CRYPTO_CATEGORIES.map(c => c.id);
        expect(ids).toContain('major');
        expect(ids).toContain('altcoin');
    });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `yarn test src/shared/config/__tests__/crypto-categories.test.ts`
Expected: FAIL — `Cannot find module '@/shared/config/crypto-categories'`.

- [ ] **Step 4: config 구현 (`src/shared/config/crypto-categories.ts`)**

```ts
import type { CryptoCategory } from '@/shared/lib/types';

// 큐레이션 암호화폐 카테고리 — 홈 '암호화폐 인기 종목' 카드 섹션 전용.
// 심볼은 모두 검증된 POPULAR_CRYPTOS(자동생성) 내에서 선정해 라우트 해석을 보장한다.
// (popular-cryptos.ts는 스크립트가 덮어쓰므로 한글명/그룹은 이 파일에서 수기 관리.)
export const CRYPTO_CATEGORIES: readonly CryptoCategory[] = [
    {
        id: 'major',
        label: '메이저',
        items: [
            { symbol: 'BTCUSD', name: '비트코인' },
            { symbol: 'ETHUSD', name: '이더리움' },
            { symbol: 'XRPUSD', name: '리플' },
            { symbol: 'SOLUSD', name: '솔라나' },
            { symbol: 'BNBUSD', name: '비앤비' },
        ],
    },
    {
        id: 'altcoin',
        label: '알트코인',
        items: [
            { symbol: 'DOGEUSD', name: '도지코인' },
            { symbol: 'ADAUSD', name: '카르다노' },
            { symbol: 'TRXUSD', name: '트론' },
            { symbol: 'LINKUSD', name: '체인링크' },
            { symbol: 'LTCUSD', name: '라이트코인' },
        ],
    },
];
```

- [ ] **Step 5: config 테스트 통과 확인**

Run: `yarn test src/shared/config/__tests__/crypto-categories.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: `CRYPTO_SHOWCASE_COUNT` 외부 사용처 확인**

Run: `grep -rn "CRYPTO_SHOWCASE_COUNT" src/`
Expected: `CryptoShowcase.tsx` 외 사용처 없음. 다른 사용처가 있으면 이 Task에서 함께 정리(없을 것으로 예상).

- [ ] **Step 7: `CryptoShowcase.tsx` 카드형으로 재작성**

파일 전체를 아래로 교체:

```tsx
import type { CryptoCategoryId } from '@/shared/lib/types';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { CategoryCardGrid, type CategoryCard } from './ui/CategoryCardGrid';

const CRYPTO_STYLES: Record<
    CryptoCategoryId,
    { borderColor: string; textColor: string }
> = {
    major: {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
    altcoin: {
        borderColor: 'border-l-chart-bullish',
        textColor: 'text-chart-bullish',
    },
};

export function CryptoShowcase() {
    const cards: CategoryCard[] = CRYPTO_CATEGORIES.map(category => ({
        id: category.id,
        label: category.label,
        borderColor: CRYPTO_STYLES[category.id].borderColor,
        textColor: CRYPTO_STYLES[category.id].textColor,
        items: category.items,
    }));

    return (
        <CategoryCardGrid
            heading="암호화폐 인기 종목"
            ariaLabel="암호화폐 인기 종목 탐색"
            cards={cards}
        />
    );
}
```

- [ ] **Step 8: 기존 CryptoShowcase 테스트 점검**

Run: `grep -rln "CryptoShowcase" src/**/__tests__ src/__integration__ 2>/dev/null`
기존 테스트가 `인기 암호화폐`(옛 제목)나 칩 구조를 단언하면 신규 제목/구조로 갱신한다. 없으면 신규 테스트 추가 불필요(`CategoryCardGrid` 테스트가 렌더 로직을 커버, `crypto-categories.test`가 데이터를 커버).

- [ ] **Step 9: 타입/렌더 회귀 확인**

Run: `yarn test src/widgets/home src/shared/config`
Expected: PASS.

---

## Task 5: 주식 카테고리 한글명 + `TickerCategories` 공유 컴포넌트 사용 (원자적)

**주의:** `TickerCategory` shape 변경(`tickers` → `items`)은 타입·데이터·위젯·테스트에 동시에 영향을 준다. 이 Task는 **한 번에** 처리해 트리를 green으로 유지한다.

**Files:**
- Modify: `src/shared/lib/types.ts` (line 90: `tickers` → `items`)
- Modify: `src/shared/config/popular-tickers.ts` (각 카테고리 `tickers` → `items` + 한글명)
- Modify: `src/widgets/home/TickerCategories.tsx`
- Modify: `src/shared/config/__tests__/popular-tickers.test.ts`
- Modify: `src/widgets/home/__tests__/TickerCategories.test.tsx`
- Modify: `src/__integration__/homePageCategoryBrowse.test.tsx`
- Modify: `src/__integration__/journeyNewUser.test.tsx`

- [ ] **Step 1: `TickerCategory` 타입 변경 (`src/shared/lib/types.ts`)**

```ts
export interface TickerCategory {
    id: CategoryId;
    label: string;
    tickers: readonly string[];
}
```
→
```ts
export interface TickerCategory {
    id: CategoryId;
    label: string;
    items: readonly { symbol: string; name: string }[];
}
```

- [ ] **Step 2: `popular-tickers.ts`의 `TICKER_CATEGORIES`를 items + 한글명으로 교체**

`TICKER_CATEGORIES` 배열(line 5~67)을 아래로 교체. `POPULAR_TICKERS` flat 배열(line 69 이하)은 **건드리지 않는다**(스크립트 자동생성 대상). 불확실 한글명(`SPCX`, `LAES`, `XYZ`)은 Step 3에서 실측 검증.

```ts
export const TICKER_CATEGORIES: readonly TickerCategory[] = [
    {
        id: 'megacap',
        label: '메가캡·지수',
        items: [
            { symbol: 'AAPL', name: '애플' },
            { symbol: 'MSFT', name: '마이크로소프트' },
            { symbol: 'NVDA', name: '엔비디아' },
            { symbol: 'GOOGL', name: '알파벳(구글)' },
            { symbol: 'AMZN', name: '아마존' },
            { symbol: 'META', name: '메타' },
            { symbol: 'TSLA', name: '테슬라' },
            { symbol: 'SPY', name: 'S&P500 ETF' },
            { symbol: 'QQQ', name: '나스닥100 ETF' },
        ],
    },
    {
        id: 'ai-semiconductor',
        label: 'AI·반도체',
        items: [
            { symbol: 'AMD', name: 'AMD' },
            { symbol: 'AVGO', name: '브로드컴' },
            { symbol: 'ARM', name: '암(ARM)' },
            { symbol: 'SMCI', name: '슈퍼마이크로' },
            { symbol: 'ALAB', name: '아스테라랩스' },
            { symbol: 'SOUN', name: '사운드하운드' },
        ],
    },
    {
        id: 'software-cloud',
        label: '소프트웨어·클라우드',
        items: [
            { symbol: 'PLTR', name: '팔란티어' },
            { symbol: 'CRWD', name: '크라우드스트라이크' },
            { symbol: 'SNOW', name: '스노우플레이크' },
            { symbol: 'NOW', name: '서비스나우' },
            { symbol: 'CRM', name: '세일즈포스' },
            { symbol: 'DDOG', name: '데이터독' },
            { symbol: 'NET', name: '클라우드플레어' },
        ],
    },
    {
        id: 'fintech-crypto',
        label: '핀테크·크립토',
        items: [
            { symbol: 'COIN', name: '코인베이스' },
            { symbol: 'MSTR', name: '스트래티지' },
            { symbol: 'HOOD', name: '로빈후드' },
            { symbol: 'XYZ', name: '블록' },
            { symbol: 'PYPL', name: '페이팔' },
            { symbol: 'SOFI', name: '소파이' },
            { symbol: 'AFRM', name: '어펌' },
        ],
    },
    {
        id: 'leveraged-etf',
        label: '레버리지 ETF',
        items: [
            { symbol: 'TQQQ', name: '나스닥 3배 롱' },
            { symbol: 'SQQQ', name: '나스닥 3배 숏' },
            { symbol: 'SOXL', name: '반도체 3배 롱' },
            { symbol: 'TSLL', name: '테슬라 2배 롱' },
            { symbol: 'NVDL', name: '엔비디아 2배 롱' },
        ],
    },
    {
        id: 'healthcare-bio',
        label: '헬스케어·바이오',
        items: [
            { symbol: 'LLY', name: '일라이릴리' },
            { symbol: 'NVO', name: '노보노디스크' },
            { symbol: 'UNH', name: '유나이티드헬스' },
            { symbol: 'ISRG', name: '인튜이티브서지컬' },
            { symbol: 'AMGN', name: '암젠' },
        ],
    },
    {
        id: 'quantum-computing',
        label: '양자컴퓨팅',
        items: [
            { symbol: 'IONQ', name: '아이온큐' },
            { symbol: 'LAES', name: '세알시큐리티' },
            { symbol: 'RGTI', name: '리게티' },
            { symbol: 'QBTS', name: '디웨이브' },
            { symbol: 'QUBT', name: '퀀텀컴퓨팅' },
            { symbol: 'IBM', name: 'IBM' },
        ],
    },
    {
        id: 'space',
        label: '우주·항공우주',
        items: [
            { symbol: 'SPCX', name: '스페이스X 관련 ETF' },
            { symbol: 'RKLB', name: '로켓랩' },
            { symbol: 'ASTS', name: 'AST스페이스모바일' },
            { symbol: 'LUNR', name: '인튜이티브머신스' },
            { symbol: 'RDW', name: '레드와이어' },
            { symbol: 'PL', name: '플래닛랩스' },
            { symbol: 'SPCE', name: '버진갤럭틱' },
        ],
    },
    {
        id: 'ev-mobility',
        label: 'EV·모빌리티',
        items: [
            { symbol: 'TSLA', name: '테슬라' },
            { symbol: 'RIVN', name: '리비안' },
            { symbol: 'NIO', name: '니오' },
            { symbol: 'LCID', name: '루시드' },
            { symbol: 'XPEV', name: '샤오펑' },
            { symbol: 'UBER', name: '우버' },
            { symbol: 'LYFT', name: '리프트' },
        ],
    },
    {
        id: 'energy-industrial',
        label: '에너지·산업재',
        items: [
            { symbol: 'XOM', name: '엑슨모빌' },
            { symbol: 'CVX', name: '셰브론' },
            { symbol: 'OXY', name: '옥시덴탈' },
            { symbol: 'COP', name: '코노코필립스' },
            { symbol: 'CAT', name: '캐터필러' },
            { symbol: 'GE', name: 'GE에어로스페이스' },
            { symbol: 'BA', name: '보잉' },
        ],
    },
];
```

- [ ] **Step 3: 불확실 한글명 실측 검증 (`SPCX`, `LAES`, `XYZ`)**

WebSearch 또는 FMP `https://financialmodelingprep.com/api/v3/profile/<SYMBOL>?apikey=$FMP_API_KEY`로 정식 회사/ETF명을 확인한다.
- `XYZ` → Block, Inc.(구 Square)이 맞으면 `블록` 유지.
- `LAES` → SEALSQ Corp이 맞으면 `세알시큐리티` 유지(아니면 `SEALSQ` 등 통용명으로).
- `SPCX` → 실제 종목명 확인 후 정확한 한글 통용명으로 교체(스페이스X 직접 상장 종목이 아니므로 ETF/지주 정식명을 반영). 확인 불가 시 보수적으로 영문 약칭을 한글로 음차.
검증 결과가 다르면 Step 2의 해당 `name`만 수정.

- [ ] **Step 4: `TickerCategories.tsx`를 공유 컴포넌트 사용으로 재작성**

파일 전체를 아래로 교체(`CATEGORY_STYLES` 색상 맵은 유지, 마크업은 `CategoryCardGrid`에 위임):

```tsx
import type { CategoryId } from '@/shared/lib/types';
import { TICKER_CATEGORIES } from '@/shared/config/popular-tickers';
import { CategoryCardGrid, type CategoryCard } from './ui/CategoryCardGrid';

const CATEGORY_STYLES: Record<
    CategoryId,
    { borderColor: string; textColor: string }
> = {
    megacap: {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
    'ai-semiconductor': {
        borderColor: 'border-l-chart-bullish',
        textColor: 'text-chart-bullish',
    },
    'software-cloud': {
        borderColor: 'border-l-primary-300',
        textColor: 'text-primary-300',
    },
    'fintech-crypto': {
        borderColor: 'border-l-primary-500',
        textColor: 'text-primary-500',
    },
    'leveraged-etf': {
        borderColor: 'border-l-ui-warning',
        textColor: 'text-ui-warning',
    },
    'healthcare-bio': {
        borderColor: 'border-l-secondary-400',
        textColor: 'text-secondary-400',
    },
    'quantum-computing': {
        borderColor: 'border-l-primary-200',
        textColor: 'text-primary-200',
    },
    space: {
        borderColor: 'border-l-primary-100',
        textColor: 'text-primary-100',
    },
    'ev-mobility': {
        borderColor: 'border-l-secondary-300',
        textColor: 'text-secondary-300',
    },
    'energy-industrial': {
        borderColor: 'border-l-chart-bearish',
        textColor: 'text-chart-bearish',
    },
};

export function TickerCategories() {
    const cards: CategoryCard[] = TICKER_CATEGORIES.map(category => ({
        id: category.id,
        label: category.label,
        borderColor: CATEGORY_STYLES[category.id].borderColor,
        textColor: CATEGORY_STYLES[category.id].textColor,
        items: category.items,
    }));

    return (
        <CategoryCardGrid
            heading="섹터별 인기 종목"
            ariaLabel="섹터별 인기 종목 탐색"
            cards={cards}
        />
    );
}
```

- [ ] **Step 5: `popular-tickers.test.ts` 단언 갱신**

`.tickers` 기반 단언을 `.items` 기반으로 교체. 구체적으로:

- line 17: `expect(category.tickers.length)...` → `expect(category.items.length).toBeGreaterThan(0);`
- 제목 문구 `id, label, tickers를 가진다` → `id, label, items를 가진다`(선택).
- "각 카테고리 내 ticker에 중복이 없다" 블록(line 26~32):
  ```ts
  it('각 카테고리 내 심볼에 중복이 없다', () => {
      for (const category of TICKER_CATEGORIES) {
          const symbols = category.items.map(i => i.symbol);
          expect(new Set(symbols).size).toBe(symbols.length);
      }
  });
  ```
- "모든 ticker가 비어있지 않은 문자열이다"(line 34~41):
  ```ts
  it('모든 심볼과 한글명이 비어있지 않은 문자열이다', () => {
      for (const category of TICKER_CATEGORIES) {
          for (const item of category.items) {
              expect(typeof item.symbol).toBe('string');
              expect(item.symbol.length).toBeGreaterThan(0);
              expect(typeof item.name).toBe('string');
              expect(item.name.length).toBeGreaterThan(0);
          }
      }
  });
  ```
- megacap 블록(line 43~48):
  ```ts
  it('megacap 카테고리가 존재한다', () => {
      const megacap = TICKER_CATEGORIES.find(c => c.id === 'megacap');
      expect(megacap).toBeDefined();
      const symbols = megacap!.items.map(i => i.symbol);
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('MSFT');
  });
  ```
- space 블록(line 50~63):
  ```ts
  it('순수 우주 기업 카테고리를 포함한다', () => {
      const space = TICKER_CATEGORIES.find(c => c.id === 'space');
      expect(space).toBeDefined();
      expect(space!.label).toBe('우주·항공우주');
      expect(space!.items.map(i => i.symbol)).toEqual([
          'SPCX',
          'RKLB',
          'ASTS',
          'LUNR',
          'RDW',
          'PL',
          'SPCE',
      ]);
  });
  ```
`POPULAR_TICKERS` describe 블록(line 66 이하)은 변경 없음.

- [ ] **Step 6: `TickerCategories.test.tsx` mock/단언 갱신**

mock(line 23~36)의 `tickers` → `items`:

```tsx
vi.mock('@/shared/config/popular-tickers', () => ({
    TICKER_CATEGORIES: [
        {
            id: 'megacap',
            label: '메가캡·지수',
            items: [
                { symbol: 'AAPL', name: '애플' },
                { symbol: 'MSFT', name: '마이크로소프트' },
            ],
        },
        {
            id: 'ai-semiconductor',
            label: 'AI·반도체',
            items: [{ symbol: 'NVDA', name: '엔비디아' }],
        },
    ],
}));
```

list aria-label 단언(line 85)을 새 패턴으로:
```tsx
screen.getByRole('list', { name: /메가캡·지수 종목 목록/ })
```
(기존 `메가캡·지수 섹터 종목 목록` → `메가캡·지수 종목 목록`.)

링크 단언(line 58~62)은 regex `/AAPL/`, `/NVDA/`라 칩 텍스트(`애플 AAPL`)에 여전히 매칭되어 그대로 통과한다 — 변경 불필요.

- [ ] **Step 7: 통합 테스트 mock/쿼리 갱신**

`src/__integration__/homePageCategoryBrowse.test.tsx` — mock(line 20~33)을 items로, 그리고 exact 링크 쿼리를 regex로:

mock:
```tsx
vi.mock('@/shared/config/popular-tickers', () => ({
    TICKER_CATEGORIES: [
        {
            id: 'megacap',
            label: 'Mega Cap',
            items: [
                { symbol: 'AAPL', name: 'Apple' },
                { symbol: 'MSFT', name: 'Microsoft' },
                { symbol: 'GOOGL', name: 'Alphabet' },
            ],
        },
        {
            id: 'ai-semiconductor',
            label: 'AI & Semiconductor',
            items: [
                { symbol: 'NVDA', name: 'Nvidia' },
                { symbol: 'AMD', name: 'AMD' },
            ],
        },
    ],
}));
```
링크 쿼리(line 44~47): `{ name: 'AAPL' }` → `{ name: /AAPL/ }`, `{ name: 'NVDA' }` → `{ name: /NVDA/ }`. (칩 접근명이 `Apple AAPL`로 바뀌어 exact 매칭이 깨지므로 regex로 변경.)

`src/__integration__/journeyNewUser.test.tsx` — mock(line 36~44)을 items로:
```tsx
vi.mock('@/shared/config/popular-tickers', () => ({
    TICKER_CATEGORIES: [
        {
            id: 'megacap',
            label: 'Mega Cap',
            items: [
                { symbol: 'AAPL', name: 'Apple' },
                { symbol: 'MSFT', name: 'Microsoft' },
                { symbol: 'GOOGL', name: 'Alphabet' },
            ],
        },
    ],
}));
```
이 파일이 링크를 exact name으로 조회하는 부분이 있으면(line 60 이후 확인) 동일하게 regex로 교체.

- [ ] **Step 8: 영향 테스트 일괄 green 확인**

Run: `yarn test src/shared/config/__tests__/popular-tickers.test.ts src/widgets/home/__tests__/TickerCategories.test.tsx src/__integration__/homePageCategoryBrowse.test.tsx src/__integration__/journeyNewUser.test.tsx`
Expected: PASS 전부.

---

## Task 6: 전체 검증 (lint · test · build · 시각 실측)

**Files:** 없음(검증 전용)

- [ ] **Step 1: 린트**

Run: `yarn lint`
Expected: 에러 0. (FSD 경계: `widgets/home` → `shared` 정방향만 사용, 위반 없음.)

- [ ] **Step 2: 전체 테스트**

Run: `yarn test`
Expected: 전부 PASS. 시간 의존 flaky 테스트(`CachedMarketDataProvider`, `fmpMarketNewsClient`)가 본 변경과 무관하게 실패하면 무시하고 보고(메모리: 미국 장중/날짜 경계 이슈).

- [ ] **Step 3: 빌드 (exit code 직접 캡처)**

Run: `yarn build > /tmp/home-crypto-build.log 2>&1; echo "exit=$?"`
Expected: `exit=0`. (메모리: 파이프로 빌드 실패가 가려지지 않도록 exit code 직접 확인.)

- [ ] **Step 4: 시각 실측 (오케스트레이터가 Chrome으로)**

`yarn dev`(워크트리, port 4200) 기동 후 `http://localhost:4200`:
- 768·900·987·1023px: hero(제목·검색창·칩·StatsBar)와 하단 섹션이 모두 좌측 정렬로 일관되는지.
- <768px: 기존 가운데 정렬 유지(회귀 없음).
- '섹터별 인기 종목' 아래 '암호화폐 인기 종목' 카드 섹션이 동일 디자인으로 렌더되고, 칩이 한글명+티커로 표시되며 클릭 시 `/BTCUSD` 등으로 이동.
- placeholder가 `종목 입력 (예: AAPL, 애플, BTC, 비트코인)`.

---

## Self-Review 체크 (작성자 확인 완료)

- **스펙 커버리지:** placeholder(T1), 정렬(T2), 공유 컴포넌트(T3), 크립토 데이터+섹션(T4), 주식 한글명+shape(T5), 검증(T6) — 스펙 전 항목 매핑됨.
- **타입 일관성:** `CategoryCard`/`CategoryCardItem`(컴포넌트 export), `TickerCategory.items`, `CryptoCategory.items`, `CryptoCategoryId`('major'|'altcoin') 전 Task에서 동일 사용.
- **플레이스홀더:** 불확실 한글명 3건은 T5-Step3에서 실측 검증으로 확정(명시적 단계). 그 외 미정 없음.
- **green 유지:** T4는 `TickerCategory` shape 미변경(크립토만) → 독립 green. T5는 shape 변경+소비자+테스트 원자 처리 → green. 각 Task 종료 시 트리 컴파일·테스트 통과.
