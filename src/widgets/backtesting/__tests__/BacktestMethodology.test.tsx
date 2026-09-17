import { render, screen } from '@testing-library/react';
import { BacktestMethodology } from '../BacktestMethodology';

describe('BacktestMethodology', () => {
    it('renders the heading and all methodology bullets', () => {
        render(<BacktestMethodology />);

        expect(screen.getByText('백테스트 방법론')).toBeInTheDocument();
        expect(
            screen.getByText(/청산 시점 수익률이 0% 이상이면 승리로 집계/)
        ).toBeInTheDocument();
        expect(screen.getByText(/최대 10거래일 보유/)).toBeInTheDocument();
        expect(
            screen.getByText(/거래 수수료와 슬리피지는 반영하지 않았습니다/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/생존 편향이 있을 수 있습니다/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Financial Modeling Prep\(FMP\)/)
        ).toBeInTheDocument();
    });

    it('renders as a labeled section, not a collapsible', () => {
        render(<BacktestMethodology />);

        const heading = screen.getByRole('heading', {
            name: '백테스트 방법론',
        });
        expect(heading.closest('section')).toHaveAccessibleName(
            '백테스트 방법론'
        );
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
