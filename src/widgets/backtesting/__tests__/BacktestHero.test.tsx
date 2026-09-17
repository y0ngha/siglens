import { render, screen } from '@testing-library/react';
import type { BacktestStats } from '@/entities/backtest-case';

import { BacktestHero } from '../BacktestHero';

const STATS: BacktestStats = {
    totalCases: 150,
    indicatorWins: 93,
    indicatorWinRate: 62,
    aiDecisiveCount: 20,
    aiWins: 14,
    aiWinRateDecisive: 70,
    aiNeutralCount: 130,
    aiTrendHitRate: 65,
    meanReturnPct: 0.36,
    medianHoldingDays: 2.5,
    periodStart: '2023-01-15',
    periodEnd: '2024-12-20',
};

describe('BacktestHero', () => {
    it('renders the derived period', () => {
        render(<BacktestHero stats={STATS} />);

        expect(screen.getByText(/2023.01 – 2024.12/)).toBeInTheDocument();
    });

    it('renders the main heading without a fixed year span', () => {
        render(<BacktestHero stats={STATS} />);

        expect(
            screen.getByRole('heading', {
                name: /백테스트 — 과거 데이터 사후 검증/,
            })
        ).toBeInTheDocument();
        expect(screen.queryByText(/2년/)).not.toBeInTheDocument();
    });

    it('renders stat card values derived from cases, not meta', () => {
        render(<BacktestHero stats={STATS} />);

        expect(screen.getByText('62%')).toBeInTheDocument();
        expect(screen.getByText('70%')).toBeInTheDocument();
        expect(screen.getByText('65%')).toBeInTheDocument();
        expect(screen.getByText('+0.36%')).toBeInTheDocument();
        expect(screen.getByText('150개')).toBeInTheDocument();
        expect(screen.getByText('2.5일')).toBeInTheDocument();
    });

    it('renders the decisive-case sub-label under the AI scenario card', () => {
        render(<BacktestHero stats={STATS} />);

        expect(screen.getByText('93/150')).toBeInTheDocument();
        expect(
            screen.getByText('결정 케이스 14/20 · 중립 130건 제외')
        ).toBeInTheDocument();
    });

    it('renders stat labels', () => {
        render(<BacktestHero stats={STATS} />);

        expect(screen.getByText('지표 신호 적중률(과거)')).toBeInTheDocument();
        expect(
            screen.getByText('AI 시나리오 적중률(과거)')
        ).toBeInTheDocument();
        expect(
            screen.getByText('AI 추세 방향 적중률(과거)')
        ).toBeInTheDocument();
        expect(
            screen.getByText('평균 수익률(전체 케이스)')
        ).toBeInTheDocument();
        expect(screen.getByText('총 케이스')).toBeInTheDocument();
        expect(screen.getByText('중앙값 보유일')).toBeInTheDocument();
    });

    it('renders as a header element', () => {
        render(<BacktestHero stats={STATS} />);

        expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    // 사용자 제보: 값이 카드마다 다른 x에 떠 "표"로 읽히지 않았다. 정렬을 만드는
    // CSS 계약(왼쪽 정렬 + 자릿수 정렬 + 항상 그려지는 서브라벨 슬롯)을 고정한다.
    describe('표처럼 정렬되는 스탯 그리드', () => {
        it('값은 왼쪽 정렬 + tabular-nums로 열마다 같은 선에서 시작한다', () => {
            render(<BacktestHero stats={STATS} />);

            const value = screen.getByText('62%');
            expect(value).toHaveClass('tabular-nums');
            // 정렬은 카드 루트가 정한다 — 값은 그 안에서 블록으로 흐른다.
            expect(value.parentElement).toHaveClass('text-left');
        });

        it('서브라벨이 없는 카드도 슬롯을 그려 바닥선을 맞춘다', () => {
            render(<BacktestHero stats={STATS} />);

            const slots = screen.getAllByTestId('stat-sub-label');
            // 카드 6개 = 슬롯 6개. 서브라벨이 있는 건 둘뿐이다.
            expect(slots).toHaveLength(6);
            expect(slots.filter(slot => slot.textContent !== '')).toHaveLength(
                2
            );
            for (const slot of slots) expect(slot).toHaveClass('min-h-4');
        });
    });

    it('colors a negative mean return with the danger token', () => {
        render(<BacktestHero stats={{ ...STATS, meanReturnPct: -1.2 }} />);

        const value = screen.getByText('-1.2%');
        expect(value).toHaveClass('text-ui-danger-text');
    });
});
