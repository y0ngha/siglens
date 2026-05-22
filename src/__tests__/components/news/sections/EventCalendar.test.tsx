/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { EarningsReportComparisonItem } from '@/domain/types';
import { EventCalendar } from '@/components/news/sections/EventCalendar';

const SURPRISE_ITEM: EarningsReportComparisonItem = {
    symbol: 'AAPL',
    earningsDate: '2026-04-30',
    epsActual: 2.01,
    epsEstimated: 1.95,
    revenueActual: 111_184_000_000,
    revenueEstimated: 109_457_600_000,
    lastUpdated: '2026-05-10',
    period: 'past',
    slot: 'past-1',
};

const INLINE_ITEM: EarningsReportComparisonItem = {
    ...SURPRISE_ITEM,
    earningsDate: '2026-01-29',
    epsActual: 2,
    epsEstimated: 1.99,
    revenueActual: 143_756_000_000,
    revenueEstimated: 138_391_000_000,
    slot: 'past-2',
};

const FUTURE_ITEM: EarningsReportComparisonItem = {
    ...SURPRISE_ITEM,
    earningsDate: '2026-07-30',
    epsActual: null,
    epsEstimated: 1.86,
    revenueActual: null,
    revenueEstimated: 107_618_800_000,
    period: 'future',
    slot: 'recent-or-future',
};

const NEGATIVE_EPS_ITEM: EarningsReportComparisonItem = {
    ...SURPRISE_ITEM,
    epsActual: -0.5,
    epsEstimated: -0.4,
};

describe('EventCalendar', () => {
    it('실제값과 컨센서스를 함께 표시하고 컨센서스 툴팁 트리거를 렌더링한다', () => {
        render(
            <EventCalendar earningsReports={[SURPRISE_ITEM, FUTURE_ITEM]} />
        );

        expect(screen.getAllByText('컨센서스').length).toBeGreaterThan(0);
        expect(
            screen.getByRole('button', { name: '추가 정보' })
        ).toBeInTheDocument();
        expect(screen.getByText('$2.01')).toBeInTheDocument();
        expect(screen.getByText('$1.95')).toBeInTheDocument();
        expect(screen.getByText('$111.2B')).toBeInTheDocument();
        expect(screen.getByText('$109.5B')).toBeInTheDocument();
    });

    it('과거 실적은 서프라이즈와 예상치 부합 뱃지를 표시하고 미래 실적에는 표시하지 않는다', () => {
        render(
            <EventCalendar
                earningsReports={[INLINE_ITEM, SURPRISE_ITEM, FUTURE_ITEM]}
            />
        );

        expect(screen.getByText(/서프라이즈/)).toBeInTheDocument();
        expect(screen.getByText(/예상치 부합/)).toBeInTheDocument();
        expect(screen.queryByText(/쇼크/)).not.toBeInTheDocument();
    });

    it('음수 EPS 막대는 음수 색상으로 구분한다', () => {
        render(<EventCalendar earningsReports={[NEGATIVE_EPS_ITEM]} />);

        const negativeBar = screen.getByLabelText('실제: -$0.50');
        expect(negativeBar).toHaveClass('bg-rose-400');
        expect(negativeBar).toHaveStyle({ right: '50%' });
        expect(negativeBar).not.toHaveStyle({ left: '50%' });
    });
});
