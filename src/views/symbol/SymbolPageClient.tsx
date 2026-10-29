'use client';

import { ChartErrorFallback } from '@/widgets/chart/ChartErrorFallback';
import { ChartSkeleton } from '@/widgets/chart/ChartSkeleton';
import { ExtendedHoursQuoteLine } from '@/widgets/extended-hours/ui/ExtendedHoursQuoteLine';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/shared/config/viewport';
import { ChartContent } from './ChartContent';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { symbolFactsSubject } from './utils/factsSubject';
import { useMobileSheet } from './hooks/useMobileSheet';
import { SNAP_FULL } from './constants/mobileSheet';
import { useTimeframeChange } from './hooks/useTimeframeChange';
import { SymbolPageProvider } from './SymbolPageContext';
import { useSymbolModel } from '@/features/symbol-model/model/SymbolModelContext';
import type { MobileAnalysisSheet as MobileAnalysisSheetComponent } from './MobileAnalysisSheet';
import type {
    AnalysisResponse,
    KrxTickTable,
    TierInfoDepth,
} from '@y0ngha/siglens-core';
import { marketProfileOf } from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import dynamic from 'next/dynamic';
import { Suspense, type ReactNode } from 'react';
import { Spinner } from '@/shared/ui/Spinner';
import { ErrorBoundary } from 'react-error-boundary';
import { ChartTimeframeBar } from './ui/chart/ChartTimeframeBar';

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
 * `matchMedia`가 없는 환경이 실재한다. 워밍은 순수 최적화이므로 판정이 불가능하면
 * 조용히 건너뛰고 렌더 시점 `dynamic()`에 맡긴다.
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
    /** 분석 요청에 싣는 회사명. */
    companyName: string;
    /** 한국어명 + 영문사명을 합친 표시 문자열 (예: "애플, Apple Inc. (AAPL)"). */
    displayName: string;
    /** 서버가 seed한 초기 분석(캐시 peek). */
    initialAnalysis: AnalysisResponse;
    /** 초기 분석에서 잠긴 정보 깊이(비회원). */
    initialLockedInfoDepth?: readonly TierInfoDepth[];
    /** 서버 초기 분석이 실패했는가 — 참이면 마운트 뒤 자동 재시도한다. */
    initialAnalysisFailed: boolean;
    /** 가입 유도 카드의 지표 수. */
    indicatorCount: number;
    /** 가입 유도 카드의 스킬 수. */
    skillCount: number;
    /**
     * Market profile resolved server-side from AssetInfo — passed down to avoid
     * recomputing marketProfileOf(assetInfo) on the client for ChartContent.
     * Defaults to 'us-equity' when omitted (backward compat).
     */
    marketProfile?: MarketProfileId;
    /** 종목의 KRX 호가표(주식/ETF) — 서버에서 해석해 `ChartContent`→`AnalysisPanel`로 내려간다. 생략하면 'share'. */
    krxTickTable?: KrxTickTable;
    /**
     * 서버가 seed를 만든 시점에 정규장이 열려 있었는가(`hasFormingBar` — 세션 기준이며 quantize가
     * 실제로 봉을 뗐는지가 아니다). 장중 생성 seed는 그날 봉이 빠졌을 수 있어 `ChartContent`가
     * 입력 전에도 seed 복원 재조회를 열지 정하는 입력이다. 생략하면 `true`(옛 동작: 항상 연다).
     */
    seedHasFormingBarTrimmed?: boolean;
    /**
     * 서버가 기본 타임프레임 봉을 React Query에 seed했는가. 생략하면 `true`.
     *
     * 이 컴포넌트는 이제 서버에서도 렌더된다(`useUrlSearchParam` — CSR bailout 없음).
     * seed가 없는 채로 `ChartContent`를 SSR하면 그 안의 `useSuspenseQuery`가 **서버
     * 렌더 중에** 봉 Server Action을 부르게 된다. 그래서 seed가 없으면 하이드레이션이
     * 끝날 때까지 `ChartSkeleton`만 그리고, 차트는 브라우저에서 처음 마운트한다.
     */
    hasBarsSeed?: boolean;
    /**
     * 타임프레임 바(h1 행)에 붙는 서버 렌더 배지 — 지금은 증자·희석 배지(`DilutionRiskBadge`)뿐이다. 페이지(RSC)가
     * 데이터·대상 판정까지 끝내고 엘리먼트로 넘기므로 첫 HTML에 이미 있다(하이드레이션 뒤 나타나 밀리는 일이 없다).
     * 없으면 자리도 잡지 않는다.
     */
    headingBadge?: ReactNode;
}

