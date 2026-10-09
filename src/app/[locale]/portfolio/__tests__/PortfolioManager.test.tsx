/**
 * `PortfolioManager` test — the thin client wrapper that wires
 * `PortfolioSection`'s `onHoldingsChange` to `router.refresh()` so `/portfolio`'s
 * server-rendered position-card grid (`PortfolioMemberArea`) picks up edits made in
 * the holdings-management section above it, and forwards `?symbol=` (from the
 * `/[symbol]/position` CTA) as the add form's starting symbol.
 */

const mockRefresh = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mockRefresh }),
    useSearchParams: () => mockSearchParams,
}));

let lastDefaultSymbol: string | undefined;
vi.mock('@/features/portfolio-management/ui/PortfolioSection', () => ({
    PortfolioSection: ({
        defaultSymbol,
        onHoldingsChange,
    }: {
        defaultSymbol?: string;
        onHoldingsChange?: () => void;
    }) => {
        lastDefaultSymbol = defaultSymbol;
        return (
            <button type="button" onClick={onHoldingsChange}>
                변경 시뮬레이션
            </button>
        );
    },
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioManager } from '@/app/[locale]/portfolio/PortfolioManager';

describe('PortfolioManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams();
        lastDefaultSymbol = undefined;
    });

    it('does not call router.refresh before any holdings change', () => {
        render(<PortfolioManager />);
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('calls router.refresh exactly once when PortfolioSection reports a holdings change', async () => {
        const user = userEvent.setup();
        render(<PortfolioManager />);

        await user.click(
            screen.getByRole('button', { name: '변경 시뮬레이션' })
        );

        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('passes ?symbol= as defaultSymbol, normalized to uppercase', () => {
        mockSearchParams = new URLSearchParams('symbol=aapl');
        render(<PortfolioManager />);
        expect(lastDefaultSymbol).toBe('AAPL');
    });

    it('passes undefined when there is no ?symbol=', () => {
        render(<PortfolioManager />);
        expect(lastDefaultSymbol).toBeUndefined();
    });
});
