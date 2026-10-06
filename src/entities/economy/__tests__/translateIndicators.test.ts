const mocks = vi.hoisted(() => ({
    revalidateTag: vi.fn(),
    runIndicatorTranslation: vi.fn(),
    isIndicatorTranslationPending: vi.fn(),
    markIndicatorTranslationPending: vi.fn(),
    upsert: vi.fn(),
    findByNames: vi.fn(),
    listInRange: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock('@y0ngha/siglens-core', () => ({
    runIndicatorTranslation: mocks.runIndicatorTranslation,
}));
vi.mock('@/entities/economy/api/indicatorTranslationFlag', () => ({
    isIndicatorTranslationPending: mocks.isIndicatorTranslationPending,
    markIndicatorTranslationPending: mocks.markIndicatorTranslationPending,
}));
vi.mock('@/entities/economy/api/indicatorTranslationRepository', () => ({
    DrizzleIndicatorTranslationRepository: class {
        upsert = mocks.upsert;
        findByNames = mocks.findByNames;
    },
}));
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listInRange = mocks.listInRange;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import {
    __resetIndicatorWhitelistCacheForTests,
    isTranslatableCalendarIndicator,
    MAX_INDICATOR_NAME_LENGTH,
    translateIndicator,
    translateUnresolvedCalendarIndicators,
    WHITELIST_PAST_PADDING_DAYS,
} from '@/entities/economy/api/translateIndicators';
import { INDICATOR_TRANSLATION_CACHE_TAG } from '@/entities/economy/lib/indicatorTranslationConstants';
import {
    addEtDays,
    futureWindowEnd,
    pastWindowStart,
    etDateOf,
} from '@/entities/economy/lib/calendarWindow';
import { MS_PER_MINUTE } from '@/shared/config/time';

const UNKNOWN = 'Totally Unknown Thing';

describe('translateIndicator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isIndicatorTranslationPending.mockResolvedValue(false);
        mocks.markIndicatorTranslationPending.mockResolvedValue(undefined);
        mocks.upsert.mockResolvedValue(undefined);
        mocks.runIndicatorTranslation.mockResolvedValue({
            status: 'done',
            nameKo: ' 번역 ',
        });
    });

    it('사전에 있으면 dictionary — 플래그도 core도 건드리지 않는다', async () => {
        await expect(translateIndicator('Nonfarm Payrolls', 't')).resolves.toBe(
            'dictionary'
        );
        expect(mocks.isIndicatorTranslationPending).not.toHaveBeenCalled();
        expect(mocks.runIndicatorTranslation).not.toHaveBeenCalled();
    });

    it('pending 플래그가 있으면 pending으로 단락한다', async () => {
        mocks.isIndicatorTranslationPending.mockResolvedValue(true);

        await expect(translateIndicator(UNKNOWN, 't')).resolves.toBe('pending');
        expect(mocks.markIndicatorTranslationPending).not.toHaveBeenCalled();
        expect(mocks.runIndicatorTranslation).not.toHaveBeenCalled();
    });

    it('번역되면 trim해서 source ai로 upsert하고 번역 태그를 턴다', async () => {
        await expect(translateIndicator(UNKNOWN, 't')).resolves.toBe(
            'translated'
        );

        expect(mocks.markIndicatorTranslationPending).toHaveBeenCalledWith(
            UNKNOWN
        );
        expect(mocks.upsert).toHaveBeenCalledWith({
            normalizedName: UNKNOWN,
            koreanName: '번역',
            source: 'ai',
        });
        expect(mocks.revalidateTag).toHaveBeenCalledWith(
            INDICATOR_TRANSLATION_CACHE_TAG,
            'max'
        );
    });

    it('cached 결과도 번역으로 취급한다', async () => {
        mocks.runIndicatorTranslation.mockResolvedValue({
            status: 'cached',
            nameKo: '캐시됨',
        });

        await expect(translateIndicator(UNKNOWN, 't')).resolves.toBe(
            'translated'
        );
    });

    it('빈 번역은 failed — 기록도 무효화도 없고 에러를 로그한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mocks.runIndicatorTranslation.mockResolvedValue({
            status: 'done',
            nameKo: '  ',
        });

        await expect(translateIndicator(UNKNOWN, 'lbl')).resolves.toBe(
            'failed'
        );
        expect(mocks.upsert).not.toHaveBeenCalled();
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            `[lbl] empty translation for "${UNKNOWN}"`
        );
        errorSpy.mockRestore();
    });

    it('core가 오류 상태면 failed — 조용히(로그 없이) 기록을 건너뛴다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mocks.runIndicatorTranslation.mockResolvedValue({ status: 'error' });

        await expect(translateIndicator(UNKNOWN, 't')).resolves.toBe('failed');
        expect(mocks.upsert).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});

