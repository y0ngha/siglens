import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCurrentUser } from '@/entities/auth';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type { PortfolioHoldingView } from '@/entities/portfolio';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { PortfolioChipMounted } from '@/features/portfolio-holding/ui/PortfolioChipMounted';

vi.mock('@/entities/auth');
vi.mock('@/entities/portfolio/hooks/usePortfolioHoldings');

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUsePortfolioHoldings = vi.mocked(usePortfolioHoldings);

type CurrentUserResult = UseQueryResult<AuthUserRecord | null>;
type Holdings = ReturnType<typeof usePortfolioHoldings>;

const USER = {
    id: 'u-1',
    email: 'me@example.com',
    name: null,
    avatarUrl: null,
    tier: 'free',
    emailVerified: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
} as unknown as AuthUserRecord;

const AAPL_HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

function setCurrentUser(data: AuthUserRecord | null | undefined) {
    mockUseCurrentUser.mockReturnValue({
        data,
    } as unknown as CurrentUserResult);
}

function setHoldings(overrides: Partial<Holdings>) {
    const base: Holdings = {
        holdings: [],
        isHydrated: true,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        save: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['save'],
        remove: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['remove'],
    };
    const merged = { ...base, ...overrides };
    mockUsePortfolioHoldings.mockReturnValue(merged);
    return merged;
}

describe('PortfolioChipMounted / PortfolioChip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setHoldings({ holdings: [] });
    });

    it('renders nothing while the login check is in flight (data undefined)', () => {
        setCurrentUser(undefined);
        const { container } = render(<PortfolioChipMounted symbol="AAPL" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing for a guest (data null)', () => {
        setCurrentUser(null);
        const { container } = render(<PortfolioChipMounted symbol="AAPL" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the "set" chip for a present user with no holding (resolved successfully)', () => {
        setCurrentUser(USER);
        setHoldings({ holdings: [], isLoading: false, isError: false });
        render(<PortfolioChipMounted symbol="AAPL" />);
        expect(
            screen.getByRole('button', { name: '평단 설정' })
        ).toBeInTheDocument();
    });

    it('renders nothing while the holdings query is loading, even for a logged-in user', () => {
        setCurrentUser(USER);
        setHoldings({ holdings: [], isLoading: true });
        const { container } = render(<PortfolioChipMounted symbol="AAPL" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing (not the false "설정" state) when the holdings query errors', () => {
        setCurrentUser(USER);
        setHoldings({ holdings: [], isLoading: false, isError: true });
        const { container } = render(<PortfolioChipMounted symbol="AAPL" />);
        expect(container).toBeEmptyDOMElement();
        expect(
            screen.queryByRole('button', { name: '평단 설정' })
        ).not.toBeInTheDocument();
    });

    it('renders the value chip when a holding exists', () => {
        setCurrentUser(USER);
        setHoldings({ holdings: [AAPL_HOLDING] });
        render(<PortfolioChipMounted symbol="AAPL" />);
        expect(
            screen.getByRole('button', { name: '평단 $150.5 · 10주' })
        ).toBeInTheDocument();
    });

    it('opens the popover, submits, calls save.mutateAsync and closes on ok', async () => {
        const user = userEvent.setup();
        setCurrentUser(USER);
        const { save } = setHoldings({ holdings: [] });
        (save.mutateAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'ok',
            holding: AAPL_HOLDING,
        });
        render(<PortfolioChipMounted symbol="AAPL" />);

        await user.click(screen.getByRole('button', { name: '평단 설정' }));
        // PortfolioChipPopover is next/dynamic(ssr:false)-loaded, so it mounts
        // asynchronously after the click — await its appearance instead of a
        // synchronous getByRole.
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        await user.type(screen.getByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '저장' }));

        await waitFor(() => {
            expect(save.mutateAsync).toHaveBeenCalledWith({
                symbol: 'AAPL',
                quantity: '10',
                averagePrice: '150.5',
            });
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('surfaces the error message when the save mutation returns an error result', async () => {
        const user = userEvent.setup();
        setCurrentUser(USER);
        const { save } = setHoldings({ holdings: [] });
        (save.mutateAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'error',
            code: 'invalid_quantity',
            message: '수량은 0보다 커야 해요.',
        });
        render(<PortfolioChipMounted symbol="AAPL" />);

        await user.click(screen.getByRole('button', { name: '평단 설정' }));
        await user.type(await screen.findByLabelText('수량'), '0');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '저장' }));

        expect(
            await screen.findByText('수량은 0보다 커야 해요.')
        ).toBeInTheDocument();
        // dialog stays open on error
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('pre-fills quantity/averagePrice from the existing holding when editing', async () => {
        const user = userEvent.setup();
        setCurrentUser(USER);
        setHoldings({ holdings: [AAPL_HOLDING] });
        render(<PortfolioChipMounted symbol="AAPL" />);

        await user.click(
            screen.getByRole('button', { name: '평단 $150.5 · 10주' })
        );

        expect(await screen.findByLabelText('수량')).toHaveValue('10');
        expect(screen.getByLabelText('평단')).toHaveValue('150.5');
    });

    it('handles save.mutateAsync throwing: surfaces a generic error and keeps the dialog usable', async () => {
        const user = userEvent.setup();
        setCurrentUser(USER);
        const { save } = setHoldings({ holdings: [] });
        (save.mutateAsync as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('network down')
        );
        render(<PortfolioChipMounted symbol="AAPL" />);

        await user.click(screen.getByRole('button', { name: '평단 설정' }));
        await user.type(await screen.findByLabelText('수량'), '10');
        await user.type(screen.getByLabelText('평단'), '150.5');
        await user.click(screen.getByRole('button', { name: '저장' }));

        expect(
            await screen.findByText(
                '요청 처리 중 문제가 발생했어요. 다시 시도해 주세요.'
            )
        ).toBeInTheDocument();
        // Dialog stays open and the save button resets (not stuck submitting).
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
    });

    it('closes the popover on Escape', async () => {
        const user = userEvent.setup();
        setCurrentUser(USER);
        setHoldings({ holdings: [] });
        render(<PortfolioChipMounted symbol="AAPL" />);

        await user.click(screen.getByRole('button', { name: '평단 설정' }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