/** 차트 탭 클라이언트 셸. 서버에서도 렌더된다(`useUrlSearchParam` — CSR bailout 없음). */
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
    krxTickTable,
    seedHasFormingBarTrimmed,
    hasBarsSeed = true,
    headingBadge,
}: SymbolPageClientProps) {
    const { tier, isTierHydrated } = useSymbolModel();
    const {
        sheetSnap,
        setSheetSnap,
        mobileSheetContent,
        setMobileSheetContent,
    } = useMobileSheet();
    // isFreeTier는 useTimeframeChange의 인자로 필요해 훅 선언 순서 예외
    // (REACT.md#HK-1)로 그 호출 직전에 둔다. 그 외 훅은 모두 이 파생 변수보다
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
    const locale = useResolvedLocale();
    const isHydrated = useHydrated();
    const isMobileViewport = useIsMobileViewport();
    // seed가 없으면 서버·하이드레이션 렌더에서 차트를 그리지 않는다(`hasBarsSeed` JSDoc).
    const canRenderChart = hasBarsSeed || isHydrated;
    // 서버가 넘긴 프로필이 우선이고, 없으면 자산 정보로 해석한다(미도착이면 undefined).
    // 프리·애프터마켓 한 줄은 미국 주식에만 붙는다 — 프로필을 확정할 수 없으면 붙이지
    // 않는다(서버 액션도 같은 판정을 다시 하지만 호출 자체를 아낀다).
    const resolvedProfile =
        marketProfile ?? (assetInfo ? marketProfileOf(assetInfo) : undefined);

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
                    so the layout header stays free of URL reads. */}
                <ChartTimeframeBar
                    displayName={displayName}
                    headingBadge={headingBadge}
                    timeframe={displayTimeframe}
                    onTimeframeChange={handleTimeframeChange}
                    isFreeTier={isFreeTier}
                    isTierHydrated={isTierHydrated}
                    onOpenAnalysisSheet={() => setSheetSnap(SNAP_FULL)}
                />
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
                            {canRenderChart ? (
                                <ChartContent
                                    symbol={symbol}
                                    companyName={companyName}
                                    factsSubject={symbolFactsSubject(
                                        symbol,
                                        assetInfo?.koreanName,
                                        locale
                                    )}
                                    timeframe={timeframe}
                                    timeframeChangeCount={timeframeChangeCount}
                                    initialAnalysis={initialAnalysis}
                                    initialLockedInfoDepth={
                                        initialLockedInfoDepth
                                    }
                                    initialAnalysisFailed={
                                        initialAnalysisFailed
                                    }
                                    onMobileSheetContent={setMobileSheetContent}
                                    seedHasFormingBarTrimmed={
                                        seedHasFormingBarTrimmed
                                    }
                                    fmpSymbol={assetInfo?.fmpSymbol}
                                    // 프리·애프터마켓 시세(표시 전용)는 `StockChart` 헤더 띠 안의
                                    // flex 칸(왼쪽, 메뉴 셋 앞)으로 렌더한다 — 제목 `h1` 행에 형제로
                                    // 두면 캡션이 나타날 때 h1 폭이 줄어 줄바꿈이 바뀐다. 호출은 사용자 입력이 있은 뒤에만 나간다
                                    // (`useExtendedHoursQuote`), 크롤러 렌더는 FMP를 건드리지 않는다.
                                    chartHeaderStartSlot={
                                        resolvedProfile === 'us-equity' ? (
                                            <ExtendedHoursQuoteLine
                                                symbol={symbol}
                                            />
                                        ) : undefined
                                    }
                                    marketProfile={resolvedProfile}
                                    krxTickTable={krxTickTable}
                                />
                            ) : (
                                <ChartSkeleton />
                            )}
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
