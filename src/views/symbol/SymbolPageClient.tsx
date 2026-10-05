'use client';

import { useTranslations } from 'next-intl';
import { ChartErrorFallback } from '@/widgets/chart/ChartErrorFallback';
import { ChartSkeleton } from '@/widgets/chart/ChartSkeleton';
import { TimeframeSelector } from '@/widgets/chart/TimeframeSelector';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/shared/config/viewport';
import { ChartContent } from './ChartContent';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { useMobileSheet } from './hooks/useMobileSheet';
import { SNAP_FULL } from './constants/mobileSheet';
import { useTimeframeChange } from './hooks/useTimeframeChange';
import { SymbolPageProvider } from './SymbolPageContext';
import { useSymbolModel } from '@/features/symbol-model/model/SymbolModelContext';
import type { MobileAnalysisSheet as MobileAnalysisSheetComponent } from './MobileAnalysisSheet';
import type { AnalysisResponse, TierInfoDepth } from '@y0ngha/siglens-core';
import { marketProfileOf } from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Spinner } from '@/shared/ui/Spinner';
import { ErrorBoundary } from 'react-error-boundary';

/**
 * `dynamic()`이 기대하는 default-export 모듈 형태. `MobileAnalysisSheet`는 named
 * export라 로더가 default로 감싸 넘겨야 한다.
 */
type MobileAnalysisSheetModule = {
    default: typeof MobileAnalysisSheetComponent;
};

/**
 * 시트 청크 로더. `dynamic()`과 아래 워밍이 **같은** 함수를 공유해야 webpack이
 * 동일 청크로 취급하고, 워밍으로 받아둔 모듈을 `dynamic()`이 재사용한다.
 */
const importMobileAnalysisSheet = (): Promise<MobileAnalysisSheetModule> =>
    import('./MobileAnalysisSheet').then(m => ({
        default: m.MobileAnalysisSheet,
    }));

// vaul의 aria-hidden 주입이 hydration과 겹쳐 mismatch 발생 — ssr: false로 hydration 완료 후 마운트.
const MobileAnalysisSheet = dynamic(importMobileAnalysisSheet, { ssr: false });

/**
 * 시트 청크 **선인출**. 렌더 게이트(`isHydrated && isMobileViewport`)와 무관하게,
 * 이 모듈이 평가되는 즉시 청크를 받아둔다.
 *
 * 이게 없으면 청크 요청이 하이드레이션 완료 이후로 밀린다 — `ssr: false`라 초기
 * 번들에 없고, 조건부 렌더라 Next가 미리 당기지도 못하기 때문이다. iPhone 390×844 /
 * CPU 4배 실측에서 요청 시작이 **4,593ms**였고 다운로드는 190ms뿐이었다. 즉 병목은
 * 네트워크가 아니라 **요청이 시작되기까지의 대기**다.
 *
 * `useHydrated`가 `startTransition`으로 플래그를 올리는 점도 겹친다 — 저우선순위
 * 업데이트라 차트 렌더가 무거우면 React가 시트 마운트를 더 미룬다. 워밍은 그
 * 스케줄링과 독립적으로 네트워크를 먼저 진행시킨다.
 *
 * 모바일 폭에서만 받는다 — 데스크톱은 `md:hidden`으로 시트를 쓰지 않으므로 그냥
 * 낭비다. 실패는 삼킨다: 어차피 `dynamic()`이 렌더 시점에 다시 시도하고, 그때의
 * 실패는 Next의 기존 경로가 처리한다.
 *
 * `matchMedia` 존재 여부까지 확인하는 이유: 이 코드는 컴포넌트 밖 **모듈 최상위**라
 * 여기서 throw하면 모듈 평가 자체가 실패해 페이지 전체가 죽는다. jsdom처럼
 * `matchMedia`가 없는 환경이 실재한다(이 가드 없이 기존 테스트 61건이 모듈 로드
 * 단계에서 깨졌다). 워밍은 순수 최적화이므로 판정이 불가능하면 조용히 건너뛰고
 * 렌더 시점 `dynamic()`에 맡긴다.
 */
if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches
) {
    void importMobileAnalysisSheet().catch(() => {});
}

