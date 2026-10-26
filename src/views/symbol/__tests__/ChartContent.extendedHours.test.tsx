import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { AnalysisResponse, Bar, Timeframe } from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { ChartContent } from '../ChartContent';
import type { UseAnalysisResult } from '../hooks/useAnalysis';
import { useExtendedBars } from '@/entities/extended-bars/hooks/useExtendedBars';
import { useAnalysisDerivedData } from '../hooks/useAnalysisDerivedData';
import { STORAGE_KEYS } from '@/widgets/chart/constants';

/**
 * 시간외(프리·애프터마켓) 봉이 `ChartContent`에서 어떻게 배선되는지 — 지표·분석은 정규장 봉만,
 * 차트는 정규장 + 시간외 봉. `next/dynamic` 목은 로더 소스로 StockChart/VolumeChart를 구분해
 * 마지막으로 받은 props를 기록한다.
 */
const { chartProps } = vi.hoisted(() => ({
    chartProps: {} as Record<string, Record<string, unknown> | undefined>,
}));

vi.mock('next/dynamic', () => ({
    default: (loader: () => Promise<unknown>) => {
        const name = loader.toString().includes('VolumeChart')
            ? 'VolumeChart'
            : 'StockChart';
        const Stub = (props: Record<string, unknown>) => {
            chartProps[name] = props;
            return null;
        };
        return Stub;
    },
}));
vi.mock('@/widgets/chart/ChartSkeleton', () => ({
    ChartSkeleton: () => null,
}));
const { syncApi } = vi.hoisted(() => ({
    syncApi: {
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
        setRightOffsetPixels: vi.fn(),
        isUserAdjustedView: vi.fn(() => false),
        resetUserAdjustedView: vi.fn(),
        runVolumeDataUpdate: vi.fn(),
    },
}));
vi.mock('@/widgets/chart/hooks/useChartSync', () => ({
    useChartSync: () => syncApi,
}));
vi.mock('@/entities/extended-bars/hooks/useExtendedBars', () => ({
    useExtendedBars: vi.fn(() => null),
}));

// 정규장 봉: 2026-10-14 09:30·09:35 ET(EDT). 시간외 봉: 프리 08:55 ET, 같은 시각 중복(09:30), 애프터 16:00 ET.
const REGULAR: Bar[] = [
    {
        time: Date.parse('2026-10-14T13:30:00Z') / 1000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 5,
    },
    {
        time: Date.parse('2026-10-14T13:35:00Z') / 1000,
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 6,
    },
];
const PRE: Bar = {
    time: Date.parse('2026-10-14T12:55:00Z') / 1000,
    open: 98,
    high: 99,
    low: 97,
    close: 98,
    volume: 1,
};
const DUPLICATE: Bar = { ...REGULAR[0]!, close: 555 };
const AFTER: Bar = {
    time: Date.parse('2026-10-14T20:00:00Z') / 1000,
    open: 102,
    high: 103,
    low: 101,
    close: 102,
    volume: 2,
};

const INDICATORS = { rsi: [null, 55], macd: [], buySellVolume: [] };
vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: () => ({ bars: REGULAR, indicators: INDICATORS }),
}));
vi.mock('../hooks/useAnalysis', () => ({
    useAnalysis: () => analysisReturn(),
}));
vi.mock('../hooks/usePanelResize', () => ({
    usePanelResize: () => ({
        panelWidth: 360,
        isDragging: false,
        handleDragStart: vi.fn(),
        handleKeyDown: vi.fn(),
    }),
    PANEL_MIN_WIDTH: 280,
    PANEL_MAX_WIDTH: 600,
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: () => ({
        modelId: 'gemini-3.6-flash',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        openSignupNudgeAs: vi.fn(),
    }),
}));
vi.mock('@/features/analysis-nudge/hooks/useAnonAnalysisNudge', () => ({
    useAnonAnalysisNudge: () => ({
        isLoginResolved: false,
        onSymbolAnalyzed: vi.fn(),
    }),
}));
vi.mock('../SymbolPageContext', () => ({
    useSymbolPageContext: () => ({ indicatorCount: 25 }),
}));
vi.mock('../hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: vi.fn(() => ({
        clusteredKeyLevels: { support: [], resistance: [] },
        validatedActionPrices: undefined,
        reconciledActionLines: undefined,
    })),
}));
vi.mock('../hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: () => ({
        displayAnalyzing: false,
        handleProgressFinished: vi.fn(),
    }),
}));
vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: () => ({ phaseIndex: 0, tipIndex: 0 }),
}));
vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: () => null,
}));
vi.mock('@/features/portfolio-holding/hooks/useSymbolHolding', () => ({
    useSymbolHolding: () => ({
        holding: null,
        isHydrated: true,
        isLoading: false,
        isError: false,
        save: {} as never,
    }),
}));

