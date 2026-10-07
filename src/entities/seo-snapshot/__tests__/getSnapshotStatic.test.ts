// spy → vi.mock → imports 순서 (TESTING.md#TE-1: vi.mock을 import 사이에 끼우지
// 않고, 팩토리가 참조하는 spy는 vi.hoisted로 끌어올린다).
const {
    mockFindBySymbol,
    mockRepoCtor,
    mockStaticSymbolCache,
    mockGetDatabaseClient,
    mockShortenRevalidate,
} = vi.hoisted(() => {
    const mockFindBySymbol = vi.fn();
    // Regular function (not arrow) so vi.fn()'s wrapped implementation is
    // usable with `new` — the production code does `new DrizzleSeoSnapshotRepository(db)`.
    const mockRepoCtor = vi.fn(function MockRepo() {
        return { findBySymbol: mockFindBySymbol };
    });
    // pass-through stub that ALSO records keyParts/symbol/extraTags/revalidateSeconds
    // so we can assert the exact cache key + tag contract the pre-warm cron relies on.
    const mockStaticSymbolCache = vi.fn(
        (
            _keyParts: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>,
            _extraTags?: readonly string[],
            _revalidateSeconds?: number
        ) => fetcher()
    );
    const mockGetDatabaseClient = vi.fn(() => ({ db: {} }));
    const mockShortenRevalidate = vi.fn(async () => undefined);
    return {
        mockShortenRevalidate,
        mockFindBySymbol,
        mockRepoCtor,
        mockStaticSymbolCache,
        mockGetDatabaseClient,
    };
});

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockStaticSymbolCache,
}));

vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: mockRepoCtor,
}));

vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: mockShortenRevalidate,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import {
    SNAPSHOT_MAX_AGE_MS,
    type SeoAnalysisSnapshot,
} from '@/entities/seo-snapshot/model';

// FIX D(감사) — max-age 필터는 Date.now() 기준이라 실제 wall-clock에 기대면
// 테스트가 시간 의존 flaky가 된다(TESTING.md#TE-7). fake
// timers로 고정한다.
const FIXED_NOW = new Date('2026-07-25T12:00:00.000Z');

function snapshotAt(generatedAt: Date, tab = 'technical'): SeoAnalysisSnapshot {
    return {
        symbol: 'AAPL',
        tab: tab as SeoAnalysisSnapshot['tab'],
        locale: 'ko',
        content: { summary: 'bullish' },
        plain: null,
        model: 'deepseek-v4.1-flash',
        generatedAt,
        firstGeneratedAt: generatedAt,
        updatedAt: generatedAt,
    };
}

const SNAPSHOTS: SeoAnalysisSnapshot[] = [
    snapshotAt(new Date('2026-07-24T00:00:00.000Z')),
];

