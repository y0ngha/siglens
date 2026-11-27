import { render, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { EventCalendar } from '@/widgets/news/sections/EventCalendar';
import type { EarningsCardItem } from '@/widgets/news/utils/withNextEarnings';

const SURPRISE_ITEM: EarningsCardItem = {
    symbol: 'AAPL',
    earningsDate: '2026-04-30',
    epsActual: 2.01,
    epsEstimated: 1.95,
    revenueActual: 111_184_000_000,
    revenueEstimated: 109_457_600_000,
    lastUpdated: '2026-05-10',
    period: 'past',
    slot: 'past-1',
    confirmed: null,
    session: null,
};

const INLINE_ITEM: EarningsCardItem = {
    ...SURPRISE_ITEM,
    earningsDate: '2026-01-29',
    epsActual: 2,
    epsEstimated: 1.99,
    revenueActual: 143_756_000_000,
    revenueEstimated: 138_391_000_000,
    slot: 'past-2',
};

const FUTURE_ITEM: EarningsCardItem = {
    ...SURPRISE_ITEM,
    earningsDate: '2026-07-30',
    epsActual: null,
    epsEstimated: 1.86,
    revenueActual: null,
    revenueEstimated: 107_618_800_000,
    period: 'future',
    slot: 'recent-or-future',
};

const NEGATIVE_EPS_ITEM: EarningsCardItem = {
    ...SURPRISE_ITEM,
    epsActual: -0.5,
    epsEstimated: -0.4,
};

const KR_ITEM: EarningsCardItem = {
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

    it('확정된 다음 실적은 "확정" 배지와 발표 시간대를, 확정이 아니면 "예정"만 보인다', () => {
        const { unmount } = render(
            <EventCalendar
                earningsReports={[
                    {
                        ...FUTURE_ITEM,
                        confirmed: true,
                        session: 'after_market',
                    },
                ]}
            />
        );
        expect(screen.getByText('확정')).toBeInTheDocument();
        expect(screen.getByText('장 마감 후')).toBeInTheDocument();
        // 날짜 위의 "예정"(다가오는 실적) 라벨만 남고, 배지는 "확정"으로 바뀐다.
        expect(screen.getAllByText('예정')).toHaveLength(1);
        unmount();

        render(
            <EventCalendar
                earningsReports={[{ ...FUTURE_ITEM, confirmed: false }]}
            />
        );
        expect(screen.queryByText('확정')).toBeNull();
        expect(screen.getAllByText('예정')).toHaveLength(2);
        expect(screen.queryByText('장 마감 후')).toBeNull();
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

    it('실제치가 정확히 0이면 막대를 그리지 않는다(폭 0)', () => {
        render(
            <EventCalendar
                earningsReports={[
                    { ...SURPRISE_ITEM, epsActual: 0, epsEstimated: 1.5 },
                ]}
            />
        );

        const zeroBar = screen.getByLabelText('실제: $0.00');
        expect(zeroBar).toHaveStyle({ width: '0%' });
    });
});
