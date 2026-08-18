/**
 * FIX 3(감사, 실증) — `runPrewarmBatch.test.ts`는 `../lock` 전체를 mock하므로
 * `getInFlightMarker`의 실제 구현(=Redis 응답 파싱)을 한 번도 거치지 않는다.
 * 그래서 "legacy/job-agnostic 마커는 재제출되지 않는다"는 회귀 가드가 있어도,
 * `lock.ts`가 실제 @upstash/redis 응답(문자열이 아니라 JSON.parse된 number)을
 * 잘못 비교해 그 가드 자체가 절대 안 타는 상태(FIX 3 이전)를 잡아내지 못했다.
 *
 * 이 파일은 `../lock`을 mock하지 않고 진짜 `lock.ts`를 로드하되, 그 아래
 * `@/shared/cache/redisClient`만 가짜 Redis(get이 실제 Upstash 왕복처럼 숫자
 * `1`을 반환)로 대체해 "Redis 응답 → getInFlightMarker → classifySymbol/
 * processSymbol → seam 미호출"까지 전 구간을 end-to-end로 검증한다.
 */
const {
    mockRedisGet,
    mockRedisSet,
    mockRedisIncrby,
    mockRevalidateTag,
    mockUpsert,
    mockFindGeneratedAtMap,
    mockGetAssetInfoResilient,
    mockGetFmpErrorStatus,
    mockPrewarmTechnical,
    mockPrewarmPollTechnical,
    mockBuildPrewarmUniverse,
} = vi.hoisted(() => ({
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockRedisIncrby: vi.fn(),
    mockRevalidateTag: vi.fn(),
    mockUpsert: vi.fn(),
    mockFindGeneratedAtMap: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    mockGetFmpErrorStatus: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmPollTechnical: vi.fn(),
    mockBuildPrewarmUniverse: vi.fn(),
}));

// 의도적으로 '../lock'은 mock하지 않는다 — 이 테스트의 핵심은 실제 lock.ts
// 구현을 통과하는 것이다. 그 아래 redis 클라이언트만 가짜로 대체한다.
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => ({
        get: mockRedisGet,
        set: mockRedisSet,
        del: vi.fn(),
        eval: vi.fn(),
        incrby: mockRedisIncrby,
        expire: vi.fn(),
    }),
}));

vi.mock('next/cache', () => ({
    revalidateTag: mockRevalidateTag,
}));

vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: vi.fn().mockImplementation(function () {
        return {
            upsert: mockUpsert,
            findGeneratedAtMap: mockFindGeneratedAtMap,
        };
    }),
}));

// `buildPrewarmUniverse`만 스텁하고 나머지는 실물을 쓴다. `prewarmSessionSpecFor`는
// `freshness`의 장중 게이트가 부르는데, 스텁으로 덮으면 "크립토는 절대 미루지 않는다"는
// 계약이 이 스위트에서 사라진다 — 그 계약이 깨져도 여기 36개 테스트가 전부 통과한다.
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
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: vi.fn(),
    prewarmFundamental: vi.fn(),
    prewarmFinancials: vi.fn(),
    prewarmCongress: vi.fn(),
    prewarmPollTechnical: mockPrewarmPollTechnical,
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

import type { PrewarmSymbol } from '@/entities/seo-snapshot/lib/applicability';
import { lastCompletedEtCloseWithBuffer } from '@/entities/seo-snapshot/lib/freshness';
import { runPrewarmBatch } from '../runPrewarmBatch';

const FIXED_NOW = new Date('2026-07-25T13:00:00.000Z');
const BOUNDARY = lastCompletedEtCloseWithBuffer(FIXED_NOW);
void BOUNDARY;

function universe(...symbols: PrewarmSymbol[]): void {
    mockBuildPrewarmUniverse.mockReturnValue(symbols);
}

describe('runPrewarmBatch × 실제 lock.ts 왕복 (FIX 3, 실증 회귀 가드)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);

        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        mockGetFmpErrorStatus.mockReturnValue(null);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'X', name: 'X Inc.', fmpSymbol: undefined },
            degraded: false,
        });
        // 실제 lock.ts가 회전 커서(advanceRotationCursor)와 FMP 예산 집계
        // (addFmpBudget) 둘 다에 이 INCRBY를 쓴다 — 키별로 독립된 카운터를
        // 흉내내는 진짜 INCRBY 시맨틱이 필요하다(단순 vi.fn()은 undefined를
        // 반환해 회전 오프셋 계산이 NaN이 된다).
        const incrbyCounters = new Map<string, number>();
        mockRedisIncrby.mockImplementation(
            async (redisKey: string, step: number) => {
                const next = (incrbyCounters.get(redisKey) ?? 0) + step;
                incrbyCounters.set(redisKey, next);
                return next;
            }
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it(
        '실제 Redis가 job-agnostic 마커를 number 1로 반환해도(진짜 Upstash ' +
            'JSON.parse 왕복) 그 유닛은 skip되고 배치 슬롯을 소비하지 않는다 — ' +
            "이전엔 (number 1 !== string '1') 이 분기가 죽은 코드였다",
        async () => {
            universe(
                { symbol: 'GHOST', tabs: ['technical'] },
                { symbol: 'NEXT', tabs: ['technical'] }
            );
            // 실제 @upstash/redis 왕복 재현: markInFlight(symbol, tab)(jobId
            // 생략)가 저장한 sentinel은 GET 시 automaticDeserialization의
            // JSON.parse를 거쳐 number로 돌아온다.
            mockRedisGet.mockImplementation(async (key: string) => {
                if (key === 'seo-prewarm:inflight:GHOST:technical') return 1;
                if (key.startsWith('seo-prewarm:inflight:')) return null;
                if (key.startsWith('seo-prewarm:skip:')) return null;
                return null;
            });
            mockPrewarmTechnical.mockResolvedValue({
                status: 'cached',
                result: {},
            });

            const counts = await runPrewarmBatch();

            // GHOST의 seam(submit)은 호출되지 않는다 — 픽스 전에는 marker.jobId가
            // String(1)='1'로 오인식돼 poll-resume이 시도됐다(존재하지 않는
            // job이라 실패 → terminal skip → 6h backoff로 이어졌다).
            const calledSymbols = mockPrewarmTechnical.mock.calls.map(
                c => c[0]
            );
            expect(calledSymbols).not.toContain('GHOST');
            // poll도 시도되지 않는다 — number 1은 job-agnostic sentinel로
            // 인식돼야지 resumable jobId '1'로 오인식되면 안 된다.
            expect(mockPrewarmPollTechnical).not.toHaveBeenCalled();

            // NEXT는 정상 submit·harvest된다.
            expect(calledSymbols).toContain('NEXT');
            expect(counts.harvested).toBe(1);
            // GHOST는 selectFairBatch에서 'blocked'로 배제되어 배치 슬롯을
            // 소비하지 않는다(회전 대기로 remaining에 남는다) — 픽스 전에는
            // 'resumable'로 오분류되어 head 슬롯을 점유했다.
            expect(counts.remaining).toBe(1);
        }
    );
});
