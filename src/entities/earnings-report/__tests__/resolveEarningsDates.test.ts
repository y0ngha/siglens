import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    DrizzleEarningsReportsRepository,
    EARNINGS_DATES_LOOKBACK_DAYS,
    listEarningsDates,
    listEarningsDatesAfterRefresh,
    resolveEarningsDates,
} from '@/entities/earnings-report/api';
import { MS_PER_DAY } from '@/shared/config/time';

const { mockGetEarningsReports } = vi.hoisted(() => ({
    mockGetEarningsReports: vi.fn(),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: () => ({
        getEarningsReports: mockGetEarningsReports,
    }),
}));
vi.mock('@/shared/lib/etTimeUtils', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/etTimeUtils')>()),
    // 호출 시각을 날짜 문자열로 그대로 드러내 조회 하한을 단언할 수 있게 한다.
    kstDateKey: (d: Date) => d.toISOString().slice(0, 10),
}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => null,
}));

const fakeDb = {} as SiglensDatabase;
const NOW = new Date('2026-10-18T12:00:00Z').getTime();

describe('listEarningsDates / resolveEarningsDates', () => {
    beforeEach(() => {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
        mockGetEarningsReports.mockReset();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('최근 2년 하한으로 DB의 발표일(과거·예정)을 그대로 돌려준다', async () => {
        const listSpy = vi
            .spyOn(DrizzleEarningsReportsRepository.prototype, 'listDatesSince')
            .mockResolvedValue(['2025-01-30', '2026-07-30', '2026-10-29']);

        const dates = await listEarningsDates('AAPL', fakeDb);

        expect(dates).toEqual(['2025-01-30', '2026-07-30', '2026-10-29']);
        const expectedFrom = new Date(
            NOW - EARNINGS_DATES_LOOKBACK_DAYS * MS_PER_DAY
        )
            .toISOString()
            .slice(0, 10);
        expect(listSpy).toHaveBeenCalledWith('AAPL', expectedFrom);
    });

    it('행이 없으면(크립토·KR 등 소스 없음) undefined — 빈 배열이 아니다', async () => {
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'listDatesSince'
        ).mockResolvedValue([]);

        expect(await listEarningsDates('BTCUSD', fakeDb)).toBeUndefined();
    });

    it('DB 조회가 실패하면 던지지 않고 warn 후 undefined', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'listDatesSince'
        ).mockRejectedValue(new Error('db down'));

        await expect(
            listEarningsDates('AAPL', fakeDb)
        ).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(
            '[listEarningsDates] lookup failed:',
            expect.any(Error)
        );
    });

    it('resolveEarningsDates: 갱신(getNextEarningsReport) 단계가 던져도 DB의 기존 날짜는 돌려준다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'getLatestFetchedAt'
        ).mockRejectedValue(new Error('db read failed'));
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'listDatesSince'
        ).mockResolvedValue(['2026-07-30']);

        await expect(resolveEarningsDates('AAPL', fakeDb)).resolves.toEqual([
            '2026-07-30',
        ]);
    });

    it('resolveEarningsDates: 어느 단계도 던지지 않고 전부 실패하면 undefined', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'getLatestFetchedAt'
        ).mockRejectedValue(new Error('x'));
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'listDatesSince'
        ).mockRejectedValue(new Error('y'));

        await expect(
            resolveEarningsDates('AAPL', fakeDb)
        ).resolves.toBeUndefined();
    });
});

describe('listEarningsDatesAfterRefresh', () => {
    beforeEach(() => {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('갱신이 끝난 뒤에야 DB를 읽는다(순서 보장)', async () => {
        const order: string[] = [];
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'listDatesSince'
        ).mockImplementation(async () => {
            order.push('read');
            return ['2026-07-30'];
        });
        const refresh = Promise.resolve().then(() => {
            order.push('refresh');
            return null;
        });

        await expect(
            listEarningsDatesAfterRefresh(refresh, 'AAPL', fakeDb)
        ).resolves.toEqual(['2026-07-30']);
        expect(order).toEqual(['refresh', 'read']);
    });

    it('갱신이 거부돼도 던지지 않고 undefined이며 DB는 읽지 않는다', async () => {
        const listSpy = vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'listDatesSince'
        );

        await expect(
            listEarningsDatesAfterRefresh(
                Promise.reject(new Error('fmp down')),
                'AAPL',
                fakeDb
            )
        ).resolves.toBeUndefined();
        expect(listSpy).not.toHaveBeenCalled();
    });
});
