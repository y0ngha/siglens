import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpirationSelector } from '@/widgets/options/ExpirationSelector';
import type { SlotMapping } from '@y0ngha/siglens-core';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL/options',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

const MOCK_SLOTS: SlotMapping[] = [
    {
        slot: { key: 'near', label: '근월' },
        expirationDate: '2025-01-17',
    },
    {
        slot: { key: 'mid', label: '차월' },
        expirationDate: '2025-02-21',
    },
] as unknown as SlotMapping[];

describe('Options Page Flow', () => {
    it('renders expiration tabs with slot labels', () => {
        render(
            <ExpirationSelector
                slots={MOCK_SLOTS}
                value="2025-01-17"
                onChange={vi.fn()}
            />
        );
        expect(screen.getByText('근월')).toBeInTheDocument();
        expect(screen.getByText('차월')).toBeInTheDocument();
        expect(screen.getByText('종합')).toBeInTheDocument();
    });

    it('calls onChange when a different expiration tab is clicked', async () => {
        const onChange = vi.fn();
        render(
            <ExpirationSelector
                slots={MOCK_SLOTS}
                value="2025-01-17"
                onChange={onChange}
            />
        );
        const user = userEvent.setup();
        await user.click(screen.getByText('차월'));
        expect(onChange).toHaveBeenCalledWith('2025-02-21');
    });

    it('marks the selected tab with aria-selected', () => {
        render(
            <ExpirationSelector
                slots={MOCK_SLOTS}
                value="2025-01-17"
                onChange={vi.fn()}
            />
        );
        const selectedTab = screen.getByRole('tab', { name: /근월/ });
        expect(selectedTab).toHaveAttribute('aria-selected', 'true');
    });

    it('selects all-tab when value is all', () => {
        render(
            <ExpirationSelector
                slots={MOCK_SLOTS}
                value="all"
                onChange={vi.fn()}
            />
        );
        const allTab = screen.getByRole('tab', { name: '종합' });
        expect(allTab).toHaveAttribute('aria-selected', 'true');
    });

    it('has tablist role for accessibility', () => {
        render(
            <ExpirationSelector
                slots={MOCK_SLOTS}
                value="2025-01-17"
                onChange={vi.fn()}
            />
        );
        expect(
            screen.getByRole('tablist', { name: '옵션 만기 선택' })
        ).toBeInTheDocument();
    });
});
