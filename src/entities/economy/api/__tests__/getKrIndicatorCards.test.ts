vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const listAnnouncedSince = vi.fn();
vi.mock('../economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: vi.fn(function () {
        return { listAnnouncedSince };
    }),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import {
    getKrIndicatorCards,
    KR_TREND_MAX_POINTS,
    KR_TREND_MIN_POINTS,
} from '../getKrIndicatorCards';

const ANCHOR = '2026-08-19';

/** `n`개의 `Inflation Rate YoY` 발표 이력(오래된 → 최신). */
function inflationHistory(values: number[]) {
    return values.map((actual, i) => ({
        dateEt: `2026-0${1 + i}-03 00:00:00`,
        event: `Inflation Rate YoY (Mon${i})`,
        actual,
        previous: null as number | null,
        unit: '%',
    }));
}

describe('getKrIndicatorCards', () => {
    beforeEach(() => {
        listAnnouncedSince.mockReset();
    });

    it('projects the latest announcement of each registered indicator', async () => {
        listAnnouncedSince.mockResolvedValue(inflationHistory([3.2, 2.8]));

        const cards = await getKrIndicatorCards(ANCHOR);

        expect(cards).toHaveLength(1);
        expect(cards[0].meta.event).toBe('Inflation Rate YoY');
        expect(cards[0].latest).toBe(2.8);
        expect(cards[0].latestDate).toBe('2026-02-03');
    });

    it('computes the change from our own history, not the FMP previous field', async () => {
        // 개정치가 반영되면 두 값이 갈린다 — 화면에 함께 그리는 추세와 어긋나지
        // 않으려면 같은 출처를 써야 한다.
        const rows = inflationHistory([3.2, 2.8]);
        rows[1].previous = 99;
        listAnnouncedSince.mockResolvedValue(rows);

        const [card] = await getKrIndicatorCards(ANCHOR);
        expect(card.changeFromPrevious).toBeCloseTo(-0.4, 10);
    });

    it('leaves the change null when there is only one announcement', async () => {
        listAnnouncedSince.mockResolvedValue(inflationHistory([2.8]));

        const [card] = await getKrIndicatorCards(ANCHOR);
        expect(card.changeFromPrevious).toBeNull();
    });

    it('hides the trend until it has enough points', async () => {
        // 2점짜리 "추세"는 선분 하나라 정보가 없고, 데이터가 충분하다는 인상만 준다.
        listAnnouncedSince.mockResolvedValue(
            inflationHistory(
                Array.from({ length: KR_TREND_MIN_POINTS - 1 }, () => 2.8)
            )
        );

        const [card] = await getKrIndicatorCards(ANCHOR);
        expect(card.trend).toEqual([]);
    });

    it('caps the trend length', async () => {
        listAnnouncedSince.mockResolvedValue(
            inflationHistory(
                Array.from({ length: KR_TREND_MAX_POINTS + 5 }, (_, i) => i)
            )
        );

        const [card] = await getKrIndicatorCards(ANCHOR);
        expect(card.trend).toHaveLength(KR_TREND_MAX_POINTS);
        // 최신 쪽을 남긴다.
        expect(card.trend.at(-1)).toBe(KR_TREND_MAX_POINTS + 4);
    });

    it('omits indicators that have no announcements yet', async () => {
        listAnnouncedSince.mockResolvedValue([]);

        expect(await getKrIndicatorCards(ANCHOR)).toEqual([]);
    });

    it('ignores events that are not in the registry', async () => {
        listAnnouncedSince.mockResolvedValue([
            {
                dateEt: '2026-08-14 00:00:00',
                event: 'Thomson Reuters IPSOS PCSI (Aug)',
                actual: 44.52,
                previous: null,
                unit: '',
            },
        ]);

        expect(await getKrIndicatorCards(ANCHOR)).toEqual([]);
    });

    it('reads only KR rows', async () => {
        listAnnouncedSince.mockResolvedValue([]);

        await getKrIndicatorCards(ANCHOR);

        expect(listAnnouncedSince).toHaveBeenCalledWith(
            'KR',
            expect.any(String)
        );
    });

    it('degrades to an empty list when the DB read fails', async () => {
        // 지표 섹션만 비고 페이지는 렌더돼야 한다 — throw하면 ISR에 0-byte가 굳는다.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        listAnnouncedSince.mockRejectedValue(new Error('neon down'));

        expect(await getKrIndicatorCards(ANCHOR)).toEqual([]);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
