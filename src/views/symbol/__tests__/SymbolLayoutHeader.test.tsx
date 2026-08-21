import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import { SymbolLayoutHeader } from '@/views/symbol/SymbolLayoutHeader';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => ({
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    })),
}));

const { mockUseSymbolModel, mockOpenSignupNudge } = vi.hoisted(() => ({
    mockOpenSignupNudge: vi.fn(),
    mockUseSymbolModel: vi.fn(),
}));

// The provider (not the header) owns and renders the single signup-nudge modal.
// The header only calls the shared `openSignupNudge` from context on a locked
// toggle click, so these tests assert on that opener, not on a rendered modal.
function symbolModelValue(overrides: Record<string, unknown> = {}) {
    return {
        modelId: 'gemini-2.5-flash-lite',
        allowedModels: ['gemini-2.5-flash-lite'],
        isHydrated: true,
        gateModal: null,
        dismissGate: vi.fn(),
        handleModelChange: vi.fn(),
        reasoning: false,
        setReasoning: vi.fn(),
        canUseReasoning: false,
        openSignupNudge: mockOpenSignupNudge,
        ...overrides,
    };
}

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: mockUseSymbolModel,
}));

vi.mock('@/views/symbol/SymbolTabs', () => ({
    SymbolTabs: () => <nav data-testid="symbol-tabs">tabs</nav>,
}));

vi.mock('@/views/symbol/SymbolTabsSkeleton', () => ({
    SymbolTabsSkeleton: () => <div data-testid="tabs-skeleton">loading</div>,
}));

// The header only wires props through to AnalysisSettingsMenu now — the real
// ModelSelector/ReasoningToggle behavior (gear popover open/close, focus,
// active dot, gating) is covered by AnalysisSettingsMenu's own test file.
// This fake mirrors just enough of the real widget's shape (gear trigger +
// popover disclosure) so header tests that need to reach the model
// selector/reasoning toggle can do so by opening the gear first, matching
// the real interaction shape instead of bypassing it.
vi.mock('@/widgets/analysis', () => ({
    AnalysisSettingsMenu: ({
        modelId,
        reasoning,
        canUseReasoning,
        setReasoning,
        openSignupNudge,
    }: {
        modelId: string;
        reasoning: boolean;
        canUseReasoning: boolean;
        setReasoning: (v: boolean) => void;
        openSignupNudge: () => void;
        [key: string]: unknown;
    }) => {
        const [open, setOpen] = useState(false);
        return (
            <div>
                <button
                    type="button"
                    data-testid="settings-gear"
                    onClick={() => setOpen(o => !o)}
                >
                    분석 설정
                </button>
                {open && (
                    <div data-testid="settings-popover">
                        <div data-testid="model-selector">{modelId}</div>
                        <button
                            type="button"
                            data-testid="reasoning-toggle"
                            onClick={() =>
                                canUseReasoning
                                    ? setReasoning(!reasoning)
                                    : openSignupNudge()
                            }
                        >
                            {canUseReasoning
                                ? reasoning
                                    ? 'on'
                                    : 'off'
                                : 'locked'}
                        </button>
                    </div>
                )}
            </div>
        );
    },
}));

// Throw-capable so the ErrorBoundary fallback={null} path can be exercised.
const { mockFearGreedChip } = vi.hoisted(() => ({
    mockFearGreedChip: vi.fn(),
}));

vi.mock('@/views/symbol/FearGreedHeaderChipMounted', () => ({
    FearGreedHeaderChipMounted: () => mockFearGreedChip(),
}));

vi.mock('@/features/premium-gate', () => ({
    PremiumModelGateModal: () => <div data-testid="gate-modal">modal</div>,
}));

vi.mock('@/shared/lib/llmProviderLabels', () => ({
    LLM_PROVIDER_LABELS: { google: 'Google' },
}));

vi.mock('@/widgets/share', () => ({
    ShareButton: () => <button data-testid="share-button">공유</button>,
}));

vi.mock('@/features/portfolio-holding', () => ({
    PortfolioChipMounted: () => (
        <span data-testid="portfolio-chip">portfolio</span>
    ),
}));

