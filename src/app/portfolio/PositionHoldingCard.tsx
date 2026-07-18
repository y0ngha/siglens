'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getBarsAction } from '@/entities/bars/actions';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import { BARS_STALE_TIME_MS, QUERY_KEYS } from '@/shared/config/queryConfig';
import { buildTechnicalFacts } from '@/views/symbol/utils/technicalFacts';
import {
    computePosition,
    PositionBuilding,
} from '@/widgets/portfolio-position';
import {
    dynamicDecimals,
    formatSignedPercent,
    formatUsdPrice,
} from '@/shared/lib/priceFormat';
import { cn } from '@/shared/lib/cn';
import type { PortfolioHoldingView } from '@/entities/portfolio';

type HoldingCardData = Pick<
    PortfolioHoldingView,
    'symbol' | 'companyName' | 'fmpSymbol' | 'averagePrice'
>;

interface PositionHoldingCardProps {
    holding: HoldingCardData;
}

/** sub-$1 정밀도 자산군에서 "$0"으로 뭉개지지 않도록 유효자리를 보존한다 (PositionBuilding과 동일 규칙). */
function formatUsd(value: number): string {
    if (value !== 0 && Math.abs(value) < 1) {
        return `$${value.toFixed(dynamicDecimals(value))}`;
    }
    return `$${formatUsdPrice(value)}`;
}

/**
 * 뷰포트 진입을 1회만 감지한다(진입 후 관찰 중단) — /portfolio가 보유종목을
 * 아무리 많이 가진 회원이라도, 화면에 보이는 카드만 자기 종목의 bars를
 * fetch하도록 게이팅하는 지연 로드 트리거. IntersectionObserver 미지원
 * 환경(구형 브라우저)에서는 즉시 visible로 degrade한다.
 */
function useInViewOnce<T extends Element>(): [
    (node: T | null) => void,
    boolean,
] {
    const [node, setNode] = useState<T | null>(null);
    // 구형 브라우저(IntersectionObserver 미지원) 방어를 lazy initializer로 결정해,
    // 이후 effect 본문에서 setState를 동기 호출하지 않게 한다
    // (react-hooks/set-state-in-effect — MISTAKES.md #10과 동일 원칙).
    const [isVisible, setIsVisible] = useState(
        () => typeof IntersectionObserver === 'undefined'
    );

    useEffect(() => {
        if (node === null || isVisible) return;
        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    setIsVisible(true);
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, isVisible]);

    return [setNode, isVisible];
}

// resolved 카드 본문(building min-h-280 + gap-3 + dl 3행)의 대략적 높이에 맞춰
// skeleton/degraded도 같은 min-h를 잡는다 — 그렇지 않으면 lazy-resolve 시점에
// 카드 높이가 확 늘어나 스크롤 위치가 튀는 CLS가 발생한다(audit finding #9).
const CARD_BODY_MIN_H = 'min-h-[350px]';

function CardSkeleton({ symbol }: { symbol: string }) {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="holding-card-loading"
            className={cn(
                CARD_BODY_MIN_H,
                'flex w-full max-w-[200px] flex-col items-center justify-center gap-2'
            )}
        >
            <span className="sr-only">{symbol} 위치를 불러오는 중이에요</span>
            <div
                aria-hidden="true"
                className="bg-secondary-800 h-32 w-32 animate-pulse rounded"
            />
        </div>
    );
}

interface CardDegradedProps {
    avg: number;
    message: string;
}

function CardDegraded({ avg, message }: CardDegradedProps) {
    return (
        <div
            data-testid="holding-card-degraded"
            className={cn(
                CARD_BODY_MIN_H,
                'border-secondary-700 flex w-full max-w-[200px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-3 text-center'
            )}
        >
            <span className="text-secondary-400 text-xs">{message}</span>
            <span className="text-secondary-400 text-xs tabular-nums">
                평단 {formatUsd(avg)}
            </span>
        </div>
    );
}