describe('getSeoSnapshotsStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);
        mockFindBySymbol.mockResolvedValue(SNAPSHOTS);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('staticSymbolCache를 정확한 keyParts/symbol/extraTags/revalidateSeconds로 호출한다(소문자 입력 → 대문자 정규화)', async () => {
        await getSeoSnapshotsStatic('aapl', 3600, 'ko');

        expect(mockStaticSymbolCache).toHaveBeenCalledTimes(1);
        const [keyParts, symbol, , extraTags, revalidateSeconds] =
            mockStaticSymbolCache.mock.calls[0];
        expect(keyParts).toEqual(['seo-snapshots', 'AAPL']);
        expect(symbol).toBe('AAPL');
        expect(extraTags).toEqual(['seo-snapshot:AAPL']);
        expect(revalidateSeconds).toBe(3600);
    });

    it('성공 시 findBySymbol(대문자 심볼) 결과를 반환한다', async () => {
        const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

        expect(mockRepoCtor).toHaveBeenCalledWith({});
        expect(mockFindBySymbol).toHaveBeenCalledWith('AAPL', 'ko');
        expect(result).toEqual(SNAPSHOTS);
    });

    it('성공 시 행 수를 info 로그로 남긴다 (audit fix FIX 7 — 전 렌더러 null-render 시 유일한 관측 신호)', async () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

        expect(infoSpy).toHaveBeenCalledWith(
            '[getSeoSnapshotsStatic] AAPL: 1 snapshot row(s)'
        );

        infoSpy.mockRestore();
    });

    // 2026-10-05: 실패는 `[]`("행 없음")가 아니라 `null`("모름")이다. 안쪽에서 `[]`로 삼키면
    // `unstable_cache`가 그것을 6~24h 저장해 산문이 멀쩡한 종목이 noindex로 굳었다.
    describe('읽기 실패 = null(모름)', () => {
        let errorSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });
        afterEach(() => {
            errorSpy.mockRestore();
        });

        it('findBySymbol이 reject해도 throw하지 않고 null을 돌려준다', async () => {
            mockFindBySymbol.mockRejectedValue(new Error('DB unavailable'));

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result).toBeNull();
            expect(errorSpy).toHaveBeenCalledWith(
                '[getSeoSnapshotsStatic] read failed, degrading to unknown (null):',
                expect.objectContaining({ message: 'DB unavailable' })
            );
        });

        it('fetcher(캐시 콜백)는 실패를 삼키지 않고 throw한다 — 삼키면 캐시가 그 결과를 저장한다', async () => {
            mockFindBySymbol.mockRejectedValue(new Error('DB unavailable'));
            let fetcherError: unknown;
            mockStaticSymbolCache.mockImplementationOnce(async (...args) => {
                try {
                    return await args[2]();
                } catch (error) {
                    fetcherError = error;
                    throw error;
                }
            });

            await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(fetcherError).toBeInstanceOf(Error);
            expect((fetcherError as Error).message).toBe('DB unavailable');
        });

        it('행이 없는 정상 결과는 `[]`다 — null이 아니다', async () => {
            mockFindBySymbol.mockResolvedValue([]);

            await expect(
                getSeoSnapshotsStatic('AAPL', 3600, 'ko')
            ).resolves.toEqual([]);
            expect(mockShortenRevalidate).not.toHaveBeenCalled();
        });

        it('큐레이션 종목의 읽기 실패 렌더는 revalidate를 300초로 낮춘다', async () => {
            mockFindBySymbol.mockRejectedValue(new Error('DB unavailable'));

            await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(mockShortenRevalidate).toHaveBeenCalledTimes(1);
        });

        it('롱테일(큐레이션 밖) 읽기 실패는 300초 재생성 비용을 쓰지 않는다', async () => {
            mockFindBySymbol.mockRejectedValue(new Error('DB unavailable'));

            const result = await getSeoSnapshotsStatic('ZZZZQ', 3600, 'ko');

            expect(result).toBeNull();
            expect(mockShortenRevalidate).not.toHaveBeenCalled();
        });

        it('Next 제어 흐름 에러(DYNAMIC_SERVER_USAGE)는 degrade하지 않고 그대로 던진다', async () => {
            mockFindBySymbol.mockRejectedValue(
                Object.assign(new Error('Dynamic server usage'), {
                    digest: 'DYNAMIC_SERVER_USAGE',
                })
            );

            await expect(
                getSeoSnapshotsStatic('AAPL', 3600, 'ko')
            ).rejects.toThrow('Dynamic server usage');
            expect(mockShortenRevalidate).not.toHaveBeenCalled();
        });
    });

    describe('FIX D(감사) — max-age 필터', () => {
        it('cutoff보다 신선한 행은 그대로 통과한다', async () => {
            const freshRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - SNAPSHOT_MAX_AGE_MS + 1)
            );
            mockFindBySymbol.mockResolvedValue([freshRow]);

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result).toEqual([freshRow]);
        });

        it('cutoff보다 오래된 행은 필터링되어 빠진다', async () => {
            const staleRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - SNAPSHOT_MAX_AGE_MS - 1)
            );
            mockFindBySymbol.mockResolvedValue([staleRow]);

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result).toEqual([]);
        });

        it('신선/오래된 행이 섞이면 신선한 행만 반환한다', async () => {
            const freshRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - 1000),
                'technical'
            );
            const staleRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - SNAPSHOT_MAX_AGE_MS - 1),
                'overall'
            );
            mockFindBySymbol.mockResolvedValue([freshRow, staleRow]);

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result).toEqual([freshRow]);
        });

        it('행이 드롭되면 warn 로그를 남긴다(cron 정체 신호)', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const staleRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - SNAPSHOT_MAX_AGE_MS - 1)
            );
            mockFindBySymbol.mockResolvedValue([staleRow]);

            await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[getSeoSnapshotsStatic] AAPL: dropped 1 row(s)'
                )
            );

            warnSpy.mockRestore();
        });

        it('드롭이 없으면 warn 로그를 남기지 않는다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(warnSpy).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });

    describe('프리웜 대상이 아닌 탭 필터', () => {
        const freshAt = () => new Date(FIXED_NOW.getTime() - 1000);

        it.each([
            'overall',
            'fundamental',
            'financials',
            'congress',
            'options',
        ])(
            '%s 행은 7일 안이어도 버린다(더 이상 갱신되지 않는 낡은 분석)',
            async tab => {
                mockFindBySymbol.mockResolvedValue([
                    snapshotAt(freshAt(), tab),
                ]);

                const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

                expect(result).toEqual([]);
            }
        );

        it('technical·news 행은 그대로 통과한다', async () => {
            const technical = snapshotAt(freshAt(), 'technical');
            const news = snapshotAt(freshAt(), 'news');
            mockFindBySymbol.mockResolvedValue([
                technical,
                snapshotAt(freshAt(), 'options'),
                news,
            ]);

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result).toEqual([technical, news]);
        });

        it('이미 캐시에 담긴 값(fetcher를 거치지 않은 JSON 왕복 행)에도 적용된다', async () => {
            // 캐시 히트 경로는 fetcher 안의 필터를 지나지 않는다 — 배포 전에 저장된
            // options 행이 TTL 동안 남지 않으려면 캐시 값을 읽은 뒤에 걸러야 한다.
            const cached = (tab: string) => ({
                symbol: 'AAPL',
                tab,
                locale: 'ko',
                content: {},
                model: 'test-model',
                generatedAt: freshAt().toISOString(),
                updatedAt: freshAt().toISOString(),
            });
            mockStaticSymbolCache.mockImplementationOnce(() =>
                Promise.resolve([cached('options'), cached('technical')])
            );

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result?.map(row => row.tab)).toEqual(['technical']);
        });
    });

    describe('캐시 히트 JSON 왕복 rehydrate', () => {
        it('캐시 히트로 JSON 왕복을 거친 행도 Date로 되살린다', async () => {
            // unstable_cache는 결과를 JSON.stringify → JSON.parse 한다. Date가 ISO
            // 문자열로 돌아오면 렌더의 Intl.DateTimeFormat.format()이 RangeError를
            // 던진다(타입은 Date라 컴파일 단계에서는 드러나지 않는다).
            const row = {
                symbol: 'AAPL',
                tab: 'technical' as const,
                content: {},
                model: 'test-model',
                generatedAt: new Date('2026-07-31T20:00:00Z'),
                updatedAt: new Date('2026-07-31T20:00:00Z'),
            };
            // 캐시 계층이 실제로 하는 일을 그대로 흉내낸다: staticSymbolCache
            // mock이 fetcher를 호출하는 대신 이미 JSON 왕복을 거친 값을 직접
            // resolve하도록 이 테스트에서만 구현을 덮어쓴다(캐시 히트 시뮬레이션).
            const roundTripped = JSON.parse(JSON.stringify([row]));
            mockStaticSymbolCache.mockImplementationOnce(() =>
                Promise.resolve(roundTripped)
            );

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result![0].generatedAt).toBeInstanceOf(Date);
            expect(result![0].updatedAt).toBeInstanceOf(Date);
            // 실제 증상까지 재현: 되살리지 않으면 여기서 RangeError가 난다.
            expect(() =>
                new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'America/New_York',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                }).format(result![0].generatedAt)
            ).not.toThrow();
        });

        it('firstGeneratedAt도 Date로 되살리고, null은 null로 둔다', async () => {
            // 이 필드는 뉴스 탭 `Article`의 `datePublished` 소스다. 히트 렌더에서
            // 문자열이 흘러가면 `.getTime()`을 부르는 다음 소비자가 캐시 상태에
            // 따라서만 깨진다 — 형제 필드와 같은 왕복을 타므로 같이 고정한다.
            const base = {
                symbol: 'AAPL',
                tab: 'technical' as const,
                content: {},
                model: 'test-model',
                generatedAt: new Date('2026-07-31T20:00:00Z'),
                updatedAt: new Date('2026-07-31T20:00:00Z'),
            };
            const rows = [
                { ...base, firstGeneratedAt: new Date('2026-06-02T03:00:00Z') },
                { ...base, tab: 'news' as const, firstGeneratedAt: null },
            ];
            mockStaticSymbolCache.mockImplementationOnce(() =>
                Promise.resolve(JSON.parse(JSON.stringify(rows)))
            );

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            const technical = result!.find(r => r.tab === 'technical');
            const news = result!.find(r => r.tab === 'news');
            expect(technical?.firstGeneratedAt).toBeInstanceOf(Date);
            expect(technical?.firstGeneratedAt?.toISOString()).toBe(
                '2026-06-02T03:00:00.000Z'
            );
            // 백필 소스가 없는 탭은 `null`로 남는다 — 그 상태가 `new Date(null)`로
            // 1970년이 되면 페이지가 없는 발행일을 주장하게 된다.
            expect(news?.firstGeneratedAt).toBeNull();
        });

        /**
         * **컬럼이 생기기 전 코드가 채운 캐시 항목**에는 필드 자체가 없다. 히트 시
         * `undefined`로 돌아오는데, 엄격 비교로 되살리면 `new Date(undefined)` =
         * Invalid Date가 되고 그건 `null`이 아니라서 소비처의 `?? null`도 통과해
         * `toISOString()`에서 `RangeError`로 렌더가 죽는다. 배포 직후 캐시
         * TTL(최대 86400s) 동안만 나타나므로 로컬에서는 절대 재현되지 않는다.
         */
        it('필드가 없는 옛 캐시 항목은 null로 되살린다 — Invalid Date를 렌더로 흘리지 않는다', async () => {
            const legacyRow = {
                symbol: 'AAPL',
                tab: 'news' as const,
                content: {},
                model: 'test-model',
                generatedAt: new Date('2026-07-31T20:00:00Z'),
                updatedAt: new Date('2026-07-31T20:00:00Z'),
                // firstGeneratedAt 키 자체가 없다(옛 배포가 직렬화한 형태).
            };
            mockStaticSymbolCache.mockImplementationOnce(() =>
                Promise.resolve(JSON.parse(JSON.stringify([legacyRow])))
            );

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result![0].firstGeneratedAt).toBeNull();
        });

        // A1(감사): 캐시-히트 rehydrate가 malformed generatedAt(예: 손상된
        // JSONB, 되살릴 수 없는 값)까지 Date로 되살리지는 못한다 — 이 경우
        // Invalid Date가 렌더까지 흘러가지 않도록 여기서 드롭해야 한다.
        it('rehydrate 후 generatedAt이 Invalid Date인 행은 드롭한다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const malformedRow = {
                symbol: 'AAPL',
                tab: 'technical' as const,
                content: {},
                model: 'test-model',
                generatedAt: 'not-a-date',
                updatedAt: 'not-a-date',
            };
            mockStaticSymbolCache.mockImplementationOnce(() =>
                Promise.resolve([malformedRow])
            );

            const result = await getSeoSnapshotsStatic('AAPL', 3600, 'ko');

            expect(result).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[getSeoSnapshotsStatic] AAPL: dropped 1 row(s) with an invalid generatedAt'
                )
            );

            warnSpy.mockRestore();
        });
    });
});
