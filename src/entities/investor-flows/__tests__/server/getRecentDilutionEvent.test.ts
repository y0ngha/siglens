import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockIsE2E,
    mockTryGetDatabaseClient,
    mockFindOfferings,
    mockGetSnapshot,
    mockStaticSymbolCache,
} = vi.hoisted(() => ({
    mockIsE2E: vi.fn(() => false),
    mockTryGetDatabaseClient: vi.fn(),
    mockFindOfferings: vi.fn(),
    mockGetSnapshot: vi.fn(),
    // 캐시는 투명하게 통과시키고 인자(키·태그·TTL)만 기록한다.
    mockStaticSymbolCache: vi.fn(
        (
            _keyParts: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>,
            _extraTags?: readonly string[],
            _revalidateSeconds?: number
        ) => fetcher()
    ),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockIsE2E }));
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: mockTryGetDatabaseClient,
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockStaticSymbolCache,
}));
vi.mock('../../api/investorFlowsFilingsRepository', () => ({
    DrizzleSecFilingsRepository: class {
        findOfferings = mockFindOfferings;
    },
}));
vi.mock('../../server/getInvestorFlowsDataProvider', () => ({
    getInvestorFlowsDataProvider: () => ({
        getInvestorFlowsSnapshot: mockGetSnapshot,
    }),
}));

import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { addDays } from '../../lib/investorFlowsDates';
import {
    DILUTION_BADGE_FETCH_LIMIT,
    DILUTION_BADGE_LOOKBACK_DAYS,
} from '../../lib/recentDilutionEvent';
import {
    getRecentDilutionEvent,
    loadRecentDilutionEvent,
} from '../../server/getRecentDilutionEvent';

const today = (): string => toUtcIsoDate(new Date());

describe('loadRecentDilutionEvent', () => {
    it('오늘 기준 90일 창의 시작일과 상한으로 읽고, 최신 공급 공시 하나로 줄인다', async () => {
        const readOfferings = vi.fn().mockResolvedValue([
            { kind: 'shelf', filingDate: '2026-10-15' },
            { kind: 'atm', filingDate: '2026-10-09' },
            { kind: 'underwritten', filingDate: '2026-09-25' },
        ]);
        const result = await loadRecentDilutionEvent('AAPL', {
            readOfferings,
            now: () => new Date('2026-10-16T03:00:00Z'),
        });
        expect(readOfferings).toHaveBeenCalledWith(
            'AAPL',
            addDays('2026-10-16', -DILUTION_BADGE_LOOKBACK_DAYS),
            DILUTION_BADGE_FETCH_LIMIT
        );
        expect(result).toEqual({ kind: 'atm', filingDate: '2026-10-09' });
    });

    it('읽기 실패는 그대로 던진다(캐시 안에서 삼키면 실패가 TTL 동안 남는다)', async () => {
        await expect(
            loadRecentDilutionEvent('AAPL', {
                readOfferings: () => Promise.reject(new Error('db down')),
                now: () => new Date(),
            })
        ).rejects.toThrow('db down');
    });
});

describe('getRecentDilutionEvent', () => {
    beforeEach(() => {
        mockIsE2E.mockReturnValue(false);
        mockTryGetDatabaseClient.mockReturnValue({ db: {} });
        mockFindOfferings.mockReset();
        mockGetSnapshot.mockReset();
    });

    it('DB 저장소를 대문자 심볼로 읽고, 12h·수급 태그로 캐시한다', async () => {
        mockFindOfferings.mockResolvedValue([
            { kind: 'best_efforts', filingDate: addDays(today(), -3) },
        ]);
        const result = await getRecentDilutionEvent('nvda');
        expect(result).toEqual({
            kind: 'priced',
            filingDate: addDays(today(), -3),
        });
        expect(mockFindOfferings).toHaveBeenCalledWith(
            'NVDA',
            addDays(today(), -DILUTION_BADGE_LOOKBACK_DAYS),
            DILUTION_BADGE_FETCH_LIMIT
        );
        const call = mockStaticSymbolCache.mock.calls.find(
            ([, symbol]) => symbol === 'NVDA'
        );
        expect(call?.[0]).toEqual(['investor-flows:dilution-badge-v1', 'NVDA']);
        expect(call?.[3]).toEqual(['investor-flows:NVDA']);
        expect(call?.[4]).toBe(SECONDS_PER_HALF_DAY);
    });

    it('용량 공시만 있으면 null(배지 없음)', async () => {
        mockFindOfferings.mockResolvedValue([
            { kind: 'shelf', filingDate: addDays(today(), -1) },
        ]);
        expect(await getRecentDilutionEvent('MSFT')).toBeNull();
    });

    it('DB 장애는 null로 degrade하고 한 번만 로그를 남긴다', async () => {
        const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockFindOfferings.mockRejectedValue(new Error('db down'));
        expect(await getRecentDilutionEvent('TSLA')).toBeNull();
        expect(error).toHaveBeenCalledTimes(1);
        error.mockRestore();
    });

    it('DB 클라이언트가 없어도 null로 degrade한다', async () => {
        const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockTryGetDatabaseClient.mockReturnValue(null);
        expect(await getRecentDilutionEvent('AMD')).toBeNull();
        expect(mockFindOfferings).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledTimes(1);
        error.mockRestore();
    });

    it('정적 생성 제어 흐름 오류(DYNAMIC_SERVER_USAGE)는 다시 던진다', async () => {
        mockFindOfferings.mockRejectedValue(
            Object.assign(new Error('Dynamic server usage'), {
                digest: 'DYNAMIC_SERVER_USAGE',
            })
        );
        await expect(getRecentDilutionEvent('META')).rejects.toThrow(
            'Dynamic server usage'
        );
    });

    it('E2E에서는 DB 대신 가짜 수급 스냅샷의 증자 공시를 읽는다', async () => {
        mockIsE2E.mockReturnValue(true);
        mockGetSnapshot.mockResolvedValue({
            offerings: [
                {
                    filingDate: addDays(today(), -12),
                    form: '424B5',
                    kind: 'atm',
                    url: 'https://www.sec.gov/x',
                },
            ],
        });
        expect(await getRecentDilutionEvent('AAPL')).toEqual({
            kind: 'atm',
            filingDate: addDays(today(), -12),
        });
        expect(mockFindOfferings).not.toHaveBeenCalled();
    });

    it('E2E 스냅샷이 없으면(EMPTYX) null', async () => {
        mockIsE2E.mockReturnValue(true);
        mockGetSnapshot.mockResolvedValue(null);
        expect(await getRecentDilutionEvent('EMPTYX')).toBeNull();
    });
});
