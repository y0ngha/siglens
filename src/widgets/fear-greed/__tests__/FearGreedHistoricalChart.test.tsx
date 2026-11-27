import { render } from '@testing-library/react';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { FEAR_GREED_SESSIONS_PER_YEAR } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';
import { MS_PER_DAY } from '@/shared/config/time';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import { FEAR_GREED_CHART_HEIGHT } from '@/widgets/fear-greed/constants';
import { FearGreedHistoricalChart } from '@/widgets/fear-greed/FearGreedHistoricalChart';

// lightweight-charts uses canvas internally — jsdom can't run it, so we mock.
const {
    mockSetData,
    mockFitContent,
    mockAddSeries,
    mockRemove,
    mockApplyOptions,
    mockChart,
} = vi.hoisted(() => {
    const mockSetData = vi.fn();
    const mockFitContent = vi.fn();
    const mockAddSeries = vi.fn(() => ({ setData: mockSetData }));
    const mockRemove = vi.fn();
    const mockApplyOptions = vi.fn();
    const mockChart = {
        addSeries: mockAddSeries,
        timeScale: () => ({ fitContent: mockFitContent }),
        remove: mockRemove,
        applyOptions: mockApplyOptions,
    };
    return {
        mockSetData,
        mockFitContent,
        mockAddSeries,
        mockRemove,
        mockApplyOptions,
        mockChart,
    };
});

// `virtual: true` is required because lightweight-charts is ESM-only
// (`"type": "module"`, no CJS export). Jest's CJS resolver can't find it
// from this test file, even though we never call the real module.
const mockLocale = vi.hoisted(() => ({
    value: 'ko' as 'ko' | 'en' | 'ja' | 'zh',
}));
vi.mock('@/shared/i18n/useResolvedLocale', () => ({
    useResolvedLocale: () => mockLocale.value,
}));

vi.mock('lightweight-charts', () => ({
    createChart: vi.fn(() => mockChart),
    LineSeries: 'LineSeries',
    // 실제 enum 값과 같게 둔다(Year 0, Month 1, DayOfMonth 2, Time 3, TimeWithSeconds 4).
    TickMarkType: {
        Year: 0,
        Month: 1,
        DayOfMonth: 2,
        Time: 3,
        TimeWithSeconds: 4,
    },
}));

const history: FearGreedHistoryPoint[] = [
    { date: '2026-01-01', score: null, label: null },
    { date: '2026-01-02', score: null, label: null },
    { date: '2026-01-03', score: 50, label: 'NEUTRAL' },
    { date: '2026-01-04', score: 60, label: 'GREED' },
];

