import { render, screen, fireEvent, within } from '@testing-library/react';
import { SymbolLayoutHeader } from '@/views/symbol/SymbolLayoutHeader';

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

vi.mock('@/features/reasoning-toggle', () => ({
    ReasoningToggle: ({
        checked,
        canUse,
        onChange,
        onLockedClick,
    }: {
        checked: boolean;
        canUse: boolean;
        onChange: (v: boolean) => void;
        onLockedClick?: () => void;
    }) => (
        <button
            type="button"
            data-testid="reasoning-toggle"
            onClick={() => (canUse ? onChange(!checked) : onLockedClick?.())}
        >
            {canUse ? (checked ? 'on' : 'off') : 'locked'}
        </button>
    ),
}));

vi.mock('@/views/symbol/SymbolTabs', () => ({
    SymbolTabs: () => <nav data-testid="symbol-tabs">tabs</nav>,
}));

vi.mock('@/views/symbol/SymbolTabsSkeleton', () => ({
    SymbolTabsSkeleton: () => <div data-testid="tabs-skeleton">loading</div>,
}));

vi.mock('@/widgets/analysis', () => ({
    ModelSelector: ({
        selectedModel,
    }: {
        selectedModel: string;
        [key: string]: unknown;
    }) => <div data-testid="model-selector">{selectedModel}</div>,
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

    it('renders the model selector', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        expect(screen.getByTestId('model-selector')).toBeDefined();
    });

    it('renders AI model label text', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);
        expect(screen.getByText('AI 분석 모델')).toBeDefined();
    });

    it('still renders the reasoning toggle for free/anonymous tier (canUseReasoning=false), locked rather than hidden', () => {
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ canUseReasoning: false })
        );

        render(<SymbolLayoutHeader symbol="aapl" />);
        const toggle = screen.getByTestId('reasoning-toggle');
        expect(toggle).toBeDefined();
        expect(toggle.textContent).toBe('locked');
    });

    it('shows the reasoning toggle for member/pro tier (canUseReasoning=true)', () => {
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ reasoning: true, canUseReasoning: true })
        );

        render(<SymbolLayoutHeader symbol="aapl" />);
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

    // 모바일 헤더 재배치(공포·탐욕 칩+공유 = 1행, 모델 셀렉터+추론 토글 = 2행)에 대한
    // 회귀 커버리지. CSS(sm:hidden 등)는 jsdom에서 적용되지 않으므로 DOM 그룹핑으로
    // 검증한다 — 두 행이 같은 컨트롤 컨테이너의 형제이고, 각 행에 기대한 컨트롤이 모여
    // 있는지 확인해 '외톨이 칩 행' 회귀를 잡는다.
    it('모바일 컨트롤: 공포·탐욕 칩+공유 버튼이 한 행, 모델 셀렉터+추론 토글이 다른 행에 그룹된다', () => {
        render(<SymbolLayoutHeader symbol="aapl" />);

        // 공유 버튼이 속한 행: 모바일 공포·탐욕 칩과 같은 컨테이너에 있다.
        const shareRow = screen.getByTestId('share-button').parentElement;
        expect(shareRow).not.toBeNull();
        expect(
            within(shareRow as HTMLElement).getByTestId('fear-greed-chip')
        ).toBeInTheDocument();

        // 모델 셀렉터가 속한 행: 추론 토글과 같은 컨테이너에 있다.
        const controlRow = screen.getByTestId('model-selector').parentElement;
        expect(controlRow).not.toBeNull();
        expect(
            within(controlRow as HTMLElement).getByTestId('reasoning-toggle')
        ).toBeInTheDocument();

        // 두 행은 서로 다른 그룹이지만 같은 컨트롤 컨테이너의 형제다.
        expect(shareRow).not.toBe(controlRow);
        expect((shareRow as HTMLElement).parentElement).toBe(
            (controlRow as HTMLElement).parentElement
        );
    });
});