/**
 * 보유종목 하나에 대한 "포지션 빌딩" 카드 — `/portfolio` 그리드의 셀 하나.
 * 자기 종목의 최근 bars를 뷰포트 진입 시점에만 lazy fetch한다(기존
 * useBars/getBarsAction React-Query 캐시 키를 공유해 심볼 페이지를 먼저
 * 방문했다면 warm cache를 재사용). 실패/기하 계산 불가 어느 쪽이든 카드
 * 단위로 degrade하고 그리드 전체는 절대 깨지지 않는다(design §에러/엣지).
 */
export function PositionHoldingCard({ holding }: PositionHoldingCardProps) {
    const [setNode, isVisible] = useInViewOnce<HTMLDivElement>();
    const avg = Number(holding.averagePrice);
    const fmpSymbol = holding.fmpSymbol ?? undefined;

    const { data, isLoading, isError } = useQuery({
        queryKey: QUERY_KEYS.bars(holding.symbol, DEFAULT_TIMEFRAME, fmpSymbol),
        queryFn: () =>
            getBarsAction(holding.symbol, DEFAULT_TIMEFRAME, fmpSymbol),
        enabled: isVisible,
        staleTime: BARS_STALE_TIME_MS,
    });

    const facts = data ? buildTechnicalFacts(data.bars, data.indicators) : null;
    const isAvgValid = Number.isFinite(avg) && avg > 0;
    const model =
        facts !== null && isAvgValid
            ? computePosition({
                  low52w: facts.low52w,
                  high52w: facts.high52w,
                  current: facts.lastClose,
                  avg,
              })
            : null;

    const isSettled = isVisible && !isLoading;
    const isDegraded =
        isSettled && (isError || facts === null || model === null);

    return (
        // 그리드 카드 전체를 해당 종목의 "내 위치" 탭으로 가는 내비게이션 어포던스로
        // 만든다(audit finding #8) — hover/focus-visible은 Link(바깥)에서, 실제
        // 시각 chrome(ring/bg/padding)은 안쪽 div가 그대로 유지해 기존 시각을
        // 보존한다. IntersectionObserver 대상(ref)도 안쪽 div에 그대로 둔다.
        <Link
            href={`/${holding.symbol}/position`}
            className="focus-visible:ring-primary-500 group block rounded-xl transition-shadow focus-visible:ring-2 focus-visible:outline-none"
        >
            <div
                ref={setNode}
                data-testid="portfolio-holding-card"
                className="ring-secondary-800 group-hover:ring-secondary-600 bg-secondary-900/60 flex flex-col items-center gap-3 rounded-xl p-4 ring-1 transition-colors"
            >
                <div className="flex w-full items-baseline justify-between gap-2">
                    <span className="text-secondary-100 text-sm font-semibold">
                        {holding.symbol}
                    </span>
                    {holding.companyName && (
                        <span className="text-secondary-400 truncate text-xs">
                            {holding.companyName}
                        </span>
                    )}
                </div>

                {!isSettled && <CardSkeleton symbol={holding.symbol} />}

                {isSettled && isDegraded && (
                    <CardDegraded
                        avg={avg}
                        message={
                            isAvgValid
                                ? '범위 데이터를 불러오지 못했어요'
                                : '데이터 부족'
                        }
                    />
                )}

                {isSettled &&
                    !isDegraded &&
                    facts !== null &&
                    model !== null && (
                        <>
                            <PositionBuilding
                                symbol={holding.symbol}
                                model={model}
                                low52w={facts.low52w}
                                high52w={facts.high52w}
                                current={facts.lastClose}
                                avg={avg}
                                className="max-w-[200px]"
                            />
                            <dl className="text-secondary-300 grid w-full grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                <dt className="text-secondary-400">평단</dt>
                                <dd className="text-right tabular-nums">
                                    {formatUsd(avg)}
                                </dd>
                                <dt className="text-secondary-400">현재가</dt>
                                <dd className="text-right tabular-nums">
                                    {formatUsd(facts.lastClose)}
                                </dd>
                                <dt className="text-secondary-400">수익률</dt>
                                <dd
                                    className={cn(
                                        'text-right tabular-nums',
                                        model.returnPct >= 0
                                            ? 'text-ui-success-text'
                                            : 'text-ui-danger-text'
                                    )}
                                >
                                    {formatSignedPercent(model.returnPct)}
                                </dd>
                            </dl>
                        </>
                    )}
            </div>
        </Link>
    );
}
