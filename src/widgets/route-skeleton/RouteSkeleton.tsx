'use client';

import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { RouteKind } from '@/shared/config/routeKind';

/**
 * 종목 밖 라우트로 들어가는 순간 루트 page slot에 그리는 골격.
 *
 * 클릭 직후, 목적지 RSC가 오기 전에 보인다(`NavigationPendingContext` JSDoc). 그래서
 * 목적지에 대해 아는 것은 경로뿐이다 — 데이터도, 그 라우트의 번역 메시지도 아직 없다.
 *
 * - **번역 문구를 쓰지 않는다.** 루트의 클라이언트 메시지는 크롬 네임스페이스만 싣는다
 *   (`CHROME_CLIENT_PATHS`). 전부 `aria-hidden` 장식이고, 진행 상태는 상단 진행 바의
 *   sr-only 문구가 알린다.
 * - **`'use client'`다.** 루트 레이아웃이 모든 라우트에서 이 요소를 슬롯에 넘기므로,
 *   서버 컴포넌트면 골격 마크업이 전 라우트 RSC 페이로드에 직렬화된다.
 * - **컴포넌트를 종류마다 만들지 않는다.** 전 라우트 공용 번들에 실리므로 블록 네 종의
 *   배열 설정으로만 그린다. 바깥 컨테이너 클래스는 실제 페이지의 `<main>`과 같게 둬야
 *   도착할 때 좌우로 튀지 않는다(`docs/conventions/DESIGN.md` §폭 규약).
 *
 * 종목 라우트는 여기서 그리지 않는다 — 헤더·탭까지 같은 틀인 `SymbolEntrySkeleton`이 맡는다.
 */

type Block =
    /** 페이지 제목(h1) 자리. */
    | { readonly type: 'title'; readonly className: string }
    /** 본문 문단 자리 — 줄 수만큼. */
    | { readonly type: 'lines'; readonly count: number }
    /** 카드 격자. */
    | {
          readonly type: 'cards';
          readonly count: number;
          readonly grid: string;
          readonly card: string;
      }
    /** 큰 덩어리(차트·표·패널). */
    | { readonly type: 'panel'; readonly className: string };

interface SkeletonLayout {
    /** 실제 페이지 `<main>`의 폭·여백 클래스. */
    readonly outer: string;
    /** `<main>` 안에서 한 번 더 폭을 좁히는 페이지용. */
    readonly inner?: string;
    readonly blocks: readonly Block[];
}

const BAR = 'animate-pulse rounded bg-secondary-700 motion-reduce:animate-none';
const TITLE = 'h-8 w-56 sm:h-9 sm:w-72';
const LINE_WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3'] as const;
const READING = 'mx-auto w-full max-w-5xl space-y-6 px-4 py-8';

