import { render, screen } from '@testing-library/react';
import type { BacktestMeta } from '@y0ngha/siglens-core';

import { BacktestHero } from '../BacktestHero';

const META: BacktestMeta = {
    period: '2023.01 ~ 2024.12',
    winRate: 62,
    aiWinRate: 71,
    aiTrendHitRate: 65,
    totalCases: 150,
    tickerCount: 10,
};

describe('BacktestHero', () => {
    it('renders the period', () => {
        render(<BacktestHero meta={META} />);

        expect(screen.getByText(/2023.01 ~ 2024.12/)).toBeInTheDocument();
    });

    it('renders the main heading', () => {
        render(<BacktestHero meta={META} />);

        expect(
            screen.getByRole('heading', {
                name: /2년 백테스트 — 과거 데이터 사후 검증/,
            })
        ).toBeInTheDocument();
    });

    it('renders stat cards with correct values', () => {
        render(<BacktestHero meta={META} />);

        expect(screen.getByText('62%')).toBeInTheDocument();
        expect(screen.getByText('71%')).toBeInTheDocument();
        expect(screen.getByText('150개')).toBeInTheDocument();
        expect(screen.getByText('10종목')).toBeInTheDocument();
    });

    it('renders stat labels', () => {
        render(<BacktestHero meta={META} />);

        expect(screen.getByText('지표 신호 적중률(과거)')).toBeInTheDocument();
        expect(
            screen.getByText('AI 시나리오 적중률(과거)')
        ).toBeInTheDocument();
        expect(screen.getByText('총 케이스')).toBeInTheDocument();
    });

    it('renders as a header element', () => {
        render(<BacktestHero meta={META} />);

        expect(screen.getByRole('banner')).toBeInTheDocument();
    });
});
