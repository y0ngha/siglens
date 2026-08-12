import { render, screen } from '@testing-library/react';
import { OptionsPageClient } from '@/widgets/options/OptionsPageClient';
import type { OptionsSnapshot, SlotMapping } from '@y0ngha/siglens-core';

vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));

vi.mock('@/features/symbol-model', () => ({
    useSymbolModel: () => ({ modelId: 'gemini-2.5-flash-lite' }),
    useAnalysisSettingsHydrated: () => true,
}));

vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => <div data-testid="cross-links" />,
}));

vi.mock('@/widgets/options/ExpirationSelector', () => ({
    ExpirationSelector: () => <div data-testid="exp-selector" />,
}));

// 실제 위젯과 동일하게 `hideView`에서 UI를 내지 않되 **마운트는 유지**한다.
// 마운트 유지가 계약의 핵심 — 트리에서 빠지면 usePublishSymbolChat이 돌지 않아
// 챗봇 분석 컨텍스트가 비고 입력이 잠긴다.
vi.mock('@/widgets/options/OptionsAiAnalysis', () => ({
    OptionsAiAnalysis: ({ hideView = false }: { hideView?: boolean }) =>
        hideView ? (
            <div data-testid="ai-analysis-headless" />
        ) : (
            <div data-testid="ai-analysis" />
        ),
}));

vi.mock('@/widgets/options/OptionsAiAnalysisError', () => ({
    OptionsAiAnalysisError: () => <div>Error</div>,
}));

vi.mock('@/widgets/options/OptionsAiAnalysisStaleNotice', () => ({
    OptionsAiAnalysisStaleNotice: () => <div data-testid="stale-notice" />,
}));

vi.mock('@/widgets/options/OptionsChainTable', () => ({
    OptionsChainTable: () => <div data-testid="chain-table" />,
}));

vi.mock('@/widgets/options/OpenInterestChart', () => ({
    OpenInterestChart: () => <div data-testid="oi-chart" />,
}));

vi.mock('@/widgets/options/StrikeVolumeChart', () => ({
    StrikeVolumeChart: () => <div data-testid="volume-chart" />,
}));

vi.mock('@/widgets/options/OptionsMetricsRow', () => ({
    OptionsMetricsRow: () => <div data-testid="metrics-row" />,
}));

vi.mock('@/widgets/options/OptionsStaleDataBanner', () => ({
    OptionsStaleDataBanner: () => <div data-testid="stale-banner" />,
}));

vi.mock('@/widgets/options/hooks/useOptionsChainMetrics', () => ({
    useOptionsChainMetrics: () => ({ chain: null, metrics: null }),
}));

// oiStale = !isEtRegularSessionOpen(now) && isOpenInterestSnapshotStale(snapshot).
// 두 입력을 테스트마다 뒤집을 수 있어야 정규장 밖 경로를 검증할 수 있다.
const { mockSessionOpen, mockOiSnapshotStale } = vi.hoisted(() => ({
    mockSessionOpen: vi.fn(() => true),
    mockOiSnapshotStale: vi.fn(() => false),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    isEtRegularSessionOpen: () => mockSessionOpen(),
}));

vi.mock('@/shared/lib/options/openInterestStale', () => ({
    isOpenInterestSnapshotStale: () => mockOiSnapshotStale(),
}));

/** 정규장 밖 + OI 스냅샷 stale → `oiStale === true`. */
function setOiStale(): void {
    mockSessionOpen.mockReturnValue(false);
    mockOiSnapshotStale.mockReturnValue(true);
}

const SNAPSHOT: OptionsSnapshot = {
    symbol: 'AAPL',
    underlyingPrice: 150,
    capturedAt: '2025-01-15T10:00:00Z',
    chains: [
        {
            expirationDate: '2025-06-20',
            daysToExpiration: 30,
            calls: [],
            puts: [],
        },
    ],
};

const SLOTS: Array<SlotMapping | null> = [
    {
        slot: { key: '1W', label: '근월', targetDays: 7 },
        expirationDate: '2025-06-20',
    },
    null,
];

describe('OptionsPageClient', () => {
    beforeEach(() => {
        mockSessionOpen.mockReturnValue(true);
        mockOiSnapshotStale.mockReturnValue(false);
    });

    it('renders ExpirationSelector', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('exp-selector')).toBeInTheDocument();
    });

    it('renders AI analysis section', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('ai-analysis')).toBeInTheDocument();
    });

    // audit fix FIX 2: hasSnapshotProse=true means the SSR-persistent
    // OptionsSnapshotProse (rendered by page.tsx above this component) is
    // already showing the same AI conclusion (summary/perExpiration/signals)
    // — mounting the widget too would duplicate that text for sighted users
    // and screen readers.
    it('keeps the AI analysis widget mounted but view-less when hasSnapshotProse is true (chat context must keep publishing)', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
                hasSnapshotProse
            />
        );
        expect(screen.queryByTestId('ai-analysis')).not.toBeInTheDocument();
        expect(screen.getByTestId('ai-analysis-headless')).toBeInTheDocument();
        expect(screen.queryByTestId('stale-notice')).not.toBeInTheDocument();
    });

    /**
     * 정규장 밖에는 활발히 거래되는 종목 대부분이 `oiStale`이 된다. 예전에는 이
     * 조합에서 위젯을 통째로 언마운트해, 스냅샷 프로즈로 완료된 분석이 보이는데도
     * 챗이 "분석이 완료된 후 질문할 수 있어요"로 잠겼다.
     */
    it('keeps the widget mounted (cacheOnly, view-less) when oiStale and a snapshot exists', () => {
        setOiStale();

        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
                hasSnapshotProse
            />
        );

        expect(screen.getByTestId('ai-analysis-headless')).toBeInTheDocument();
        // 프로즈가 이미 결론을 보여주므로 stale 안내 카드는 중복이라 띄우지 않는다.
        expect(screen.queryByTestId('stale-notice')).not.toBeInTheDocument();
    });

    it('shows the stale notice and no widget when oiStale and there is no snapshot', () => {
        setOiStale();

        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );

        expect(screen.getByTestId('stale-notice')).toBeInTheDocument();
        expect(screen.queryByTestId('ai-analysis')).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('ai-analysis-headless')
        ).not.toBeInTheDocument();
    });

    it('renders metrics row', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('metrics-row')).toBeInTheDocument();
    });

    it('renders charts', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('oi-chart')).toBeInTheDocument();
        expect(screen.getByTestId('volume-chart')).toBeInTheDocument();
    });

    it('renders chain table and cross links', () => {
        render(
            <OptionsPageClient
                symbol="AAPL"
                companyName="Apple"
                snapshot={SNAPSHOT}
                slots={SLOTS}
            />
        );
        expect(screen.getByTestId('chain-table')).toBeInTheDocument();
        expect(screen.getByTestId('cross-links')).toBeInTheDocument();
    });
});
