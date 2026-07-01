'use client';

import { useMemo } from 'react';
import { useFearGreedFromSymbol } from './hooks/useFearGreedFromSymbol';
import { FearGreedHero } from './FearGreedHero';
import { FearGreedComparisonGauges } from './FearGreedComparisonGauges';
import { FearGreedGroupBar } from './FearGreedGroupBar';
import { FearGreedHistoricalChart } from '@/widgets/chart/FearGreedHistoricalChart';
import { SelfNormWarningBadge } from './SelfNormWarningBadge';
import { formatConfidenceFooter } from '@/shared/lib/fearGreedLabels';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { buildChatState } from './utils/buildChatState';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useRegisterShareable } from '@/features/share';

interface FearGreedPageProps {
    symbol: string;
    fmpSymbol?: string;
}

/**
 * Skeleton shown during SSR and the synchronous first-client render.
 *
 * useFearGreedFromSymbol → useBars → useSuspenseQuery has staleTime:30 s.
 * The dehydrated seed (quantized, forming-bar-stripped) is always stale on
 * the client (daily bar updatedAt << Date.now()), so React Query fires a
 * background refetch immediately after mount.  For crypto (CRYPTO_SESSION,
 * always-open), the SSR seed strips the forming bar but the refetched bars
 * include it → SSR score ≠ first-client score → React #418.
 *
 * The fix mirrors FearGreedHeaderChipMounted: render a stable, score-free
 * skeleton during hydration so SSR HTML and the first sync client render are
 * identical, then swap in the real score-driven UI after useEffect fires.
 * This is intentional: the page comment notes "점수는 클라가 bars로 계산"
 * (score is computed client-side); the skeleton makes that explicit.
 */
function FearGreedPageSkeleton() {
    return (
        <div
            role="status"
            className="flex flex-col gap-6 p-4 md:p-6"
            aria-busy="true"
            aria-label="공포 탐욕 지수 로딩 중"
        >
            <div className="grid gap-6 md:grid-cols-2">
                <section className="flex flex-col gap-3">
                    <div className="bg-secondary-700/40 h-4 w-40 animate-pulse rounded" />
                    <div className="bg-secondary-700/40 h-48 w-full animate-pulse rounded" />
                    <div className="bg-secondary-700/40 h-16 w-full animate-pulse rounded" />
                </section>
                <section className="flex flex-col gap-3">
                    <div className="bg-secondary-700/40 h-20 w-full animate-pulse rounded" />
                    <div className="bg-secondary-700/40 h-20 w-full animate-pulse rounded" />
                </section>
            </div>
            <section className="flex flex-col gap-2">
                <div className="bg-secondary-700/40 h-4 w-32 animate-pulse rounded" />
                <div className="bg-secondary-700/40 h-40 w-full animate-pulse rounded" />
            </section>
        </div>
    );
}

export function FearGreedPage({ symbol, fmpSymbol }: FearGreedPageProps) {
    const isHydrated = useHydrated();
    const { snapshot, history } = useFearGreedFromSymbol({ symbol, fmpSymbol });

    const chatState = useMemo(() => buildChatState(snapshot), [snapshot]);
    usePublishSymbolChat(chatState);
    useRegisterShareable({
        kind: 'fear-greed',
        status: snapshot ? 'success' : 'unavailable',
        result: snapshot ?? null,
        context: {
            symbol,
            displayName: symbol,
            // FearGreedSnapshot has no analyzedAt; resolveAsOf falls back to createdAt.
        },
        trigger: () => {},
    });

    // During SSR and the first synchronous client render, suppress the
    // score-driven output entirely.  The snapshot value may differ between
    // the SSR-quantized seed and the client's first refetch (especially for
    // crypto, which always has a forming bar), so rendering it during
    // hydration trips React #418.  After useEffect fires (isHydrated=true)
    // the client owns the score and any divergence is a normal React update,
    // not a hydration error.
    if (!isHydrated) {
        return <FearGreedPageSkeleton />;
    }

    if (!snapshot) {
        return (
            <div className="text-secondary-400 flex flex-col gap-2 p-6 text-sm">
                <p>공포 탐욕 지수 산출에 필요한 데이터가 부족합니다.</p>
                <p className="text-secondary-500 text-xs">
                    상장한 지 얼마 되지 않았거나 거래량 데이터가 비어 있는
                    종목일 수 있습니다. 며칠 뒤 다시 확인하거나, 같은 섹터의
                    다른 종목을 살펴보세요.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div className="grid gap-6 md:grid-cols-2">
                <section className="flex flex-col gap-3">
                    <h2 className="text-secondary-300 text-sm font-medium">
                        현재 공포 탐욕 지수와 기간별 비교
                    </h2>
                    <FearGreedHero snapshot={snapshot} />
                    <FearGreedComparisonGauges history={history} />
                    <SelfNormWarningBadge warning={snapshot.warning} />
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="sr-only">
                        Flow와 Trend 그룹별 score breakdown
                    </h2>
                    {snapshot.groups.map(group => (
                        <FearGreedGroupBar key={group.name} group={group} />
                    ))}
                </section>
            </div>

            <section className="flex flex-col gap-2">
                <h2 className="text-secondary-300 text-sm font-medium">
                    공포 탐욕 지수 추이 (최근 1년)
                </h2>
                <FearGreedHistoricalChart history={history} />
            </section>

            <footer className="text-secondary-500 text-xs">
                {formatConfidenceFooter(
                    snapshot.sampleSize,
                    snapshot.confidence
                )}
            </footer>
        </div>
    );
}
