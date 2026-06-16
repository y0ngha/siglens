import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinancialsDegraded } from '@/app/[symbol]/financials/FinancialsDegraded';

describe('FinancialsDegraded', () => {
    // 단일 렌더를 공유하되 facet별로 it()을 나눠 실패 지점을 명확히 한다.
    beforeEach(() => {
        render(<FinancialsDegraded displayName="애플" symbol="AAPL" />);
    });

    it('renders exactly one h1 carrying the resolved display name (SEO contract)', () => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '애플 재무제표'
        );
    });

    it('renders the degrade notice', () => {
        expect(
            screen.getByText('재무 데이터를 일시적으로 불러올 수 없어요')
        ).toBeInTheDocument();
    });

    it('renders the cross links with financials marked current', () => {
        expect(screen.getByText('지금 보는 페이지예요')).toBeInTheDocument();
    });
});
