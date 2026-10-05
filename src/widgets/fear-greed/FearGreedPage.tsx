'use client';

import { useTranslations } from 'next-intl';
import { SampleFooterText } from '@/shared/ui/SampleFooterText';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { useFearGreedFromSymbol } from './hooks/useFearGreedFromSymbol';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import { FearGreedHero } from './FearGreedHero';
import { FearGreedComparisonGauges } from './FearGreedComparisonGauges';
import { FearGreedGroupBar } from './FearGreedGroupBar';
import dynamic from 'next/dynamic';
import { SelfNormWarningBadge } from './SelfNormWarningBadge';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useRegisterShareable } from '@/features/share/model/ShareableAnalysisContext';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

/**
 * 추이 차트는 `lightweight-charts`(원본 ~177KB)를 쓴다. 정적으로 import하면 이 탭의 첫 JS에
 * 실리는데 차트는 하이드레이션 뒤에야 그려지고 첫 화면 아래에 있다(2026-10-05 JS 커버리지:
 * `/AAPL/fear-greed`에서 이 청크 95% 미사용). 차트 탭처럼 지연 로드한다. 자리는 차트와 같은
 * 높이로 미리 잡아 도착할 때 아래 내용이 밀리지 않게 한다.
 */
const FearGreedHistoricalChart = dynamic(
    () =>
        import('@/widgets/fear-greed/FearGreedHistoricalChart').then(
            m => m.FearGreedHistoricalChart
        ),
    {
        ssr: false,
        loading: () => (
            <div
                aria-hidden="true"
                className="h-[240px] w-full animate-pulse rounded bg-secondary-800/40 motion-reduce:animate-none"
            />
        ),
    }
);

interface FearGreedPageProps {
    symbol: string;
    fmpSymbol?: string;
    /**
     * 자기 정규화 경고 배지를 숨긴다.
     *
     * `/[symbol]/fear-greed`는 이 컴포넌트 **위에** 서버 렌더된
     * `FearGreedFactsSummary`를 함께 그리고, 거기에 이미 같은 문구
     * (`WARNING_TEXT_KEY`)가 문단으로 들어간다. 둘 다 그리면 하이드레이션 뒤
     * 같은 90자 문장이 DOM에 두 번 남고 스크린리더도 두 번 읽는다.
     *
     * 서버 쪽을 지울 수는 없다 — 이 컴포넌트는 `useHydrated` 게이트라
     * 크롤러에게는 아무것도 안 보이고, 그 문구가 크롤 텍스트에 남는 유일한 경로가
     * 서버 쪽이다. 그래서 XOR 방향이 "클라이언트를 끈다"로 정해진다.
     */
    hideSelfNormWarning?: boolean;
    /**
     * 하단 표본 수 안내(`<footer>`)를 숨긴다.
     *
     * `hideSelfNormWarning`과 같은 이유다 — `/[symbol]/fear-greed`는 이 컴포넌트 **아래에**
     * 서버 렌더된 `FearGreedFactsSummary`를 그리고, 거기에 같은 문장이 이미 있다.
     * 게이지가 먼저 보이도록 순서를 바꾼 뒤에도 두 문장이 한 화면에 남으면 중복이다.
     */
    hideSampleFooter?: boolean;
}

/**
 * Skeleton shown during SSR and the synchronous first-client render.
 *
 * useFearGreedFromSymbol → getSymbolFearGreedAction (server-computed from the
 * 5-year daily series) → useSuspenseQuery with staleTime 30 s. The page seeds
 * the query with a score computed from **quantized** bars (forming bar
 * stripped), and that seed is always stale on the client (updatedAt = last
 * closed bar << Date.now()), so React Query refetches right after mount. The
 * action reads the **unquantized** bar cache, so during a session (and always
 * for crypto) the refetched score includes the forming bar → SSR score ≠
 * first-client score → React #418.
 *
 * The fix: render a stable, score-free skeleton during hydration so SSR HTML
 * and the first sync client render are identical, then swap in the real
 * score-driven UI after useEffect fires.
 */
function FearGreedPageSkeleton() {
    const t = useTranslations('widgets.fear-greed');
    return (
        <div
            role="status"
            className="flex flex-col gap-6 p-4 md:p-6"
            aria-busy="true"
            aria-label={t('FearGreedPage.7da634')}
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
    hideSampleFooter = false,
}: FearGreedPageProps) {
    const t = useTranslations('widgets.fear-greed');
    const themeVersion = useThemeVersion();
    const isHydrated = useHydrated();
    // seed 재조회는 사람 입력 이후로 미룬다 — 크롤러 렌더마다 나가던 Server Action을 없앤다.
    const humanInteracted = useHumanInteracted();
    const { snapshot, history } = useFearGreedFromSymbol({
        symbol,
        fmpSymbol,
        refetchEnabled: humanInteracted,
    });

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
                <p>{t('FearGreedPage.d6e558')}</p>
                <p className="text-xs text-secondary-500">
                    {t('FearGreedPage.ef5b22')}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div className="grid gap-6 md:grid-cols-2">
                <section className="flex flex-col gap-3">
                    <h2 className={HEADING_SECTION}>
                        {t('FearGreedPage.29eed9')}
                    </h2>
                    <FearGreedHero snapshot={snapshot} />
                    <FearGreedComparisonGauges history={history} />
                    {!hideSelfNormWarning && (
                        <SelfNormWarningBadge warning={snapshot.warning} />
                    )}
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="sr-only">{t('FearGreedPage.0506ae')}</h2>
                    {snapshot.groups.map(group => (
                        <FearGreedGroupBar key={group.name} group={group} />
                    ))}
                </section>
            </div>

            <section className="flex flex-col gap-2">
                <h2 className={HEADING_SECTION}>{t('FearGreedPage.180c65')}</h2>
                <FearGreedHistoricalChart
                    key={themeVersion}
                    history={history}
                />
            </section>

            {!hideSampleFooter && (
                <footer className="text-xs text-secondary-500">
                    <SampleFooterText
                        confidence={snapshot.confidence}
                        sampleSize={snapshot.sampleSize}
                    />
                </footer>
            )}
        </div>
    );
}
