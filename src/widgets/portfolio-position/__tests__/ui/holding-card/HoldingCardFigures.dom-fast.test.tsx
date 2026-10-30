import { render, screen } from '@testing-library/react';
import { HoldingCardFigures } from '@/widgets/portfolio-position/ui/holding-card/HoldingCardFigures';

describe('HoldingCardFigures', () => {
    it('평단·현재가를 심볼 통화로 표시한다', () => {
        render(
            <HoldingCardFigures
                symbol="005930.KS"
                avg={274_500}
                current={280_000}
                returnPct={2}
            />
        );

        expect(screen.getByText('평단').nextElementSibling?.textContent).toBe(
            '₩274,500'
        );
        expect(screen.getByText('현재가').nextElementSibling?.textContent).toBe(
            '₩280,000'
        );
    });

    describe('수익률 색', () => {
        it('이익은 success 색이다', () => {
            render(
                <HoldingCardFigures
                    symbol="AAPL"
                    avg={100}
                    current={110}
                    returnPct={10}
                />
            );

            const cell = screen.getByText('수익률').nextElementSibling;
            expect(cell?.className).toContain('text-ui-success-text');
            expect(cell?.className).not.toContain('text-secondary-400');
        });

        it('손실은 danger 색이다', () => {
            render(
                <HoldingCardFigures
                    symbol="AAPL"
                    avg={100}
                    current={90}
                    returnPct={-10}
                />
            );

            const cell = screen.getByText('수익률').nextElementSibling;
            expect(cell?.className).toContain('text-ui-danger-text');
        });

        it('손익분기(0%)는 success가 아니라 중립색이다', () => {
            render(
                <HoldingCardFigures
                    symbol="AAPL"
                    avg={100}
                    current={100}
                    returnPct={0}
                />
            );

            const cell = screen.getByText('수익률').nextElementSibling;
            expect(cell?.className).toContain('text-secondary-400');
            expect(cell?.className).not.toContain('text-ui-success-text');
            expect(cell?.className).not.toContain('text-ui-danger-text');
        });
    });
});
