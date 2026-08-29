import { render, screen } from '@testing-library/react';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';
import { EventCalendar } from '@/widgets/news/sections/EventCalendar';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

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

const KR_ITEM: EarningsReportComparisonItem = {
    ...SURPRISE_ITEM,
    symbol: '005930.KS',
    epsActual: 1_800,
    epsEstimated: 1_700,
    revenueActual: 75_000_000_000_000,
    revenueEstimated: 70_000_000_000_000,
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
        expect(screen.getByText('US$1111.8억')).toBeInTheDocument();
        expect(screen.getByText('US$1094.6억')).toBeInTheDocument();
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
        expect(negativeBar).toHaveClass('bg-ui-danger');
        expect(negativeBar).toHaveStyle({ right: '50%' });
        expect(negativeBar).not.toHaveStyle({ left: '50%' });
    });

    it('국내 종목은 US$ 대신 원화로 표기한다', () => {
        render(<EventCalendar earningsReports={[KR_ITEM]} />);

        expect(screen.getByText('₩1,800')).toBeInTheDocument();
        expect(screen.getByText('₩1,700')).toBeInTheDocument();
        expect(screen.getByText('₩75조')).toBeInTheDocument();
        expect(screen.getByText('₩70조')).toBeInTheDocument();
        expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
    });

    // 회귀 가드: 실적일 포맷터가 `'ko-KR'` 고정으로 돌아오면 `/en/AAPL/news`가
    // "Announced 4월 30일" 같은 한국어 날짜를 영어 문장 옆에 다시 박는다.
    it('locale=en에서는 실적일에 한글이 섞이지 않는다', () => {
        const { container } = renderWithIntl(
            <EventCalendar earningsReports={[SURPRISE_ITEM, FUTURE_ITEM]} />,
            { locale: 'en' }
        );
        const dates = container.querySelectorAll('time');
        expect(dates.length).toBeGreaterThan(0);
        dates.forEach(time => {
            expect(time.textContent ?? '').not.toMatch(/[가-힣]/);
        });
    });
});
