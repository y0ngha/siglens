import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TickerCategories } from '@/widgets/home/TickerCategories';
import { SymbolTabs } from '@/views/symbol/SymbolTabs';
import { PremiumModelGateModal } from '@/features/premium-gate/ui/PremiumModelGateModal';
import type { GateMode } from '@/entities/api-key';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
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

vi.mock('@/shared/config/popular-tickers', () => ({
    TICKER_CATEGORIES: [
        {
            id: 'megacap',
            label: 'Mega Cap',
            items: [
                { symbol: 'AAPL', name: 'Apple' },
                { symbol: 'MSFT', name: 'Microsoft' },
                { symbol: 'GOOGL', name: 'Alphabet' },
            ],
        },
    ],
}));

vi.mock('@/shared/hooks/useEscapeKey', () => ({
    useEscapeKey: vi.fn(),
}));

vi.mock('@/shared/hooks/useFocusTrap', () => ({
    useFocusTrap: vi.fn(),
}));

// useAssetInfo returns a resolved equity asset so all us-equity tabs are rendered.
// (undefined = loading → shows placeholder div; null = unknown → shows us-equity tabs)
vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => ({ symbol: 'AAPL', name: 'Apple Inc.' })),
}));

describe('Journey: New User', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Step 1: Home -> Browse categories', () => {
        it('renders ticker categories on home page', () => {
            render(<TickerCategories />);
            expect(screen.getByText('Mega Cap')).toBeInTheDocument();
            expect(screen.getByText('AAPL')).toBeInTheDocument();
            expect(screen.getByText('MSFT')).toBeInTheDocument();
        });

        it('ticker links navigate to symbol pages', () => {
            render(<TickerCategories />);
            const aaplLink = screen.getByRole('link', { name: /AAPL/ });
            expect(aaplLink).toHaveAttribute('href', '/AAPL');
        });
    });

    describe('Step 2: Symbol page tab navigation', () => {
        it('renders all analysis tabs', () => {
            render(<SymbolTabs symbol="AAPL" />);
            expect(screen.getByText('차트')).toBeInTheDocument();
            expect(screen.getByText('뉴스')).toBeInTheDocument();
            expect(screen.getByText('펀더멘털')).toBeInTheDocument();
            expect(screen.getByText('옵션')).toBeInTheDocument();
            expect(screen.getByText('공포 탐욕 지수')).toBeInTheDocument();
            expect(screen.getByText('종합')).toBeInTheDocument();
        });

        it('chart tab is active by default on symbol root', () => {
            render(<SymbolTabs symbol="AAPL" />);
            const chartLink = screen.getByText('차트');
            expect(chartLink).toHaveAttribute('aria-current', 'page');
        });
    });

    describe('Step 3: Premium gate -> Signup', () => {
        it('shows signup gate when unauthenticated user selects premium model', () => {
            render(
                <PremiumModelGateModal
                    mode={'auth' as GateMode}
                    onClose={vi.fn()}
                />
            );
            expect(
                screen.getByText('프리미엄 모델 사용 안내')
            ).toBeInTheDocument();
            const signupLink = screen.getByRole('link', {
                name: '회원가입 하러 가기',
            });
            expect(signupLink).toHaveAttribute('href', '/signup');
        });

        it('allows dismissing the gate modal', async () => {
            const onClose = vi.fn();
            render(
                <PremiumModelGateModal
                    mode={'auth' as GateMode}
                    onClose={onClose}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByText('닫기'));
            expect(onClose).toHaveBeenCalled();
        });
    });
});