describe('SymbolLayoutHeader', () => {
    beforeEach(() => {
        mockOpenSignupNudge.mockReset();
        mockUseSymbolModel.mockReturnValue(symbolModelValue());
        mockFearGreedChip.mockImplementation(() => (
            <span data-testid="fear-greed-chip">FG</span>
        ));
    });

    it('renders a header element', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        expect(screen.getByRole('banner')).toBeDefined();
    });

    it('renders the SIGLENS logo link', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        const link = screen.getByText('SIGLENS');
        expect(link.closest('a')?.getAttribute('href')).toBe('/');
    });

    it('renders the uppercased ticker', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        expect(screen.getByText('(AAPL)')).toBeDefined();
    });

    it('renders the company name', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        expect(screen.getByText('Apple Inc.')).toBeDefined();
    });

    it('renders the korean name', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        expect(screen.getByText(/애플/)).toBeDefined();
    });

    it('renders the 분석 설정 gear (model selector + reasoning toggle are consolidated behind it)', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        expect(screen.getByTestId('settings-gear')).toBeDefined();
        // Collapsed by default — the model selector isn't in the DOM until
        // the gear is opened, mirroring the real AnalysisSettingsMenu.
        expect(screen.queryByTestId('model-selector')).toBeNull();
    });

    it('opening the gear reveals the model selector', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        fireEvent.click(screen.getByTestId('settings-gear'));
        expect(screen.getByTestId('model-selector')).toBeDefined();
    });

    it('renders the portfolio holding chip', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        expect(screen.getByTestId('portfolio-chip')).toBeDefined();
    });

    it('still renders the reasoning toggle for free/anonymous tier (canUseReasoning=false), locked rather than hidden', () => {
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ canUseReasoning: false })
        );

        render(<SymbolLayoutHeader symbol="aapl" />);
        fireEvent.click(screen.getByTestId('settings-gear'));
        const toggle = screen.getByTestId('reasoning-toggle');
        expect(toggle).toBeDefined();
        expect(toggle.textContent).toBe('locked');
    });

    it('shows the reasoning toggle for member/pro tier (canUseReasoning=true)', () => {
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ reasoning: true, canUseReasoning: true })
        );

        render(<SymbolLayoutHeader symbol="aapl" />);
        fireEvent.click(screen.getByTestId('settings-gear'));
        const toggle = screen.getByTestId('reasoning-toggle');
        expect(toggle).toBeDefined();
        expect(toggle.textContent).toBe('on');
    });

    it('member: clicking the toggle calls setReasoning (no signup nudge)', () => {
        const setReasoning = vi.fn();
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ setReasoning, canUseReasoning: true })
        );

        render(<SymbolLayoutHeader symbol="aapl" />);
        fireEvent.click(screen.getByTestId('settings-gear'));
        fireEvent.click(screen.getByTestId('reasoning-toggle'));

        expect(setReasoning).toHaveBeenCalledWith(true);
        // Members never trigger the shared signup-nudge opener.
        expect(mockOpenSignupNudge).not.toHaveBeenCalled();
    });

    it('non-member: clicking the locked toggle opens the shared signup nudge (via provider opener)', () => {
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ canUseReasoning: false })
        );

        render(<SymbolLayoutHeader symbol="aapl" />);
        fireEvent.click(screen.getByTestId('settings-gear'));
        // The header does NOT render the modal itself — the provider owns the
        // single instance. Clicking the locked toggle only calls the opener.
        expect(mockOpenSignupNudge).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('reasoning-toggle'));

        expect(mockOpenSignupNudge).toHaveBeenCalledTimes(1);
        // The modal is not rendered in the header's subtree.
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('swallows a thrown fear-greed chip error via ErrorBoundary and still renders the header', () => {
        // FearGreedHeaderChipMounted uses useSuspenseQuery; if its bars fetch
        // throws (the SSR failure mode #513 guards), the ErrorBoundary
        // fallback={null} must contain it so the header shell survives.
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockFearGreedChip.mockImplementation(() => {
            throw new Error('bars fetch failed');
        });

        // try/finally so a failed assertion still restores the spy and doesn't
        // leak the console.error mock into sibling tests.
        try {
            render(<SymbolLayoutHeader symbol="aapl" />);

            expect(screen.queryByTestId('fear-greed-chip')).toBeNull();
            expect(screen.getByRole('banner')).toBeDefined();
            expect(screen.getByText('(AAPL)')).toBeDefined();
            // ErrorBoundary가 에러를 잡으면 React가 console.error로 보고한다 —
            // 에러 경로가 실제로 실행됐음을 검증.
            expect(consoleSpy).toHaveBeenCalled();
        } finally {
            consoleSpy.mockRestore();
        }
    });

    // 헤더 디클러터(분석 설정 기어 도입) 이후의 단일 행 회귀 커버리지. 이전엔
    // 모바일에서 두 줄(공포·탐욕+공유 / 모델·토글·보유종목 칩)로 쌓았지만, 모델
    // 셀렉터+추론 토글이 기어 팝오버 뒤로 합쳐지면서 남는 컨트롤은 [평단 칩]
    // [공유][기어] 3개의 아이콘 버튼뿐이라 모바일도 데스크톱도 한 행으로
    // 충분해졌다 — 헤더가 더 짧아졌는지(웹킷 회귀 가드) 검증하는 구조적
    // 증거이기도 하다. CSS(sm:hidden 등)는 jsdom에서 적용되지 않으므로 DOM
    // 그룹핑으로 검증한다: 공유 버튼·보유종목 칩·설정 기어가 같은 클러스터의
    // 형제이고, 그 클러스터는 모바일 공포·탐욕 칩과 같은 단일 컨트롤 행의
    // 형제다(더 이상 별도의 '외톨이 칩 행'이 없다).
    it('모바일 컨트롤 단일 행: 공포·탐욕 칩과 [평단 칩][공유][분석 설정 기어] 클러스터가 하나의 컨트롤 행에 모인다', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);

        // 공유 버튼·보유종목 칩·설정 기어는 같은 버튼 클러스터의 형제다.
        const buttonCluster = screen.getByTestId('share-button').parentElement;
        expect(buttonCluster).not.toBeNull();
        expect(
            within(buttonCluster as HTMLElement).getByTestId('portfolio-chip')
        ).toBeInTheDocument();
        expect(
            within(buttonCluster as HTMLElement).getByTestId('settings-gear')
        ).toBeInTheDocument();

        // 그 클러스터는 모바일 공포·탐욕 칩과 같은 단일 컨트롤 행의 형제다 —
        // 더 이상 칩만 홀로 떨어진 별도 행이 없다.
        const controlRow = (buttonCluster as HTMLElement).parentElement;
        expect(controlRow).not.toBeNull();
        expect(
            within(controlRow as HTMLElement).getByTestId('fear-greed-chip')
        ).toBeInTheDocument();
    });

    it('renders the premium gate modal when the context exposes one', () => {
        mockUseSymbolModel.mockReturnValue(
            symbolModelValue({
                gateModal: { mode: 'upgrade', provider: 'google' },
            })
        );

        render(<SymbolLayoutHeader symbol="aapl" />);

        expect(screen.getByTestId('gate-modal')).toBeInTheDocument();
    });

    it('omits the company-name segment when the name is just the ticker', () => {
        // Unseeded symbols come back with name === ticker. Rendering
        // "AAPL, AAPL (AAPL)" would be nonsense, so the breadcrumb drops the
        // company segment and separates the Korean name with a space instead
        // of a comma.
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: 'AAPL',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        } as ReturnType<typeof useAssetInfo>);

        render(<SymbolLayoutHeader symbol="aapl" />);

        expect(screen.getByText('(AAPL)')).toBeInTheDocument();
        expect(screen.getByText(/애플/)).toBeInTheDocument();
        // The Korean name must not be followed by a comma when no company
        // name segment follows it.
        expect(screen.queryByText(/애플,/)).not.toBeInTheDocument();
    });

    /**
     * 프로덕션 빌드 실증에서 잡힌 결함이다. `buildDisplayName`은 국내 종목에서 영문
     * 법인명을 빼도록 고쳤는데 이 헤더는 이름을 직접 조립해서, 같은 페이지의
     * `<title>`·description은 `삼성전자 (005930.KS)`인데 화면 상단만
     * `삼성전자, Samsung Electronics Co., Ltd. (005930.KS)`로 나갔다.
     */
    it('국내 상장 종목은 영문 법인명을 붙이지 않는다', () => {
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: 'Samsung Electronics Co., Ltd.',
            koreanName: '삼성전자',
        } as ReturnType<typeof useAssetInfo>);

        render(<SymbolLayoutHeader symbol="005930.KS" />);

        expect(screen.getByText('(005930.KS)')).toBeInTheDocument();
        expect(screen.getByText(/삼성전자/)).toBeInTheDocument();
        expect(
            screen.queryByText(/Samsung Electronics/)
        ).not.toBeInTheDocument();
        // 영문명이 빠지면 쉼표도 빠져야 한다.
        expect(screen.queryByText(/삼성전자,/)).not.toBeInTheDocument();
    });

    it('종목 마스터 시드처럼 name과 koreanName이 같으면 한 번만 쓴다', () => {
        // 시드는 영문명을 주지 않아 `name`에 한글명을 넣는다 — 방문 전 종목이 이 상태다.
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: '애플',
            koreanName: '애플',
        } as ReturnType<typeof useAssetInfo>);

        render(<SymbolLayoutHeader symbol="aapl" />);

        expect(screen.queryByText(/애플,/)).not.toBeInTheDocument();
    });

    /**
     * `shouldShowEnglishName`이 막는 회귀다. name이 빈 문자열인 종목(시세만 있고
     * 이름이 없는 크립토 등)에서 옛 `hasCompanyName`은 `name !== ''` 가드가 없어
     * true가 됐고, 그 결과 헤더가 `애플, (AAPL)`처럼 빈 span과 낙오된 쉼표를 렌더했다.
     */
    it('name이 빈 문자열이면 회사명 세그먼트도 쉼표도 렌더하지 않는다', () => {
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: '',
            koreanName: '애플',
        } as ReturnType<typeof useAssetInfo>);

        render(<SymbolLayoutHeader symbol="aapl" />);

        expect(screen.getByText('(AAPL)')).toBeInTheDocument();
        expect(screen.getByText(/애플/)).toBeInTheDocument();
        expect(screen.queryByText(/애플,/)).not.toBeInTheDocument();
    });
});

