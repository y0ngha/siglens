import { render, screen } from '@testing-library/react';
import { FinancialHealthCard } from '@/widgets/fundamental/sections/FinancialHealthCard';

function renderCard(symbol: string, reportedCurrency?: string | null) {
    return render(
        <FinancialHealthCard
            symbol={symbol}
            ratios={null}
            scores={null}
            cashFlow={{
                operatingCashFlow: 1_200_000_000_000,
                reportedCurrency,
            }}
        />
    );
}

describe('FinancialHealthCard — 영업현금흐름 통화', () => {
    it('보고 통화(TWD)가 있으면 상장 통화(USD) 대신 그 통화로 표기한다', () => {
        renderCard('TSM', 'TWD');

        const row = screen.getByText(/TWD/);
        expect(row).toBeInTheDocument();
        expect(row.textContent).not.toContain('$');
    });

    it('보고 통화가 없으면 상장 통화로 표기한다', () => {
        renderCard('TSM');

        expect(screen.queryByText(/TWD/)).not.toBeInTheDocument();
        expect(screen.getByText(/US\$/)).toBeInTheDocument();
    });

    it('잘못된 보고 통화 코드면 상장 통화로 돌아간다', () => {
        renderCard('TSM', 'NOT-A-CODE');

        expect(screen.getByText(/US\$/)).toBeInTheDocument();
    });
});
