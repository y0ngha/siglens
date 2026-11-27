import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { aiAskUrl } from '@/shared/config/aiHost';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
import type { AssetInfo } from '@/shared/lib/types';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { SNAP_FULL, SNAP_PEEK } from '@/views/symbol/constants/mobileSheet';
import { useMobileSheet } from '@/views/symbol/hooks/useMobileSheet';
import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';

// Mock MobileAnalysisSheet so the dynamic() factory's import resolves cheaply.
vi.mock('@/views/symbol/MobileAnalysisSheet', () => ({
    MobileAnalysisSheet: () => <div data-testid="mobile-analysis-sheet" />,
}));

vi.mock('next/dynamic', () => ({
    /**
     * Invoke the loader factory synchronously so the dynamic-import loader
     * (`() => import('./MobileAnalysisSheet')`) and its `.then` mapper actually
     * execute (and are thus covered). The returned component is a simple stub
     * renderable in tests.
     */
    default: (loader: () => Promise<{ default: ComponentType }>) => {
        // Fire-and-forget: coverage only needs the factory to be called once.
        // .catch swallows any rejection so a failed import can't destabilize the run.
        void loader().catch(() => {});
        const Stub = () => <div data-testid="mobile-sheet" />;
        Stub.displayName = 'MobileSheetStub';
        return Stub;
    },
}));

vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({
        children,
    }: {
        children: React.ReactNode;
        [key: string]: unknown;
    }) => <div data-testid="error-boundary">{children}</div>,
}));

vi.mock('@/widgets/chart/ChartErrorFallback', () => ({
    ChartErrorFallback: () => <div data-testid="chart-error" />,
}));
vi.mock('@/widgets/chart/ChartSkeleton', () => ({
    ChartSkeleton: () => <div data-testid="chart-skeleton" />,
}));
vi.mock('@/widgets/chart/TimeframeSelector', () => ({
    TimeframeSelector: ({
        value,
        timeframes,
        onChange: _onChange,
    }: {
        value: string;
        timeframes?: readonly string[];
        onChange: (v: string) => void;
    }) => (
        <div
            data-testid="timeframe-selector"
            data-timeframes={timeframes?.join(',')}
        >
            {value}
        </div>
    ),
}));

vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

vi.mock('@/shared/hooks/useIsMobileViewport', () => ({
    useIsMobileViewport: vi.fn(() => false),
}));

vi.mock('@/views/symbol/ChartContent', () => ({
    ChartContent: (props: Record<string, unknown>) => (
        <div data-testid="chart-content">
            {props.symbol as string}
            <div data-testid="panel-top-slot">
                {props.panelTopSlot as React.ReactNode}
            </div>
        </div>
    ),
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => undefined),
}));

vi.mock('@/views/symbol/hooks/useMobileSheet', () => ({
    useMobileSheet: vi.fn(() => ({
        sheetSnap: 0.2,
        setSheetSnap: vi.fn(),
        mobileSheetContent: null,
        setMobileSheetContent: vi.fn(),
    })),
}));

vi.mock('@/views/symbol/hooks/useTimeframeChange', () => ({
    useTimeframeChange: vi.fn(() => ({
        timeframe: '1Day' as Timeframe,
        displayTimeframe: '1Day' as Timeframe,
        isTimeframeSwitching: false,
        timeframeChangeCount: 0,
        handleTimeframeChange: vi.fn(),
    })),
}));

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({ tier: 'free', isTierHydrated: true })),
}));

vi.mock('@/views/symbol/SymbolPageContext', () => ({
    SymbolPageProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="provider">{children}</div>
    ),
}));

