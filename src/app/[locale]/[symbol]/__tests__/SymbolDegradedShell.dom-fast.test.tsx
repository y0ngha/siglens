import { render, screen } from '@testing-library/react';
import { SymbolDegradedShell } from '@/app/[locale]/[symbol]/SymbolDegradedShell';

describe('SymbolDegradedShell', () => {
    beforeEach(() => {
        render(
            <SymbolDegradedShell
                heading="AAPL Financials"
                noticeTitle="Temporarily unavailable"
                noticeBody="Try again shortly."
                symbol="AAPL"
                current="financials"
                marketProfile="us-equity"
            >
                <p>snapshot prose</p>
            </SymbolDegradedShell>
        );
    });

    it('keeps exactly one h1 with the heading', () => {
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'AAPL Financials'
        );
    });

    it('renders the prose slot before the notice', () => {
        const prose = screen.getByText('snapshot prose');
        const notice = screen.getByText('Temporarily unavailable');
        expect(
            prose.compareDocumentPosition(notice) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(screen.getByText('Try again shortly.')).toBeInTheDocument();
    });

    it('marks the current tab in the cross links', () => {
        expect(screen.getByText('지금 보는 페이지예요')).toBeInTheDocument();
    });
});
