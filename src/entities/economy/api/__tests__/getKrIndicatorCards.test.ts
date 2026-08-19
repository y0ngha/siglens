vi.mock('server-only', () => ({}));

/**
 * `unstable_cache`의 keyParts·options를 캡처한다. 그냥 call-through로 두면
 * ISR 태그가 잘못돼도(예: KR 카드가 미국 태그를 달아 KR 인제스션의
 * `revalidateTag`가 아무것도 못 맞추는 경우) 테스트가 전부 통과한다.
 */
let capturedKeyParts: string[] = [];
let capturedOptions: Record<string, unknown> = {};
vi.mock('next/cache', () => ({
    unstable_cache:
        (
            fn: (...args: unknown[]) => unknown,
            keyParts: string[],
            options: Record<string, unknown>
        ) =>
        (...args: unknown[]) => {
            capturedKeyParts = keyParts;
            capturedOptions = options;
            return fn(...args);
        },
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

import { getKrIndicatorCards } from '../getKrIndicatorCards';
import { ECONOMY_CALENDAR_REVALIDATE_SECONDS } from '../../lib/economyCalendarConstants';

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

    /**
     * 태그가 KR이 아니면 KR 인제스션의 `revalidateTag('economy:calendar:kr')`이
     * 카드 캐시를 못 맞춘다 — 아래 캘린더는 새 발표를 보여주는데 위 카드만
     * 24시간 낡은 값으로 남는다.
     */
    it('KR 캘린더 태그와 revalidate를 unstable_cache에 넘긴다', async () => {
        listAnnouncedSince.mockResolvedValue([]);

        await getKrIndicatorCards(ANCHOR);

        expect(capturedKeyParts).toEqual(['economy-kr-indicator-cards']);
        expect(capturedOptions).toMatchObject({
            revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
            tags: ['economy:calendar:kr'],
        });
    });
});