describe('SymbolPageClient', () => {
    const defaultProps = {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        displayName: '애플, Apple Inc. (AAPL)',
        initialAnalysis: {} as AnalysisResponse,
        initialAnalysisFailed: false,
        indicatorCount: 20,
        skillCount: 30,
    };

    it('renders without crashing', () => {
        const { container } = render(<SymbolPageClient {...defaultProps} />);
        expect(container.firstElementChild).toBeDefined();
    });

    /*
     * 시트를 여는 유일한 방법이 PEEK 띠 드래그뿐이면, 툴바 접힘으로 띠가 얇아졌을 때
     * AI 분석 패널에 접근할 수 없게 된다(띠 = snap − PEEK_VISIBLE_OFFSET이고 vaul은 innerHeight,
     * 시트는 svh 기준이라 두 단위가 벌어지면 띠가 줄어든다). 그래서 시트 **밖**에
     * 항상 살아 있는 버튼을 둔다. 이 버튼이 사라지면 그 안전장치가 사라진다.
     */
    it('시트를 여는 버튼이 시트 밖에 있고, 누르면 전체 스냅으로 연다', async () => {
        const setSheetSnap = vi.fn();
        vi.mocked(useMobileSheet).mockReturnValue({
            sheetSnap: SNAP_PEEK,
            setSheetSnap,
            mobileSheetContent: null,
            setMobileSheetContent: vi.fn(),
        });
        // 시트가 실제로 렌더링되는 조건(모바일 + hydrated)이어야 "시트 밖"이라는
        // closest() 단언이 의미를 갖는다. 데스크탑 모킹(모듈 기본값 false)으로 두면
        // 시트 자체가 렌더링되지 않아 두 closest() 호출이 공허하게 null을 반환한다.
        vi.mocked(useIsMobileViewport).mockReturnValue(true);
        vi.mocked(useHydrated).mockReturnValue(true);

        render(<SymbolPageClient {...defaultProps} />);

        // 시트가 실제로 존재함을 먼저 확인 — 이게 없으면 아래 closest() 단언이
        // 다시 공허해질 수 있다(시트가 렌더링을 멈춰도 테스트는 그린으로 남는다).
        expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();

        const openButton = screen.getByRole('button', { name: 'AI 분석 보기' });
        // 시트 밖이어야 한다 — 시트 안에 있으면 띠가 사라질 때 같이 사라진다.
        expect(openButton.closest('[data-testid="mobile-sheet"]')).toBeNull();
        expect(
            openButton.closest('[data-testid="mobile-analysis-sheet"]')
        ).toBeNull();

        await userEvent.click(openButton);

        expect(setSheetSnap).toHaveBeenCalledWith(SNAP_FULL);
    });

    it('wraps content in SymbolPageProvider', () => {
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('provider')).toBeDefined();
    });

    it('renders the timeframe selector with current value', () => {
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('timeframe-selector').textContent).toBe(
            '1Day'
        );
    });

    describe('셀렉터에 넘기는 프레임은 종목의 시장 프로필 allowedTimeframes다', () => {
        const framesOf = (): string[] =>
            (
                screen
                    .getByTestId('timeframe-selector')
                    .getAttribute('data-timeframes') ?? ''
            ).split(',');

        it('us-equity(프로필 생략 포함): 7개, 4Hour와 1Week 포함', () => {
            render(<SymbolPageClient {...defaultProps} />);
            expect(framesOf()).toEqual([
                '5Min',
                '15Min',
                '30Min',
                '1Hour',
                '4Hour',
                '1Day',
                '1Week',
            ]);
        });

        it('kr-equity: 4Hour 없이 6개(yahoo에 4시간이 없다)', () => {
            render(
                <SymbolPageClient
                    {...defaultProps}
                    symbol="005930.KS"
                    marketProfile="kr-equity"
                />
            );
            expect(framesOf()).toEqual([
                '5Min',
                '15Min',
                '30Min',
                '1Hour',
                '1Day',
                '1Week',
            ]);
        });

        it('crypto: 5Min, 1Hour, 1Day, 1Week 4개', () => {
            render(
                <SymbolPageClient
                    {...defaultProps}
                    symbol="BTCUSD"
                    marketProfile="crypto"
                />
            );
            expect(framesOf()).toEqual(['5Min', '1Hour', '1Day', '1Week']);
        });
    });

    it('renders ChartContent inside the error boundary', () => {
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('chart-content')).toBeDefined();
    });

    it('passes symbol to ChartContent', () => {
        render(<SymbolPageClient {...defaultProps} />);
        expect(
            screen.getByTestId('chart-content').firstChild?.textContent
        ).toBe('AAPL');
    });

    /*
     * 차트 탭의 Ask-AI 링크는 AI 패널 맨 위 슬롯으로 들어간다. 종목 레이아웃의 떠 있는 버튼과
     * 같은 href여야 한다 — 두 곳이 갈라지면 같은 종목이 화면에 따라 다른 질문을 채운다.
     */
    describe('panelTopSlot의 Ask-AI 링크', () => {
        const APPLE_INFO = {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        } as AssetInfo;

        // `clearMocks`가 꺼져 있어 값이 다음 테스트로 샌다 — 기본(자산 정보 없음)으로 되돌린다.
        afterEach(() => {
            vi.mocked(useAssetInfo).mockReturnValue(undefined);
        });

        it('ko: 한글 종목명 질문과 접두사 없는 ai 호스트 주소를 href에 싣는다', () => {
            vi.mocked(useAssetInfo).mockReturnValue(APPLE_INFO);
            render(<SymbolPageClient {...defaultProps} />);

            const question = catalogTranslator('widgets.ask-ai-fab', 'ko')(
                'question',
                { name: '애플' }
            );
            expect(
                within(screen.getByTestId('panel-top-slot')).getByRole('link')
            ).toHaveAttribute('href', aiAskUrl('/', question));
        });

        it('en: 영어 종목명 질문과 /en 접두 경로를 href에 싣는다', () => {
            vi.mocked(useAssetInfo).mockReturnValue(APPLE_INFO);
            renderWithIntl(<SymbolPageClient {...defaultProps} />, {
                locale: 'en',
            });

            const question = catalogTranslator('widgets.ask-ai-fab', 'en')(
                'question',
                { name: 'Apple Inc.' }
            );
            expect(
                within(screen.getByTestId('panel-top-slot')).getByRole('link')
            ).toHaveAttribute('href', aiAskUrl('/en', question));
        });

        it('자산 정보가 아직 없으면 대문자 티커로 질문을 만든다', () => {
            vi.mocked(useAssetInfo).mockReturnValue(undefined);
            render(<SymbolPageClient {...defaultProps} symbol="aapl" />);

            const question = catalogTranslator('widgets.ask-ai-fab', 'ko')(
                'question',
                { name: 'AAPL' }
            );
            expect(
                within(screen.getByTestId('panel-top-slot')).getByRole('link')
            ).toHaveAttribute('href', aiAskUrl('/', question));
        });
    });

    it('does not render MobileAnalysisSheet when isMobileViewport is false', () => {
        vi.mocked(useIsMobileViewport).mockReturnValue(false);
        vi.mocked(useHydrated).mockReturnValue(true);
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.queryByTestId('mobile-sheet')).toBeNull();
    });

    it('renders MobileAnalysisSheet when hydrated and isMobileViewport is true', () => {
        vi.mocked(useHydrated).mockReturnValue(true);
        vi.mocked(useIsMobileViewport).mockReturnValue(true);
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();
    });

    it('does not render MobileAnalysisSheet when not hydrated even if mobile', () => {
        vi.mocked(useHydrated).mockReturnValue(false);
        vi.mocked(useIsMobileViewport).mockReturnValue(true);
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.queryByTestId('mobile-sheet')).toBeNull();
    });

    /**
     * 이 컴포넌트는 이제 서버에서도 렌더된다(`useUrlSearchParam` — CSR bailout 없음).
     * 봉 seed가 없는 채로 ChartContent를 서버 렌더하면 그 안의 `useSuspenseQuery`가
     * 서버 렌더 중에 봉 Server Action을 부른다 — seed가 없으면 하이드레이션 전엔
     * ChartSkeleton만 그린다.
     */
    describe('봉 seed 유무에 따른 차트 렌더', () => {
        function serverHtml(hasBarsSeed?: boolean): string {
            return renderToString(
                <IntlTestProvider>
                    <SymbolPageClient
                        {...defaultProps}
                        {...(hasBarsSeed === undefined ? {} : { hasBarsSeed })}
                    />
                </IntlTestProvider>
            );
        }

        beforeEach(() => {
            vi.mocked(useIsMobileViewport).mockReturnValue(false);
        });

        describe('서버·하이드레이션 렌더(useHydrated=false)', () => {
            beforeEach(() => {
                vi.mocked(useHydrated).mockReturnValue(false);
            });

            it('seed가 있으면 차트를 서버 HTML에 그린다', () => {
                const html = serverHtml(true);
                expect(html).toContain('data-testid="chart-content"');
                expect(html).not.toContain('data-testid="chart-skeleton"');
            });

            it('hasBarsSeed를 생략하면 seed가 있는 것으로 본다', () => {
                expect(serverHtml()).toContain('data-testid="chart-content"');
            });

            it('seed가 없으면 ChartSkeleton만 그리고 ChartContent를 렌더하지 않는다', () => {
                const html = serverHtml(false);
                expect(html).toContain('data-testid="chart-skeleton"');
                expect(html).not.toContain('data-testid="chart-content"');
            });

            it('seed가 없어도 가시 h1·타임프레임 바는 서버 HTML에 나간다', () => {
                const html = serverHtml(false);
                expect(html).toContain('<h1');
                expect(html).toContain('data-testid="timeframe-selector"');
            });
        });

        it('seed가 없으면 하이드레이션 뒤 브라우저에서 차트를 마운트한다', () => {
            vi.mocked(useHydrated).mockReturnValue(true);
            render(<SymbolPageClient {...defaultProps} hasBarsSeed={false} />);
            expect(screen.getByTestId('chart-content')).toBeInTheDocument();
            expect(screen.queryByTestId('chart-skeleton')).toBeNull();
        });
    });
});
