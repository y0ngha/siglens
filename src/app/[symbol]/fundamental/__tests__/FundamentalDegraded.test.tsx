// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { FundamentalDegraded } from '../FundamentalDegraded';

vi.mock('@/widgets/symbol-page', () => ({
    SymbolPageHeading: ({ children }: { children: ReactNode }) => (
        <h1>{children}</h1>
    ),
    CrossLinkCards: ({
        symbol,
        current,
    }: {
        symbol: string;
        current: string;
    }) => (
        <div
            data-testid="cross-links"
            data-symbol={symbol}
            data-current={current}
        />
    ),
}));

describe('FundamentalDegraded', () => {
    it('renders exactly one h1 carrying the display name (single-h1 SEO contract)', () => {
        const { container } = render(
            <FundamentalDegraded displayName="애플 (AAPL)" symbol="AAPL" />
        );

        const h1s = container.querySelectorAll('h1');
        expect(h1s).toHaveLength(1);
        expect(h1s[0].textContent).toContain('애플 (AAPL)');
    });

    it('shows the temporary-unavailable notice', () => {
        render(<FundamentalDegraded displayName="AAPL" symbol="AAPL" />);

        expect(
            screen.getByText(/일시적으로 불러올 수 없어요/)
        ).toBeInTheDocument();
    });

    it('keeps the cross-route links so the visitor can still reach other tabs', () => {
        render(<FundamentalDegraded displayName="AAPL" symbol="TSLA" />);

        const links = screen.getByTestId('cross-links');
        expect(links).toHaveAttribute('data-symbol', 'TSLA');
        expect(links).toHaveAttribute('data-current', 'fundamental');
    });
});
