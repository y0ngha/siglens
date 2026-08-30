/**
 * 2026-08-30 인시던트 회귀 가드 — "만들 수 없는 탭 하나가 심볼을 영구 stale로
 * 만든다".
 *
 * ## 무엇이 있었나
 *
 * `staleSymbols`는 "탭 하나라도 fresh가 아니면 그 심볼은 stale"이고,
 * `resolveHarvest`는 `cached`/`done`일 때만 스냅샷 행을 쓴다. 의회 거래가 없는
 * 종목의 `congress`는 `no_trades`로 끝나 **행이 영원히 안 생긴다** — 즉
 * `generatedAtMap`에 키가 없어 영구히 not-fresh이고, 그 심볼은 영구 stale이다.
 *
 * 프로덕션 실측: `staleTotal`이 113에 고정된 채 `harvested: 0`이 8시간 이어졌다.
 * 그 113개는 나머지 6탭이 하루 전 생성돼 멀쩡한데도 매 회전마다 배치 슬롯을
 * 소진했고, starvation watch는 `ALAB(never)`처럼 실제로는 6행이 있는 종목을
 * 미도달로 지목했다.
 *
 * ## 왜 `../lock`을 mock하지 않나
 *
 * 이 결함은 "판정 술어"에 있으므로 lock을 통째로 stub하면 검증이 무의미해진다.
 * 진짜 `lock.ts`를 로드하고 그 아래 Redis만 in-memory SET으로 대체해,
 * `SMEMBERS → stale 판정 → 배치 선별`까지 실제 경로를 통과시킨다.
 */
const {
    mockRedisGet,
    mockRedisIncrby,
    mockUpsert,
    mockFindGeneratedAtMap,
    mockGetAssetInfoResilient,
    mockGetFmpErrorStatus,
    mockPrewarmTechnical,
    mockPrewarmCongress,
    mockBuildPrewarmUniverse,
    structuralSet,
} = vi.hoisted(() => ({
    mockRedisGet: vi.fn(),
    mockRedisIncrby: vi.fn(),
    mockUpsert: vi.fn(),
    mockFindGeneratedAtMap: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    mockGetFmpErrorStatus: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmCongress: vi.fn(),
    mockBuildPrewarmUniverse: vi.fn(),
    structuralSet: new Set<string>(),
}));

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => ({
        get: mockRedisGet,
        set: vi.fn(),
        del: vi.fn(),
        eval: vi.fn(),
        incrby: mockRedisIncrby,
        expire: vi.fn(),
        sadd: async (_key: string, member: string) => {
            structuralSet.add(member);
        },
        srem: async (_key: string, member: string) => {
            structuralSet.delete(member);
        },
        smembers: async () => [...structuralSet],
    }),
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: vi.fn().mockImplementation(function () {
        return {
            upsert: mockUpsert,
            findGeneratedAtMap: mockFindGeneratedAtMap,
        };
    }),
}));

vi.mock('@/entities/seo-snapshot/lib/applicability', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/entities/seo-snapshot/lib/applicability')
    >()),
    buildPrewarmUniverse: mockBuildPrewarmUniverse,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {}, sql: {} }),
}));

vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
}));

vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpErrorStatus: mockGetFmpErrorStatus,
    translateFmpError: vi.fn().mockReturnValue(null),
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: vi.fn(),
    prewarmFundamental: vi.fn(),
    prewarmFinancials: vi.fn(),
    prewarmCongress: mockPrewarmCongress,
    prewarmPollTechnical: vi.fn(),
    prewarmPollOverall: vi.fn(),
    prewarmPollFundamental: vi.fn(),
    prewarmPollFinancials: vi.fn(),
    prewarmPollCongress: vi.fn(),
}));

vi.mock('@/entities/news-article/api', () => ({
    prewarmNews: vi.fn(),
    prewarmPollNews: vi.fn(),
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: vi.fn(),
    prewarmPollOptions: vi.fn(),
}));

import { lastCompletedEtCloseWithBuffer } from '@/entities/seo-snapshot/lib/freshness';
import { runPrewarmBatch } from '../runPrewarmBatch';

const FIXED_NOW = new Date('2026-07-25T13:00:00.000Z');
const BOUNDARY = lastCompletedEtCloseWithBuffer(FIXED_NOW);
/** boundary 이후 = fresh로 판정되는 생성 시각. */
const FRESH_AT = new Date(BOUNDARY.getTime() + 60_000);

