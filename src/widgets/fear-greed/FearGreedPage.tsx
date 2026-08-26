'use client';

import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
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
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface FearGreedPageProps {
    symbol: string;
    fmpSymbol?: string;
    /**
     * 자기 정규화 경고 배지를 숨긴다.
     *
     * `/[symbol]/fear-greed`는 이 컴포넌트 **위에** 서버 렌더된
     * `FearGreedFactsSummary`를 함께 그리고, 거기에 이미 같은 문구
     * (`WARNING_TEXT`)가 문단으로 들어간다. 둘 다 그리면 하이드레이션 뒤
     * 같은 90자 문장이 DOM에 두 번 남고 스크린리더도 두 번 읽는다.
     *
     * 서버 쪽을 지울 수는 없다 — 이 컴포넌트는 `useHydrated` 게이트라
     * 크롤러에게는 아무것도 안 보이고, 그 문구가 크롤 텍스트에 남는 유일한 경로가
     * 서버 쪽이다. 그래서 XOR 방향이 "클라이언트를 끈다"로 정해진다
     * (`congress`의 `hideView` 패턴과 같은 모양).
     */
    hideSelfNormWarning?: boolean;
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
 * The fix: render a stable, score-free
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
                    <div className="h-4 w-40 animate-pulse rounded bg-secondary-700/40" />
                    <div className="h-48 w-full animate-pulse rounded bg-secondary-700/40" />
                    <div className="h-16 w-full animate-pulse rounded bg-secondary-700/40" />
                </section>
                <section className="flex flex-col gap-3">
                    <div className="h-20 w-full animate-pulse rounded bg-secondary-700/40" />
                    <div className="h-20 w-full animate-pulse rounded bg-secondary-700/40" />
                </section>
            </div>
            <section className="flex flex-col gap-2">
                <div className="h-4 w-32 animate-pulse rounded bg-secondary-700/40" />
                <div className="h-40 w-full animate-pulse rounded bg-secondary-700/40" />
            </section>
        </div>
    );
}

export function FearGreedPage({
    symbol,
    fmpSymbol,
    hideSelfNormWarning = false,
}: FearGreedPageProps) {
    const themeVersion = useThemeVersion();
    const isHydrated = useHydrated();
    const { snapshot, history } = useFearGreedFromSymbol({ symbol, fmpSymbol });

    const chatState = buildChatState(snapshot);
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
        // fear-greed is deterministic (computed from bars client-side, no async
        // analysis job to dispatch). The snapshot is ready once bars load — no
        // trigger action needed.
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
            <div className="flex flex-col gap-2 p-6 text-sm text-secondary-400">
                <p>공포 탐욕 지수 산출에 필요한 데이터가 부족합니다.</p>
                <p className="text-xs text-secondary-500">
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
                    <h2 className={HEADING_SECTION}>
                        현재 공포 탐욕 지수와 기간별 비교
                    </h2>
                    <FearGreedHero snapshot={snapshot} />
                    <FearGreedComparisonGauges history={history} />
                    {!hideSelfNormWarning && (
                        <SelfNormWarningBadge warning={snapshot.warning} />
                    )}
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
                <h2 className={HEADING_SECTION}>
                    공포 탐욕 지수 추이 (최근 1년)
                </h2>
                <FearGreedHistoricalChart
                    key={themeVersion}
                    history={history}
                />
            </section>

            <footer className="text-xs text-secondary-500">
                {formatConfidenceFooter(
                    snapshot.sampleSize,
                    snapshot.confidence
                )}
            </footer>
        </div>
    );
}
