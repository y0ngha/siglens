'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { SampleFooterText } from '@/shared/ui/SampleFooterText';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { useFearGreedFromSymbol } from './hooks/useFearGreedFromSymbol';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { FearGreedHero } from './FearGreedHero';
import { FearGreedComparisonGauges } from './FearGreedComparisonGauges';
import { FearGreedGroupBar } from './FearGreedGroupBar';
import dynamic from 'next/dynamic';
import { SelfNormWarningBadge } from './SelfNormWarningBadge';
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
     * 서버 쪽(`FearGreedFactsSummary`)을 남기고 이쪽을 끈다 — 그 요약은 이 페이지가
     * 서버에서 계산한 근거 문단이라 문구가 거기 있는 편이 자연스럽다. 그래서 XOR 방향이
     * "클라이언트를 끈다"로 정해진다.
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
    /**
     * 페이지가 서버에서 이 쿼리(`QUERY_KEYS.symbolFearGreed`)를 seed했는가(기본 true).
     *
     * seed가 없으면(서버의 봉 조회 실패 — FMP 429·렌더 예산 초과) `useSuspenseQuery`가
     * 서버 렌더 중에 `getSymbolFearGreedAction`(Server Function)을 부르고, React가 그 호출을
     * 던진다("Server Functions cannot be called during initial render"). 위에 Suspense 경계가
     * 없어 페이지 전체가 500이 된다. 그래서 seed가 없으면 서버와 첫 클라 렌더는 스켈레톤만
     * 그리고, 쿼리는 하이드레이션 뒤 브라우저에서만 마운트한다 — 차트 라우트의 `hasBarsSeed`와
     * 같은 처리다.
     */
    hasSeed?: boolean;
}

/** seed가 없을 때 서버·첫 클라 렌더와, 브라우저 조회가 끝나기 전의 Suspense fallback. */
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
                    <div className="h-4 w-40 animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none" />
                    <div className="h-48 w-full animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none" />
                    <div className="h-16 w-full animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none" />
                </section>
                <section className="flex flex-col gap-3">
                    <div className="h-20 w-full animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none" />
                    <div className="h-20 w-full animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none" />
                </section>
            </div>
            <section className="flex flex-col gap-2">
                <div className="h-4 w-32 animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none" />
                <div className="h-40 w-full animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none" />
            </section>
        </div>
    );
}

export function FearGreedPage({
    hasSeed = true,
    ...bodyProps
}: FearGreedPageProps) {
    const isHydrated = useHydrated();
    if (hasSeed) return <FearGreedPageBody {...bodyProps} />;
    // seed 없음 — 서버 렌더에서 Server Function이 불리지 않게 하이드레이션 전에는 쿼리를
    // 마운트하지 않는다(`hasSeed` JSDoc). 브라우저에서는 조회가 suspend하므로 경계를 둔다.
    if (!isHydrated) return <FearGreedPageSkeleton />;
    return (
        <Suspense fallback={<FearGreedPageSkeleton />}>
            <FearGreedPageBody {...bodyProps} />
        </Suspense>
    );
}

function FearGreedPageBody({
    symbol,
    fmpSymbol,
    hideSelfNormWarning = false,
    hideSampleFooter = false,
}: Omit<FearGreedPageProps, 'hasSeed'>) {
    const t = useTranslations('widgets.fear-greed');
    const themeVersion = useThemeVersion();
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

    // 게이지·칩·그룹은 서버 seed로 **SSR한다**(하이드레이션 게이트 없음).
    //
    // 예전엔 하이드레이션 동안 점수 없는 스켈레톤을 그렸다: seed는 quantize된 봉(형성 중 봉
    // 제외)으로 계산되고 클라는 마운트 직후 quantize 없는 봉으로 재조회했으므로, 장중(크립토는
    // 항상) SSR 점수와 첫 클라 점수가 갈려 React #418이 났다. 지금은 재조회가 사람 입력
    // 이후로 미뤄져 있다(`refetchEnabled: humanInteracted` → 그 전엔 `staleTime: Infinity`).
    // 하이드레이션 렌더는 SSR과 **같은 seed**를 읽으므로 텍스트가 갈리지 않고, 입력 뒤의
    // 재조회 결과는 평범한 React 업데이트다. 추이 차트만 `ssr: false`로 브라우저에서 그린다.
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