describe('구조적 불가 탭이 심볼을 영구 stale로 만들지 않는다', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        structuralSet.clear();
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);

        mockGetFmpErrorStatus.mockReturnValue(null);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'X', name: 'X Inc.', fmpSymbol: undefined },
            degraded: false,
        });
        mockRedisGet.mockResolvedValue(null);

        const counters = new Map<string, number>();
        mockRedisIncrby.mockImplementation(
            async (key: string, step: number) => {
                const next = (counters.get(key) ?? 0) + step;
                counters.set(key, next);
                return next;
            }
        );

        // technical은 fresh, congress는 행이 없다 — 실측된 그 모양이다.
        mockBuildPrewarmUniverse.mockReturnValue([
            { symbol: 'ALAB', tabs: ['technical', 'congress'] },
        ]);
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([['ALAB:technical', FRESH_AT]])
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('확정 전에는 stale로 잡힌다(결함 재현)', async () => {
        const counts = await runPrewarmBatch();
        expect(counts.staleTotal).toBe(1);
    });

    it('congress가 구조적 불가로 확정되면 stale에서 빠진다', async () => {
        structuralSet.add('ALAB:congress');

        const counts = await runPrewarmBatch();

        // 유일하게 미완성이던 탭이 "만들 수 없음"으로 확정됐으므로 이 심볼은 더
        // 이상 처리 대상이 아니다. 확정이 stale 판정까지 닿지 않으면 이 값은
        // 1로 남고, 그게 프로덕션에서 113으로 굳어 있던 수치다.
        expect(counts.staleTotal).toBe(0);
        // 슬롯을 소비하지 않았으므로 seam도 안 불린다.
        expect(mockPrewarmCongress).not.toHaveBeenCalled();
    });

    it('확정은 그 심볼의 다른 탭까지 가리지는 않는다', async () => {
        structuralSet.add('ALAB:congress');
        // technical을 stale로 되돌린다 — 이 탭은 여전히 처리돼야 한다.
        mockFindGeneratedAtMap.mockResolvedValue(new Map());

        const counts = await runPrewarmBatch();

        expect(counts.staleTotal).toBe(1);
    });

    /**
     * starvation watch는 "탭 하나라도 생성된 적 없으면 심볼 전체를 never"로 찍는다.
     * 만들 수 없는 탭을 빼지 않으면 6탭이 멀쩡한 종목이 `ALAB(never)`로 지목되고,
     * 이 워치가 잡으려던 **진짜** 미도달 심볼이 그 잡음에 묻힌다 — 프로덕션에서
     * 실제로 그 상태였다. `staleTotal`만 보는 위 테스트들은 이 경로를 안 지난다.
     */
    it('확정된 탭 때문에 거짓 never 경보를 내지 않는다', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // technical은 오래전 생성(=stale이지만 never는 아님), congress는 행 없음.
        const LONG_AGO = new Date(FIXED_NOW.getTime() - 72 * 60 * 60 * 1000);
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([['ALAB:technical', LONG_AGO]])
        );
        structuralSet.add('ALAB:congress');

        await runPrewarmBatch();

        const starvationLines = warnSpy.mock.calls
            .map(args => String(args[0]))
            .filter(line => line.includes('starvation watch'));
        expect(starvationLines).toHaveLength(1);
        // 72시간 밀린 것은 사실이므로 경보 자체는 뜬다. 다만 `never`가 아니라
        // 실제 경과 시간으로 찍혀야 한다 — congress는 셈에서 빠졌다는 뜻이다.
        expect(starvationLines[0]).toContain('ALAB(72h)');
        expect(starvationLines[0]).not.toContain('never');

        warnSpy.mockRestore();
    });

    it('다른 심볼의 같은 탭은 영향을 받지 않는다', async () => {
        mockBuildPrewarmUniverse.mockReturnValue([
            { symbol: 'ALAB', tabs: ['congress'] },
            { symbol: 'AAPL', tabs: ['congress'] },
        ]);
        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        structuralSet.add('ALAB:congress');

        const counts = await runPrewarmBatch();

        // AAPL만 남는다 — 확정은 (symbol, tab) 단위다.
        expect(counts.staleTotal).toBe(1);
    });
});
