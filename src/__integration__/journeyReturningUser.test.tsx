import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectorTabs } from '@/widgets/dashboard/SectorTabs';
import { SymbolTabs } from '@/widgets/symbol-page/SymbolTabs';
import { TimeframeSelector } from '@/widgets/chart/TimeframeSelector';
import { ModelSelector } from '@/widgets/analysis/ModelSelector';
import type { Timeframe, ModelId } from '@y0ngha/siglens-core';

let mockPathname = '/market';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => mockPathname,
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/shared/config/dashboard-tickers', () => ({
    SIGNAL_SECTORS: [
        { symbol: 'XLK', koreanName: '기술' },
        { symbol: 'XLV', koreanName: '헬스케어' },
    ],
}));

vi.mock('@/shared/ui/tabs', async () => {
    const { createTabsUnderlineMock } =
        await import('./helpers/TabsUnderlineMock');
    return createTabsUnderlineMock();
});

vi.mock('@/shared/config/market', () => ({
    TIMEFRAMES: ['1Day', '1Hour'] as Timeframe[],
}));

vi.mock('@y0ngha/siglens-core', () => ({
    isFreeModel: vi.fn(() => true),
}));

vi.mock('@/shared/hooks/usePopoverToggle', () => ({
    usePopoverToggle: () => ({
        isOpen: false,
        toggle: vi.fn(),
        close: vi.fn(),
    }),
}));

// useAssetInfo returns a resolved equity asset so all us-equity tabs are rendered.
// (undefined = loading → shows placeholder div; null = unknown → shows us-equity tabs)
vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => ({ symbol: 'AAPL', name: 'Apple Inc.' })),
}));

describe('Journey: Returning User', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPathname = '/market';
    });

    describe('Step 1: Dashboard -> Sector scan', () => {
        it('renders sector tabs on dashboard', () => {
            render(<SectorTabs activeSector="XLK" onChange={vi.fn()} />);
            expect(screen.getByText('기술')).toBeInTheDocument();
            expect(screen.getByText('헬스케어')).toBeInTheDocument();
        });

        it('allows switching sectors', async () => {
            const onChange = vi.fn();
            render(<SectorTabs activeSector="XLK" onChange={onChange} />);
            const user = userEvent.setup();
            await user.click(screen.getByText('헬스케어'));
            expect(onChange).toHaveBeenCalledWith('XLV');
        });
    });

    describe('Step 2: Navigate to symbol', () => {
        it('renders symbol tabs after navigation', () => {
            mockPathname = '/AAPL';
            render(<SymbolTabs symbol="AAPL" />);
            expect(screen.getByText('차트')).toBeInTheDocument();
        });
    });

    describe('Step 3: Change timeframe and indicators', () => {
        it('renders timeframe options', () => {
            render(
                <TimeframeSelector
                    value={'1Day' as Timeframe}
                    onChange={vi.fn()}
                />
            );
            expect(screen.getByText('1일')).toBeInTheDocument();
            expect(screen.getByText('1시간')).toBeInTheDocument();
        });

        it('changes timeframe when clicked', async () => {
            const onChange = vi.fn();
            render(
                <TimeframeSelector
                    value={'1Day' as Timeframe}
                    onChange={onChange}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByText('1시간'));
            expect(onChange).toHaveBeenCalledWith('1Hour');
        });
    });

    describe('Step 4: Model selector interaction', () => {
        it('renders model selector with selected model', () => {
            render(
                <ModelSelector
                    selectedModel={'gemini-2.5-flash-lite' as ModelId}
                    onModelChange={vi.fn()}
                    allowedModels={[
                        'gemini-2.5-flash-lite' as ModelId,
                        'gemini-2.5-flash' as ModelId,
                    ]}
                />
            );
            expect(
                screen.getByLabelText('AI 분석 모델 선택')
            ).toBeInTheDocument();
        });

        it('opens model dropdown on click', async () => {
            render(
                <ModelSelector
                    selectedModel={'gemini-2.5-flash-lite' as ModelId}
                    onModelChange={vi.fn()}
                    allowedModels={['gemini-2.5-flash-lite' as ModelId]}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByLabelText('AI 분석 모델 선택'));
            expect(screen.getByLabelText('AI 분석 모델 선택')).toHaveAttribute(
                'aria-expanded'
            );
        });
    });
});
