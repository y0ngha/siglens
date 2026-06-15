import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinancialsDegraded } from '../FinancialsDegraded';

describe('FinancialsDegraded', () => {
    it('renders the displayName h1, the degrade notice, and cross links', () => {
        render(<FinancialsDegraded displayName="애플" symbol="AAPL" />);

        // exactly one h1 carrying the resolved display name (SEO contract)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '애플 재무제표'
        );
        expect(
            screen.getByText('재무 데이터를 일시적으로 불러올 수 없어요')
        ).toBeInTheDocument();
        // CrossLinkCards rendered with financials marked as the current page
        expect(screen.getByText('지금 보는 페이지예요')).toBeInTheDocument();
    });
});
