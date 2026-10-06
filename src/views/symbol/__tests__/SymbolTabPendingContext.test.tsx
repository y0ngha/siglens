import { fireEvent, render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import {
    NavigationPendingProvider,
    useStartNavigation,
} from '@/shared/model/NavigationPendingContext';
import {
    SymbolTabPendingSlot,
    usePendingSymbolTab,
} from '@/views/symbol/SymbolTabPendingContext';

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/AAPL'),
}));

const mockPathname = usePathname as ReturnType<typeof vi.fn>;

function Probe() {
    const startNavigation = useStartNavigation();
    const pendingTab = usePendingSymbolTab();
    return (
        <>
            <span data-testid="pending">{pendingTab ?? 'none'}</span>
            <button onClick={() => startNavigation('/en/AAPL/news')}>
                news
            </button>
            <button onClick={() => startNavigation('/en/NVDA')}>nvda</button>
            <button onClick={() => startNavigation('/en/market')}>
                market
            </button>
        </>
    );
}

function Tree() {
    return (
        <NavigationPendingProvider>
            <Probe />
            <SymbolTabPendingSlot fallback={<p>loading</p>}>
                <p>current tab</p>
            </SymbolTabPendingSlot>
        </NavigationPendingProvider>
    );
}

describe('SymbolTabPendingSlot', () => {
    beforeEach(() => {
        mockPathname.mockReturnValue('/en/AAPL');
    });

    describe('같은 종목의 다른 탭으로 가는 중이면', () => {
        it('RSC가 오기 전에 page slot을 fallback으로 바꾼다', () => {
            render(<Tree />);

            fireEvent.click(screen.getByRole('button', { name: 'news' }));

            expect(screen.getByTestId('pending').textContent).toBe(
                '/AAPL/news'
            );
            expect(screen.getByText('loading')).toBeTruthy();
            expect(
                screen.getByText('current tab').parentElement?.className
            ).toBe('hidden');
        });

        it('도착하면(경로 변경) 새 탭을 보여준다', () => {
            const { rerender } = render(<Tree />);
            fireEvent.click(screen.getByRole('button', { name: 'news' }));

            mockPathname.mockReturnValue('/en/AAPL/news');
            rerender(<Tree />);

            expect(screen.getByTestId('pending').textContent).toBe('none');
            expect(screen.queryByText('loading')).toBeNull();
        });
    });

    describe('다른 종목이나 종목 밖으로 가는 중이면', () => {
        it('탭 슬롯은 관여하지 않는다(루트 슬롯 몫)', () => {
            render(<Tree />);

            fireEvent.click(screen.getByRole('button', { name: 'nvda' }));
            expect(screen.getByTestId('pending').textContent).toBe('none');

            fireEvent.click(screen.getByRole('button', { name: 'market' }));
            expect(screen.getByTestId('pending').textContent).toBe('none');
            expect(screen.queryByText('loading')).toBeNull();
        });
    });
});