/**
 * 브레드크럼 이름은 같은 페이지의 `<title>`(= `buildDisplayName`)과 **같은 것을
 * 말해야 한다.** 이 스위트의 다른 이름 테스트는 전부 전역 ko 프로바이더로
 * 렌더되므로 이 계열을 구조적으로 볼 수 없다.
 */
describe('SymbolLayoutHeader — 로케일별 이름', () => {
    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 영문명이 있으면 한국어명을 쓰지 않는다',
        locale => {
            vi.mocked(useAssetInfo).mockReturnValueOnce({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as ReturnType<typeof useAssetInfo>);

            renderWithIntl(<SymbolLayoutHeader symbol="aapl" />, { locale });

            expect(screen.getByText(/Apple Inc\./)).toBeInTheDocument();
            expect(screen.queryByText(/애플/)).not.toBeInTheDocument();
        }
    );

    /**
     * 국내 종목 다수가 영문명이 비어 있다. 그때까지 티커만 남기면
     * `buildDisplayName`(`삼성전자 (005930.KS)`)과 헤더가 어긋난다.
     */
    it('en: 영문명이 없으면 한국어명으로 떨어진다', () => {
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: '',
            koreanName: '삼성전자',
            fmpSymbol: '005930.KS',
        } as ReturnType<typeof useAssetInfo>);

        renderWithIntl(<SymbolLayoutHeader symbol="005930.KS" />, {
            locale: 'en',
        });

        expect(screen.getByText(/삼성전자/)).toBeInTheDocument();
    });
});