describe('translateUnresolvedCalendarIndicators', () => {
    const ev = (event: string) => ({ event });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-20T12:00:00Z'));
        mocks.isIndicatorTranslationPending.mockResolvedValue(false);
        mocks.markIndicatorTranslationPending.mockResolvedValue(undefined);
        mocks.upsert.mockResolvedValue(undefined);
        mocks.findByNames.mockResolvedValue([]);
        mocks.listInRange.mockResolvedValue([]);
        mocks.runIndicatorTranslation.mockResolvedValue({
            status: 'done',
            nameKo: '번역',
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('페이지가 읽는 것과 같은 창(ET 앵커)·국가로 이벤트를 읽는다', async () => {
        await translateUnresolvedCalendarIndicators('KR', {
            limit: 3,
            logLabel: 't',
        });

        const anchor = etDateOf(new Date('2026-06-20T12:00:00Z'));
        expect(mocks.listInRange).toHaveBeenCalledWith(
            pastWindowStart(anchor),
            futureWindowEnd(anchor),
            'KR'
        );
    });

    it('이벤트가 없으면 0 — DB 번역 조회도 하지 않는다', async () => {
        await expect(
            translateUnresolvedCalendarIndicators('US', {
                limit: 3,
                logLabel: 't',
            })
        ).resolves.toBe(0);
        expect(mocks.findByNames).not.toHaveBeenCalled();
    });

    it('전부 사전에 있으면 0 — DB 조회도 번역도 하지 않는다', async () => {
        mocks.listInRange.mockResolvedValue([ev('Nonfarm Payrolls')]);

        await expect(
            translateUnresolvedCalendarIndicators('US', {
                limit: 3,
                logLabel: 't',
            })
        ).resolves.toBe(0);
        expect(mocks.findByNames).not.toHaveBeenCalled();
        expect(mocks.runIndicatorTranslation).not.toHaveBeenCalled();
    });

    it('사전과 DB에 이미 있는 이름은 거르고 base 단위로 중복 없이 번역한다', async () => {
        mocks.listInRange.mockResolvedValue([
            ev('Nonfarm Payrolls'),
            ev('Alpha Index (Apr)'),
            ev('Alpha Index (May)'),
            ev('Beta Index'),
            ev('Gamma Index'),
        ]);
        mocks.findByNames.mockResolvedValue([{ normalizedName: 'Beta Index' }]);

        const translated = await translateUnresolvedCalendarIndicators('US', {
            limit: 10,
            logLabel: 't',
        });

        expect(mocks.findByNames).toHaveBeenCalledWith([
            'Alpha Index',
            'Beta Index',
            'Gamma Index',
        ]);
        expect(mocks.runIndicatorTranslation.mock.calls.map(c => c[0])).toEqual(
            ['Alpha Index', 'Gamma Index']
        );
        expect(translated).toBe(2);
    });

    it('limit개까지만 번역한다', async () => {
        mocks.listInRange.mockResolvedValue([
            ev('Alpha Index'),
            ev('Beta Index'),
            ev('Gamma Index'),
        ]);

        const translated = await translateUnresolvedCalendarIndicators('US', {
            limit: 2,
            logLabel: 't',
        });

        expect(mocks.runIndicatorTranslation).toHaveBeenCalledTimes(2);
        expect(translated).toBe(2);
    });

    it('실제로 번역된 것만 센다 — failed·pending은 제외', async () => {
        mocks.listInRange.mockResolvedValue([
            ev('Alpha Index'),
            ev('Beta Index'),
        ]);
        mocks.isIndicatorTranslationPending.mockImplementation(
            async (name: string) => name === 'Alpha Index'
        );

        await expect(
            translateUnresolvedCalendarIndicators('US', {
                limit: 5,
                logLabel: 't',
            })
        ).resolves.toBe(1);
    });

    it('한 이름이 던져도 로그하고 나머지를 계속 번역한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mocks.listInRange.mockResolvedValue([
            ev('Alpha Index'),
            ev('Beta Index'),
        ]);
        mocks.runIndicatorTranslation
            .mockRejectedValueOnce(new Error('llm'))
            .mockResolvedValueOnce({ status: 'done', nameKo: '번역' });

        const translated = await translateUnresolvedCalendarIndicators('US', {
            limit: 5,
            logLabel: 'lbl',
        });

        expect(translated).toBe(1);
        expect(errorSpy).toHaveBeenCalledWith(
            '[lbl] translate failed: Alpha Index',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });
});