describe('FearGreedHistoricalChart', () => {
    beforeEach(() => {
        mockSetData.mockClear();
        mockFitContent.mockClear();
        mockAddSeries.mockClear();
        mockRemove.mockClear();
        mockApplyOptions.mockClear();
        // 로케일을 바꾸는 테스트가 단언 도중 실패해도 다음 테스트에 새지 않게 매번 되돌린다.
        mockLocale.value = 'ko';
    });

    const lastChartOptions = async () => {
        const { createChart } = await import('lightweight-charts');
        return vi.mocked(createChart).mock.calls.at(-1)?.[1] as {
            localization: { locale: string };
            handleScale: boolean;
            timeScale: {
                tickMarkFormatter: (t: unknown, type: number) => string | null;
            };
        };
    };

    it('일(day) 눈금만 지우고 월·연 눈금은 기본 포맷에 맡긴다', async () => {
        const { TickMarkType } = await import('lightweight-charts');
        render(<FearGreedHistoricalChart history={history} />);
        const fmt = (await lastChartOptions()).timeScale.tickMarkFormatter;
        expect(fmt('2026-10-05', TickMarkType.DayOfMonth)).toBe('');
        expect(fmt('2026-10-01', TickMarkType.Month)).toBeNull();
        expect(fmt('2026-01-01', TickMarkType.Year)).toBeNull();
    });

    it('일 눈금을 지우는 전제대로 확대를 막는다', async () => {
        render(<FearGreedHistoricalChart history={history} />);
        expect((await lastChartOptions()).handleScale).toBe(false);
    });

    it('눈금 언어는 브라우저가 아니라 페이지 로케일(INTL_LOCALE)이다', async () => {
        mockLocale.value = 'ja';
        render(<FearGreedHistoricalChart history={history} />);
        expect((await lastChartOptions()).localization.locale).toBe(
            INTL_LOCALE.ja
        );
    });

    it('creates a line series and sets data filtered to non-null scores', () => {
        render(<FearGreedHistoricalChart history={history} />);
        expect(mockAddSeries).toHaveBeenCalledTimes(1);
        // Warm-up entries (score === null) are filtered out — only 2 valid points sent
        expect(mockSetData).toHaveBeenCalledWith([
            { time: '2026-01-03', value: 50 },
            { time: '2026-01-04', value: 60 },
        ]);
    });

    /**
     * 서버는 "1년 전" 게이지 때문에 약 2년(504점)을 보낸다. 제목이 "최근 1년"이므로
     * 차트는 마지막 252점만 그려야 한다 — 앞쪽 1년이 섞이면 x축이 2년으로 늘어난다.
     */
    it('plots only the last FEAR_GREED_SESSIONS_PER_YEAR points of a 2-year history', () => {
        const start = Date.UTC(2024, 0, 1);
        const twoYears: FearGreedHistoryPoint[] = Array.from(
            { length: 504 },
            (_, i) => ({
                date: new Date(start + i * MS_PER_DAY)
                    .toISOString()
                    .slice(0, 10),
                score: 50,
                label: 'NEUTRAL',
            })
        );
        render(<FearGreedHistoricalChart history={twoYears} />);
        const data = mockSetData.mock.calls.at(-1)?.[0] as {
            time: string;
        }[];
        expect(data).toHaveLength(FEAR_GREED_SESSIONS_PER_YEAR);
        expect(data[0].time).toBe(
            twoYears[504 - FEAR_GREED_SESSIONS_PER_YEAR].date
        );
        expect(data.at(-1)?.time).toBe(twoYears[503].date);
    });

    /**
     * fear/greed 점수는 늘 0~100 범위다 — 실데이터가 좁은 구간(예: 40~60)에
     * 몰려도 y축이 그 구간으로 확대되면 안 된다. `autoscaleInfoProvider`가
     * 항상 고정 범위를 돌려주는지 콜백 자체를 실행해 검증한다.
     */
    it('pins the y-axis autoscale range to 0-100 regardless of data', () => {
        render(<FearGreedHistoricalChart history={history} />);

        const call = mockAddSeries.mock.calls[0] as unknown as [
            unknown,
            {
                autoscaleInfoProvider: () => {
                    priceRange: { minValue: number; maxValue: number };
                };
            },
        ];
        const options = call[1];
        expect(options.autoscaleInfoProvider()).toEqual({
            priceRange: { minValue: 0, maxValue: 100 },
            margins: { above: 0.1, below: 0.1 },
        });
    });

    /** 차트가 붙기 전에도 컨테이너가 차트와 같은 높이를 잡아야 도착할 때 아래가 밀리지 않는다. */
    it('컨테이너 높이를 차트 생성 옵션과 같은 상수로 미리 잡는다', () => {
        const { container } = render(
            <FearGreedHistoricalChart history={history} />
        );
        const box = container.querySelector<HTMLDivElement>('[role="img"]');
        expect(box?.style.height).toBe(`${FEAR_GREED_CHART_HEIGHT}px`);
    });

    /**
     * 접근성 이름의 기간은 차트가 실제로 그리는 점에서 정한다. 252점은 주식에서 1년이지만
     * 매일 거래하는 암호화폐에서는 약 8개월이라 "최근 1년"이면 틀린다.
     */
    describe('접근성 이름의 기간', () => {
        const dailySeries = (count: number, stepDays: number) =>
            Array.from({ length: count }, (_, i) => ({
                date: new Date(Date.UTC(2025, 0, 1) + i * stepDays * MS_PER_DAY)
                    .toISOString()
                    .slice(0, 10),
                score: 50,
                label: 'NEUTRAL' as const,
            }));

        it('1년에 걸친 주식 기록은 "최근 1년"이다', () => {
            // 252세션이 365일에 걸치도록 5/7 비율로 달력일을 늘린다.
            const stock = Array.from(
                { length: FEAR_GREED_SESSIONS_PER_YEAR },
                (_, i) => ({
                    date: new Date(
                        Date.UTC(2025, 0, 1) +
                            Math.round((i * 7) / 5) * MS_PER_DAY
                    )
                        .toISOString()
                        .slice(0, 10),
                    score: 50,
                    label: 'NEUTRAL' as const,
                })
            );
            const { container } = render(
                <FearGreedHistoricalChart history={stock} />
            );
            expect(container.querySelector('[role="img"]')).toHaveAttribute(
                'aria-label',
                '최근 1년 공포 탐욕 지수 추이 차트'
            );
        });

        it('매일 쌓이는 암호화폐 252점은 "최근 8개월"이다', () => {
            const crypto = dailySeries(FEAR_GREED_SESSIONS_PER_YEAR, 1);
            const { container } = render(
                <FearGreedHistoricalChart history={crypto} />
            );
            expect(container.querySelector('[role="img"]')).toHaveAttribute(
                'aria-label',
                '최근 8개월 공포 탐욕 지수 추이 차트'
            );
        });
    });

    it('fits the time scale after setting data', () => {
        render(<FearGreedHistoricalChart history={history} />);
        expect(mockFitContent).toHaveBeenCalled();
    });

    it('removes the chart on unmount', () => {
        const { unmount } = render(
            <FearGreedHistoricalChart history={history} />
        );
        unmount();
        expect(mockRemove).toHaveBeenCalled();
    });
});
