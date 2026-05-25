import { render, screen } from '@testing-library/react';
import { SymbolLayoutHeader } from '@/widgets/symbol-page/SymbolLayoutHeader';

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

vi.mock('@/widgets/symbol-page/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => ({
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    })),
}));

vi.mock('@/widgets/symbol-page/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({
        modelId: 'gemini-2.5-flash-lite',
        allowedModels: ['gemini-2.5-flash-lite'],
        isHydrated: true,
        gateModal: null,
        dismissGate: vi.fn(),
        handleModelChange: vi.fn(),
    })),
}));

vi.mock('@/widgets/symbol-page/SymbolTabs', () => ({
    SymbolTabs: () => <nav data-testid="symbol-tabs">tabs</nav>,
}));

vi.mock('@/widgets/symbol-page/SymbolTabsSkeleton', () => ({
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

vi.mock('@/widgets/symbol-page/FearGreedHeaderChipMounted', () => ({
    FearGreedHeaderChipMounted: () => (
        <span data-testid="fear-greed-chip">FG</span>
    ),
}));

vi.mock('@/features/premium-gate', () => ({
    PremiumModelGateModal: () => <div data-testid="gate-modal">modal</div>,
}));

vi.mock('@/shared/lib/llmProviderLabels', () => ({
    LLM_PROVIDER_LABELS: { google: 'Google' },
}));

describe('SymbolLayoutHeader', () => {
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
});