interface SymbolPageClientProps {
    symbol: string;
    companyName: string;
    /** 한국어명 + 영문사명을 합친 표시 문자열 (예: "애플, Apple Inc. (AAPL)"). */
    displayName: string;
    initialAnalysis: AnalysisResponse;
    initialLockedInfoDepth?: readonly TierInfoDepth[];
    initialAnalysisFailed: boolean;
    indicatorCount: number;
    skillCount: number;
    /**
     * Market profile resolved server-side from AssetInfo — passed down to avoid
     * recomputing marketProfileOf(assetInfo) on the client for ChartContent.
     * Defaults to 'us-equity' when omitted (backward compat).
     */
    marketProfile?: MarketProfileId;
    /**
     * 서버 seed가 형성 중 봉을 뺀 채로 만들어졌는가(`hasFormingBar` — 생성 시점). `ChartContent`가
     * 입력 전에도 seed 복원 재조회를 열지 정하는 입력이다. 생략하면 `true`(옛 동작: 항상 연다).
     */
    seedHasFormingBarTrimmed?: boolean;
}

export function SymbolPageClient({
    symbol,
    companyName,
    displayName,
    initialAnalysis,
    initialLockedInfoDepth = [],
    initialAnalysisFailed,
    indicatorCount,
    skillCount,
    marketProfile,
    seedHasFormingBarTrimmed,
}: SymbolPageClientProps) {
    const t = useTranslations('views.symbol');
    const { tier, isTierHydrated } = useSymbolModel();
    const {
        sheetSnap,
        setSheetSnap,
        mobileSheetContent,
        setMobileSheetContent,
    } = useMobileSheet();
    // isFreeTier는 useTimeframeChange의 인자로 필요해 훅 선언 순서 예외
    // (MISTAKES.md #17)로 그 호출 직전에 둔다. 그 외 훅은 모두 이 파생 변수보다
    // 앞선다.
    const isFreeTier = isTierHydrated && tier === 'free';
    const {
        timeframe,
        displayTimeframe,
        isTimeframeSwitching,
        timeframeChangeCount,
        handleTimeframeChange,
    } = useTimeframeChange(symbol, isFreeTier, isTierHydrated);
    const assetInfo = useAssetInfo(symbol);
    const isHydrated = useHydrated();
    const isMobileViewport = useIsMobileViewport();

    return (
        <SymbolPageProvider
            indicatorCount={indicatorCount}
            skillCount={skillCount}
        >
            {/* 모바일: page의 wrapper가 확정한 첫 뷰포트 높이를 flex-1로 받아
                타임프레임 바와 차트 행이 나눈다.
                데스크톱(md+): 높이를 놓는다(`md:flex-none`). 차트 컬럼과 AI 패널이
                각자 `--symbol-chart-h`로 높이를 확정하고 패널은 내부 스크롤하므로
                여기서 확정할 필요가 없다(배경은 ChartContent의 aside 주석). footer는
                jail 형제로 push되어 스크롤 내려야 보인다. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-secondary-900 text-secondary-200 md:flex-none md:overflow-visible">
                {/* Chart-only timeframe controls live inside this chart container
                    so the layout header can stay free of useSearchParams
                    (which would force PPR to mark the whole route as dynamic). */}
                {/* 이 바는 아래의 차트/AI 레일 2-pane에 정렬한다 — 자기가 제어하는
                    대상이 그쪽이기 때문이다. 한때 `symbol-container`(1024px 중앙)를
                    걸었더니 vw=1600에서 캔버스가 0~894인데 타임프레임 버튼이
                    961~1246으로 레일 위에 떠 실측으로 잡혔다. `px-4`면 h1은 캔버스
                    좌단(0)에서 16px, 셀렉터 우단은 레일 우단(vw−16)과 같은 선에 놓인다.

                    위의 브레드크럼·탭도 같은 전폭 `px-4`를 쓴다. **두 값은 함께
                    움직여야 한다** — 한쪽만 바꾸면 상단 크롬과 이 바가 다시 어긋난다
                    (`SymbolLayoutHeader` JSDoc). */}
                <div className="border-b border-secondary-700 px-4 py-2 sm:py-1.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        {/* 차트 페이지 가시 h1: 차트+AI가 첫 뷰포트를 채우는 구성이라
                        본문에 별도 블록을 얹으면 chart 가시 영역이 침범된다. 그래서
                        timeframe bar 행에 짧은 한 줄로 둔다(truncate로 좁은 화면에서
                        TimeframeSelector와 한 줄 공존). 단 이 컴포넌트는 useSearchParams로
                        CSR-bailout되므로 이 가시 h1은 SSR HTML엔 박히지 않는다 — JS 미실행
                        크롤러용 h1은 page.tsx의 Suspense fallback에 동일 텍스트 sr-only h1으로
                        제공하고, hydration 후 이 가시 h1이 fallback을 대체한다. */}
                        <div className="flex min-w-0 items-center gap-2">
                            <h1 className="line-clamp-2 min-w-0 text-sm font-semibold text-secondary-50 sm:line-clamp-none sm:truncate sm:text-base">
                                {t('chartPageHeading.heading', {
                                    v0: displayName,
                                })}
                            </h1>
                            {/*
                             * 분석 시트를 여는 명시적 버튼(모바일 전용).
                             *
                             * 이게 없으면 시트를 여는 유일한 방법이 PEEK 띠를 잡고 드래그하는
                             * 것뿐이다. 그런데 띠 높이는 `snap − PEEK_VISIBLE_OFFSET`이고, 시트는 `97svh`
                             * 고정인 반면 vaul은 오프셋을 `window.innerHeight`로 잡는다 —
                             * 모바일 툴바가 접혀 innerHeight가 svh보다 커지면 띠가 얇아지고,
                             * 극단적으로는 0에 수렴해 **잡을 것이 사라진다**. 그 상태에서는
                             * 제품의 핵심인 AI 분석 패널에 재로드 전까지 접근할 수 없다.
                             * 이 버튼은 시트 밖(항상 보이는 타임프레임 바)에 있으므로 띠
                             * 높이와 무관하게 살아 있다.
                             *
                             * 세로 공간을 새로 쓰지 않도록 h1과 같은 행의 남는 폭에 둔다 —
                             * 이 버튼은 모바일 전용이고, 모바일에서는 첫 뷰포트 높이를
                             * 차트 행과 나눠 쓰므로 한 줄이 늘면 차트가 그만큼 줄어든다.
                             */}
                            <button
                                type="button"
                                onClick={() => setSheetSnap(SNAP_FULL)}
                                className="shrink-0 touch-manipulation rounded-lg border border-border-control px-2.5 py-1 text-xs font-medium whitespace-nowrap text-secondary-300 transition-colors hover:border-primary-500 hover:bg-secondary-700/30 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none md:hidden"
                            >
                                {t('SymbolPageClient.ddb88e')}
                            </button>
                        </div>
                        <TimeframeSelector
                            value={displayTimeframe}
                            onChange={handleTimeframeChange}
                            isFreeTier={isFreeTier}
                            isTierHydrated={isTierHydrated}
                        />
                    </div>
                </div>
                {/* md+: 높이를 놓는다(`md:flex-none`) — 높이는 ChartContent의 차트
                    컬럼과 AI 패널이 `--symbol-chart-h`로 직접 들고 있다. 대신
                    `md:min-h-(--symbol-chart-h)`를 남긴다 — Suspense
                    중에는 자식이 `absolute inset-0` 스켈레톤뿐이라 이 행이 0으로
                    접히고, 그러면 차트가 도착할 때 통째로 CLS가 난다. */}
                <div
                    aria-busy={isTimeframeSwitching || undefined}
                    className="relative flex min-h-0 flex-1 overflow-hidden md:min-h-(--symbol-chart-h) md:flex-none md:overflow-visible"
                >
                    {/* 타임프레임 전환 중엔 새 봉이 올 때까지 이전 차트를 그대로 두고
                        (transition) 그 위를 덮어 "바뀌는 중"임을 즉시 보여준다. */}
                    {isTimeframeSwitching && (
                        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-secondary-900/40">
                            <Spinner size="xl" />
                        </div>
                    )}
                    <ErrorBoundary
                        FallbackComponent={ChartErrorFallback}
                        resetKeys={[timeframe, symbol]}
                    >
                        <Suspense fallback={<ChartSkeleton />}>
                            <ChartContent
                                symbol={symbol}
                                companyName={companyName}
                                timeframe={timeframe}
                                timeframeChangeCount={timeframeChangeCount}
                                initialAnalysis={initialAnalysis}
                                initialLockedInfoDepth={initialLockedInfoDepth}
                                initialAnalysisFailed={initialAnalysisFailed}
                                onMobileSheetContent={setMobileSheetContent}
                                seedHasFormingBarTrimmed={
                                    seedHasFormingBarTrimmed
                                }
                                fmpSymbol={assetInfo?.fmpSymbol}
                                marketProfile={
                                    marketProfile ??
                                    (assetInfo
                                        ? marketProfileOf(assetInfo)
                                        : undefined)
                                }
                            />
                        </Suspense>
                    </ErrorBoundary>
                </div>
                {/* Suspense 경계 밖에서 렌더링하여 타임프레임 전환 시 바텀시트가 사라지지 않도록 한다 */}
                {isHydrated && isMobileViewport && (
                    <MobileAnalysisSheet
                        activeSnap={sheetSnap}
                        onActiveSnapChange={setSheetSnap}
                    >
                        {mobileSheetContent}
                    </MobileAnalysisSheet>
                )}
            </div>
        </SymbolPageProvider>
    );
}
