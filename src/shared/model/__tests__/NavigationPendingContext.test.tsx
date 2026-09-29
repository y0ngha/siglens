import { act, fireEvent, render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import {
    NavigationPendingProvider,
    SymbolEntryPendingSlot,
    useNavigationPending,
    usePendingSymbolEntry,
} from '@/shared/model/NavigationPendingContext';

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));

const mockPathname = usePathname as ReturnType<typeof vi.fn>;

function Probe() {
    const { pendingHref, startNavigation } = useNavigationPending();
    const entry = usePendingSymbolEntry();
    return (
        <>
            <span data-testid="pending">{pendingHref ?? 'none'}</span>
            <span data-testid="entry">{entry ?? 'none'}</span>
            <button onClick={() => startNavigation('/ja/AAPL?tf=1Day')}>
                aapl
            </button>
            <button onClick={() => startNavigation('/ja/news')}>news</button>
            <button onClick={() => startNavigation('/ja/market?x=1')}>
                same
            </button>
        </>
    );
}

function Tree() {
    return (
        <NavigationPendingProvider>
            <Probe />
            <SymbolEntryPendingSlot fallback={<p>symbol skeleton</p>}>
                <p>current page</p>
            </SymbolEntryPendingSlot>
        </NavigationPendingProvider>
    );
}

describe('NavigationPendingContext', () => {
    beforeEach(() => {
        mockPathname.mockReturnValue('/ja/market');
    });

    it('starts idle — direct loads and SSR never see a pending state', () => {
        render(<Tree />);
        expect(screen.getByTestId('pending').textContent).toBe('none');
        expect(screen.queryByText('symbol skeleton')).toBeNull();
    });

    describe('when a link to a symbol is clicked', () => {
        it('swaps the page for the symbol skeleton before the RSC arrives', () => {
            render(<Tree />);

            fireEvent.click(screen.getByRole('button', { name: 'aapl' }));

            expect(screen.getByTestId('pending').textContent).toBe('/AAPL');
            expect(screen.getByTestId('entry').textContent).toBe('AAPL');
            expect(screen.getByText('symbol skeleton')).toBeTruthy();
            expect(
                screen.getByText('current page').parentElement?.className
            ).toBe('hidden');
        });

        it('clears once the route commits', () => {
            const { rerender } = render(<Tree />);
            fireEvent.click(screen.getByRole('button', { name: 'aapl' }));

            mockPathname.mockReturnValue('/ja/AAPL');
            rerender(<Tree />);

            expect(screen.getByTestId('pending').textContent).toBe('none');
            expect(screen.queryByText('symbol skeleton')).toBeNull();
        });

        it('clears on back navigation (popstate)', () => {
            render(<Tree />);
            fireEvent.click(screen.getByRole('button', { name: 'aapl' }));

            act(() => {
                window.dispatchEvent(new PopStateEvent('popstate'));
            });

            expect(screen.getByTestId('pending').textContent).toBe('none');
        });
    });

    describe('when the target is not a symbol', () => {
        it('marks the navigation pending without the symbol skeleton', () => {
            render(<Tree />);

            fireEvent.click(screen.getByRole('button', { name: 'news' }));

            expect(screen.getByTestId('pending').textContent).toBe('/news');
            expect(screen.getByTestId('entry').textContent).toBe('none');
            expect(screen.queryByText('symbol skeleton')).toBeNull();
        });

        it('ignores a query-only change of the current path (it could never clear)', () => {
            render(<Tree />);

            fireEvent.click(screen.getByRole('button', { name: 'same' }));

            expect(screen.getByTestId('pending').textContent).toBe('none');
        });
    });
});