const LAYOUTS: Readonly<Record<Exclude<RouteKind, 'symbol'>, SkeletonLayout>> =
    {
        home: {
            outer: 'page-container space-y-6 py-12 sm:py-16',
            blocks: [
                { type: 'title', className: 'h-10 w-4/5 max-w-xl sm:h-12' },
                { type: 'lines', count: 2 },
                { type: 'panel', className: 'h-12 max-w-xl' },
                {
                    type: 'cards',
                    count: 3,
                    grid: 'grid-cols-1 sm:grid-cols-3',
                    card: 'h-28',
                },
            ],
        },
        market: {
            outer: 'page-container space-y-6 pt-6 pb-8',
            blocks: [
                { type: 'panel', className: 'h-4 w-32' },
                { type: 'title', className: TITLE },
                {
                    type: 'cards',
                    count: 4,
                    grid: 'grid-cols-2 lg:grid-cols-4',
                    card: 'h-24',
                },
                { type: 'panel', className: 'h-72' },
            ],
        },
        fearGreed: {
            outer: 'page-container space-y-6 pt-6 pb-8',
            blocks: [
                { type: 'panel', className: 'h-4 w-32' },
                { type: 'title', className: TITLE },
                { type: 'lines', count: 3 },
                { type: 'panel', className: 'h-56' },
                { type: 'panel', className: 'h-40' },
            ],
        },
        economy: {
            outer: READING,
            blocks: [
                { type: 'title', className: TITLE },
                { type: 'lines', count: 3 },
                {
                    type: 'cards',
                    count: 6,
                    grid: 'grid-cols-2 sm:grid-cols-3',
                    card: 'h-24',
                },
                { type: 'panel', className: 'h-64' },
            ],
        },
        news: {
            outer: READING,
            blocks: [
                { type: 'title', className: TITLE },
                { type: 'lines', count: 2 },
                {
                    type: 'cards',
                    count: 6,
                    grid: 'grid-cols-1 sm:grid-cols-2',
                    card: 'h-36',
                },
            ],
        },
        symbols: {
            outer: 'mx-auto w-full max-w-5xl space-y-8 px-4 py-8',
            blocks: [
                { type: 'title', className: TITLE },
                { type: 'lines', count: 1 },
                {
                    type: 'cards',
                    count: 16,
                    grid: 'grid-cols-2 sm:grid-cols-4',
                    card: 'h-10',
                },
            ],
        },
        backtesting: {
            outer: 'page-container space-y-6 py-12',
            blocks: [
                { type: 'title', className: 'mx-auto h-9 w-64 sm:w-96' },
                { type: 'lines', count: 2 },
                {
                    type: 'cards',
                    count: 3,
                    grid: 'grid-cols-1 sm:grid-cols-3',
                    card: 'h-24',
                },
                {
                    type: 'cards',
                    count: 3,
                    grid: 'grid-cols-1',
                    card: 'h-40',
                },
            ],
        },
        article: {
            outer: 'mx-auto w-full max-w-4xl space-y-6 px-4 pt-6 pb-16 sm:pt-8',
            blocks: [
                { type: 'panel', className: 'h-4 w-24' },
                { type: 'title', className: 'h-9 w-4/5 max-w-xl sm:h-11' },
                { type: 'lines', count: 3 },
                {
                    type: 'cards',
                    count: 4,
                    grid: 'grid-cols-1 sm:grid-cols-2',
                    card: 'h-36',
                },
            ],
        },
        legal: {
            outer: 'page-container flex flex-col items-center py-12 sm:py-16',
            inner: 'w-full max-w-3xl space-y-6',
            blocks: [
                { type: 'panel', className: 'h-4 w-28' },
                { type: 'title', className: 'h-9 w-64 sm:h-10' },
                { type: 'lines', count: 4 },
                { type: 'lines', count: 4 },
                { type: 'lines', count: 4 },
            ],
        },
        auth: {
            outer: 'flex items-center justify-center px-4 py-12',
            inner: cn(SURFACE_CARD, 'w-full max-w-md space-y-5 p-6'),
            blocks: [
                { type: 'title', className: 'h-7 w-40' },
                { type: 'lines', count: 1 },
                { type: 'panel', className: 'h-11' },
                { type: 'panel', className: 'h-11' },
                { type: 'panel', className: 'h-11' },
            ],
        },
        account: {
            outer: 'px-4 py-12',
            inner: 'mx-auto w-full max-w-2xl space-y-6',
            blocks: [
                { type: 'title', className: 'h-7 w-40' },
                { type: 'panel', className: 'h-40' },
                { type: 'panel', className: 'h-32' },
            ],
        },
        portfolio: {
            outer: 'px-4 py-12',
            inner: 'mx-auto w-full max-w-5xl space-y-6',
            blocks: [
                { type: 'title', className: 'h-7 w-48' },
                { type: 'lines', count: 1 },
                {
                    type: 'cards',
                    count: 6,
                    grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                    card: 'h-40',
                },
            ],
        },
        share: {
            outer: 'mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6',
            blocks: [
                { type: 'title', className: 'h-8 w-64' },
                { type: 'panel', className: 'h-72' },
                { type: 'lines', count: 4 },
            ],
        },
        generic: {
            outer: 'page-container space-y-6 py-8',
            blocks: [
                { type: 'title', className: TITLE },
                { type: 'lines', count: 4 },
                { type: 'panel', className: 'h-64' },
            ],
        },
    };

function SkeletonBlock({ block }: { block: Block }) {
    switch (block.type) {
        case 'title':
            return <div className={cn(BAR, block.className)} />;
        case 'panel':
            return <div className={cn(BAR, 'rounded-lg', block.className)} />;
        case 'lines':
            return (
                <div className="space-y-2">
                    {Array.from({ length: block.count }, (_, i) => (
                        <div
                            key={i}
                            className={cn(
                                BAR,
                                'h-4',
                                LINE_WIDTHS[i % LINE_WIDTHS.length]
                            )}
                        />
                    ))}
                </div>
            );
        case 'cards':
            return (
                <div className={cn('grid gap-3', block.grid)}>
                    {Array.from({ length: block.count }, (_, i) => (
                        <div
                            key={i}
                            className={cn(BAR, 'rounded-lg', block.card)}
                        />
                    ))}
                </div>
            );
    }
}

interface RouteSkeletonProps {
    readonly kind: Exclude<RouteKind, 'symbol'>;
}

export function RouteSkeleton({ kind }: RouteSkeletonProps) {
    const layout = LAYOUTS[kind];
    const blocks = layout.blocks.map((block, i) => (
        <SkeletonBlock key={i} block={block} />
    ));
    return (
        // 첫 화면을 채워 푸터가 골격 바로 아래로 끌려 올라오지 않게 한다.
        <div
            aria-hidden="true"
            data-route-skeleton={kind}
            className={cn(
                'min-h-[calc(100dvh-var(--header-h))] flex-1',
                layout.outer
            )}
        >
            {layout.inner === undefined ? (
                blocks
            ) : (
                <div className={layout.inner}>{blocks}</div>
            )}
        </div>
    );
}