describe('isTranslatableCalendarIndicator (public action whitelist)', () => {
    const NOW = new Date('2026-10-06T15:00:00.000Z');
    const US_ONLY = 'US Only Index';
    const KR_ONLY = 'KR Only Index';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        __resetIndicatorWhitelistCacheForTests();
        mocks.listInRange.mockImplementation(
            async (_from: string, _to: string, country: string) =>
                country === 'US'
                    ? [{ event: `${US_ONLY} (Sep)` }]
                    : [{ event: `${KR_ONLY} (YoY)` }]
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        ['empty', ''],
        ['over the length cap', 'A'.repeat(MAX_INDICATOR_NAME_LENGTH + 1)],
    ])(
        'rejects a name that is %s without reading the calendar',
        async (_l, name) => {
            expect(await isTranslatableCalendarIndicator(name)).toBe(false);
            expect(mocks.listInRange).not.toHaveBeenCalled();
        }
    );

    it('accepts a name exactly at the length cap when it is on the calendar', async () => {
        const name = 'B'.repeat(MAX_INDICATOR_NAME_LENGTH);
        mocks.listInRange.mockResolvedValue([{ event: name }]);
        expect(await isTranslatableCalendarIndicator(name)).toBe(true);
    });

    it('rejects names already in the code dictionary (no translation needed)', async () => {
        expect(await isTranslatableCalendarIndicator('Nonfarm Payrolls')).toBe(
            false
        );
        expect(mocks.listInRange).not.toHaveBeenCalled();
    });

    it('accepts a base present in either country window (US ∪ KR)', async () => {
        expect(await isTranslatableCalendarIndicator(US_ONLY)).toBe(true);
        expect(await isTranslatableCalendarIndicator(KR_ONLY)).toBe(true);
        expect(
            await isTranslatableCalendarIndicator('Not On Any Calendar')
        ).toBe(false);
    });

    it('reads each country from the padded past start through the future window end', async () => {
        await isTranslatableCalendarIndicator(US_ONLY);

        const anchor = etDateOf(NOW);
        const from = addEtDays(
            pastWindowStart(anchor),
            -WHITELIST_PAST_PADDING_DAYS
        );
        expect(mocks.listInRange).toHaveBeenCalledWith(
            from,
            futureWindowEnd(anchor),
            'US'
        );
        expect(mocks.listInRange).toHaveBeenCalledWith(
            from,
            futureWindowEnd(anchor),
            'KR'
        );
        // 서버 창보다 정확히 패딩 일수만큼 이르다 — 묵은 화면의 창을 덮는다.
        expect(from).toBe(
            addEtDays(pastWindowStart(anchor), -WHITELIST_PAST_PADDING_DAYS)
        );
        expect(from < pastWindowStart(anchor)).toBe(true);
    });

    it('serves repeated checks from the 5-minute cache without a second DB read', async () => {
        await isTranslatableCalendarIndicator(US_ONLY);
        await isTranslatableCalendarIndicator('Not On Any Calendar');
        expect(mocks.listInRange).toHaveBeenCalledTimes(2); // US + KR once

        vi.setSystemTime(new Date(NOW.getTime() + 4 * MS_PER_MINUTE));
        await isTranslatableCalendarIndicator(KR_ONLY);
        expect(mocks.listInRange).toHaveBeenCalledTimes(2);

        vi.setSystemTime(new Date(NOW.getTime() + 6 * MS_PER_MINUTE));
        await isTranslatableCalendarIndicator(KR_ONLY);
        expect(mocks.listInRange).toHaveBeenCalledTimes(4);
    });
});