function analysisReturn(): UseAnalysisResult {
    return {
        analysis: {} as AnalysisResponse,
        analysisResult: null,
        lockedInfoDepth: [],
        isAnalyzing: false,
        analysisError: null,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
        isPersonalized: false,
        meter: null,
        isAwaitingInteraction: false,
        isInstantResponse: false,
        syncReanalyzeCooldown: vi.fn(),
        plain: null,
    };
}

const mockedExtended = vi.mocked(useExtendedBars);

function renderChart(
    timeframe: Timeframe,
    marketProfile: MarketProfileId = 'us-equity'
) {
    return render(
        <ChartContent
            symbol="AAPL"
            companyName="Apple"
            timeframe={timeframe}
            timeframeChangeCount={0}
            initialAnalysis={{} as AnalysisResponse}
            initialAnalysisFailed={false}
            onMobileSheetContent={vi.fn()}
            marketProfile={marketProfile}
        />
    );
}

function stockProps() {
    return chartProps.StockChart as {
        bars: Bar[];
        displayBars: Bar[];
        extendedBars: Bar[];
        extendedHours?: { checked: boolean; onChange: (v: boolean) => void };
    };
}

describe('ChartContent — 시간외 봉 배선', () => {
    beforeEach(() => {
        window.localStorage.clear();
        chartProps.StockChart = undefined;
        chartProps.VolumeChart = undefined;
        mockedExtended.mockReset();
        mockedExtended.mockReturnValue([DUPLICATE, AFTER, PRE]);
    });
    afterEach(() => {
        window.localStorage.clear();
    });

    it('미국 주식 5분봉: 정규장 봉은 그대로 `bars`, 시간외 봉은 시각순으로 `displayBars`에 얹힌다(정규장 우선)', () => {
        renderChart('5Min');

        const stock = stockProps();
        expect(stock.bars).toBe(REGULAR);
        expect(stock.displayBars.map(b => b.time)).toEqual([
            PRE.time,
            REGULAR[0]!.time,
            REGULAR[1]!.time,
            AFTER.time,
        ]);
        // 같은 시각 중복은 정규장 값이 이긴다
        expect(stock.displayBars[1]).toBe(REGULAR[0]);
        expect(stock.extendedBars).toEqual([PRE, AFTER]);
    });

    it('두 차트의 조정 기록·거래량 갱신 래퍼를 useChartSync에서 받아 각 차트에 한 번씩 내려준다', () => {
        renderChart('5Min');
        const stock = stockProps() as unknown as Record<string, unknown>;
        expect(stock.isViewAdjusted).toBe(syncApi.isUserAdjustedView);
        expect(stock.onViewAdjustmentReset).toBe(syncApi.resetUserAdjustedView);
        const volume = chartProps.VolumeChart as Record<string, unknown>;
        expect(volume.runDataUpdate).toBe(syncApi.runVolumeDataUpdate);
    });

    it('거래량 차트도 같은 시간외 봉·타임프레임을 받는다(정규장 `bars`는 매수/매도 분해용)', () => {
        renderChart('5Min');
        const volume = chartProps.VolumeChart as Record<string, unknown>;
        expect(volume.bars).toBe(REGULAR);
        expect(volume.extendedBars).toEqual([PRE, AFTER]);
        expect(volume.timeframe).toBe('5Min');
    });

    it('분석·작도는 정규장 봉만 본다(시간외 봉이 섞이지 않는다)', () => {
        renderChart('5Min');
        const calls = vi.mocked(useAnalysisDerivedData).mock.calls;
        expect(calls.at(-1)![1]).toBe(REGULAR);
    });

    it('토글은 기본 켜짐이고 조회 훅에 그대로 전달된다', () => {
        renderChart('5Min');
        expect(mockedExtended).toHaveBeenLastCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                timeframe: '5Min',
                marketProfile: 'us-equity',
                toggledOn: true,
            })
        );
        expect(stockProps().extendedHours?.checked).toBe(true);
        // 기본값은 저장하지 않는다(사용자 변경분만 기록)
        expect(
            window.localStorage.getItem(STORAGE_KEYS.extendedHours)
        ).toBeNull();
    });

    it('토글을 끄면 localStorage에 영속하고, 훅에 꺼짐을 알린다', () => {
        renderChart('5Min');
        act(() => stockProps().extendedHours!.onChange(false));

        expect(window.localStorage.getItem(STORAGE_KEYS.extendedHours)).toBe(
            'false'
        );
        expect(mockedExtended).toHaveBeenLastCalledWith(
            expect.objectContaining({ toggledOn: false })
        );
        expect(stockProps().extendedHours?.checked).toBe(false);
    });

    it('저장된 꺼짐 값은 다음 방문에도 유지된다', () => {
        window.localStorage.setItem(STORAGE_KEYS.extendedHours, 'false');
        renderChart('5Min');
        expect(stockProps().extendedHours?.checked).toBe(false);
        expect(mockedExtended).toHaveBeenLastCalledWith(
            expect.objectContaining({ toggledOn: false })
        );
    });

    it('토글이 꺼져 조회 훅이 null이면 차트는 정규장 봉만 그린다(참조 동일)', () => {
        mockedExtended.mockReturnValue(null);
        renderChart('5Min');
        expect(stockProps().displayBars).toBe(REGULAR);
        expect(stockProps().extendedBars).toEqual([]);
    });

    it.each(['5Min', '15Min', '30Min', '1Hour', '4Hour'] as const)(
        '미국 주식 %s는 토글 설정을 내려준다',
        timeframe => {
            renderChart(timeframe);
            expect(stockProps().extendedHours).toBeDefined();
        }
    );

    it('1Day는 토글도 시간외 봉도 없다(훅이 준 값이 있어도 병합하지 않는다)', () => {
        renderChart('1Day');
        expect(stockProps().extendedHours).toBeUndefined();
        expect(stockProps().displayBars).toBe(REGULAR);
        expect(stockProps().extendedBars).toEqual([]);
    });

    it.each(['crypto', 'kr-equity'] as const)(
        '%s 인트라데이는 토글이 없다(기존 차트 그대로)',
        marketProfile => {
            mockedExtended.mockReturnValue(null);
            renderChart('5Min', marketProfile);
            expect(stockProps().extendedHours).toBeUndefined();
            expect(stockProps().displayBars).toBe(REGULAR);
        }
    );

    describe('하단 시간외 안내 문구는 그려지는 상태와 맞는다', () => {
        const OLD = '차트는 Pre-market, After-market 주가를 반영하지 않습니다.';
        const NEW =
            '음영 구간은 프리마켓과 애프터마켓(시간외) 거래이며, 지표와 AI 분석은 정규장 봉만 사용합니다.';

        it('시간외 봉이 그려지면 새 문구만 보이고 "반영하지 않는다"는 말은 없다', () => {
            renderChart('5Min');
            expect(screen.getByText(NEW, { exact: false })).toBeInTheDocument();
            expect(screen.queryByText(OLD, { exact: false })).toBeNull();
        });

        it('토글이 꺼져 시간외 봉이 없으면 기존 문구다', () => {
            mockedExtended.mockReturnValue(null);
            renderChart('5Min');
            expect(screen.getByText(OLD, { exact: false })).toBeInTheDocument();
            expect(screen.queryByText(NEW, { exact: false })).toBeNull();
        });

        it('일봉은 시간외 봉이 없어 기존 문구다(훅이 값을 줘도 병합하지 않는다)', () => {
            renderChart('1Day');
            expect(screen.getByText(OLD, { exact: false })).toBeInTheDocument();
            expect(screen.queryByText(NEW, { exact: false })).toBeNull();
        });

        it('한국 주식은 시간외 봉이 없어 기존 문구다', () => {
            mockedExtended.mockReturnValue(null);
            renderChart('5Min', 'kr-equity');
            expect(screen.getByText(OLD, { exact: false })).toBeInTheDocument();
        });

        it('암호화폐는 장전·장후 세션이 없어 두 문구 모두 없다', () => {
            mockedExtended.mockReturnValue(null);
            renderChart('5Min', 'crypto');
            expect(screen.queryByText(OLD, { exact: false })).toBeNull();
            expect(screen.queryByText(NEW, { exact: false })).toBeNull();
        });
    });
});
