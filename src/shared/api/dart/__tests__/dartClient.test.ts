const { redisState, mockGetRedis } = vi.hoisted(() => {
    const redisState = {
        store: new Map<string, string>(),
        ttl: new Map<string, number>(),
        fail: false,
    };
    const fake = {
        get: vi.fn(async (key: string) => {
            if (redisState.fail) throw new Error('upstash down');
            return redisState.store.get(key) ?? null;
        }),
        incr: vi.fn(async (key: string) => {
            if (redisState.fail) throw new Error('upstash down');
            const next = Number(redisState.store.get(key) ?? '0') + 1;
            redisState.store.set(key, String(next));
            return next;
        }),
        expire: vi.fn(async (key: string, seconds: number) => {
            redisState.ttl.set(key, seconds);
            return 1;
        }),
        set: vi.fn(
            async (key: string, value: string, options?: { ex?: number }) => {
                redisState.store.set(key, value);
                if (options?.ex !== undefined)
                    redisState.ttl.set(key, options.ex);
                return 'OK';
            }
        ),
    };
    return {
        redisState,
        mockGetRedis: vi.fn((): typeof fake | null => fake),
    };
});
vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/sleep', () => ({ sleep: async () => undefined }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: mockGetRedis }));

import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetDartClientForTests,
    DART_DAILY_CALL_BUDGET,
    DART_DAILY_QUOTA,
    DART_LIST_PAGE_COUNT,
    DART_QUOTA_BREAKER_KEY,
    DART_QUOTA_WARN_RATIO,
    DartApiError,
    DartDisabledError,
    DartIpNotAllowedError,
    DartQuotaError,
    dartDailyCallCounterKey,
    dartFatalReason,
    fetchCorpCodeZip,
    fetchDisclosureList,
    fetchAlotMatter,
    fetchExecutiveStock,
    fetchMajorStock,
    isDartEnabled,
    secondsUntilNextKstMidnight,
} from '../dartClient';

const KEY = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0';
/** 2026-10-16 10:00 KST(01:00 UTC). */
const NOW = new Date('2026-10-16T01:00:00Z');
const TODAY_KST = '2026-10-16';

/** Deny-by-default fetch: any request not stubbed by the test fails it. */
const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

const json = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });

/** 이 테스트가 `pathname`으로 보낸 요청의 URL(없으면 실패). 호출 순서가 아니라 대상 경로로 찾는다(TESTING.md#TE-27). */
function requestTo(pathname: string): URL {
    const url = fetchSpy.mock.calls
        .map(([input]) => new URL(String(input)))
        .find(candidate => candidate.pathname === pathname);
    if (url === undefined) throw new Error(`no request to ${pathname}`);
    return url;
}

/** 콘솔 스파이 호출 중 첫 인자가 `prefix`로 시작하는 메시지들. */
const messagesStartingWith = (
    spy: { mock: { calls: unknown[][] } },
    prefix: string
): string[] =>
    spy.mock.calls
        .map(([message]) => String(message))
        .filter(message => message.startsWith(prefix));

describe('dartClient', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        fetchSpy.mockReset();
        fetchSpy.mockImplementation(async input => {
            throw new Error(`unexpected fetch: ${String(input)}`);
        });
        vi.stubGlobal('fetch', fetchSpy);
        vi.stubEnv('DART_API_KEY', KEY);
        redisState.store.clear();
        redisState.ttl.clear();
        redisState.fail = false;
        mockGetRedis.mockClear();
        __resetDartClientForTests();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    describe('isDartEnabled', () => {
        it('is enabled when DART_API_KEY is set', () => {
            expect(isDartEnabled()).toBe(true);
        });

        it('is disabled for an unset or blank key and warns only once per process', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.stubEnv('DART_API_KEY', '   ');
            expect(isDartEnabled()).toBe(false);
            expect(isDartEnabled()).toBe(false);
            expect(warn).toHaveBeenCalledTimes(1);
            expect(
                messagesStartingWith(warn, '[dart] DART_API_KEY is not set')
            ).toHaveLength(1);
        });

        it('makes no request when the key is missing', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.stubEnv('DART_API_KEY', '');
            await expect(fetchMajorStock('00126380')).rejects.toBeInstanceOf(
                DartDisabledError
            );
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('fetchDisclosureList', () => {
        it('queries one detail type without pblntf_ty (DART ignores the detail filter when both are sent), compact dates, 100 per page, oldest first', async () => {
            fetchSpy.mockResolvedValueOnce(
                json({
                    status: '000',
                    message: '정상',
                    page_no: 2,
                    page_count: 100,
                    total_count: 150,
                    total_page: 2,
                    list: [{ rcept_no: '20261015000123' }, 'not-a-row'],
                })
            );
            const page = await fetchDisclosureList({
                beginDate: '2026-10-09',
                endDate: '2026-10-16',
                detailType: 'D002',
                pageNo: 2,
            });
            expect(page).toEqual({
                pageNo: 2,
                totalPage: 2,
                totalCount: 150,
                rows: [{ rcept_no: '20261015000123' }],
            });
            const url = requestTo('/api/list.json');
            expect(`${url.origin}${url.pathname}`).toBe(
                'https://opendart.fss.or.kr/api/list.json'
            );
            expect(Object.fromEntries(url.searchParams)).toEqual({
                crtfc_key: KEY,
                bgn_de: '20261009',
                end_de: '20261016',
                pblntf_detail_ty: 'D002',
                page_no: '2',
                page_count: String(DART_LIST_PAGE_COUNT),
                sort: 'date',
                sort_mth: 'asc',
            });
        });

        it('returns an empty page for 013 (no data)', async () => {
            fetchSpy.mockResolvedValueOnce(
                json({ status: '013', message: '조회된 데이타가 없습니다.' })
            );
            expect(
                await fetchDisclosureList({
                    beginDate: '2026-10-16',
                    endDate: '2026-10-16',
                    detailType: 'D005',
                    pageNo: 1,
                })
            ).toEqual({ pageNo: 1, totalPage: 0, totalCount: 0, rows: [] });
        });
    });

    describe('majorstock / elestock', () => {
        it('asks majorstock.json for one corp code and returns its rows', async () => {
            fetchSpy.mockResolvedValueOnce(
                json({
                    status: '000',
                    message: '정상',
                    list: [{ rcept_no: '20190311000555', stkqy: '1,000' }],
                })
            );
            expect(await fetchMajorStock('00126380')).toEqual([
                { rcept_no: '20190311000555', stkqy: '1,000' },
            ]);
            expect(
                requestTo('/api/majorstock.json').searchParams.get('corp_code')
            ).toBe('00126380');
        });

        it('asks elestock.json and returns an empty list for 013', async () => {
            fetchSpy.mockResolvedValueOnce(
                json({ status: '013', message: '조회된 데이타가 없습니다.' })
            );
            expect(await fetchExecutiveStock('00126380')).toEqual([]);
            expect(
                requestTo('/api/elestock.json').searchParams.get('corp_code')
            ).toBe('00126380');
        });
    });

    describe('alotMatter', () => {
        it('asks alotMatter.json for the corp, fiscal year and annual report code', async () => {
            fetchSpy.mockResolvedValueOnce(
                json({
                    status: '000',
                    message: '정상',
                    list: [{ se: '주당 현금배당금(원)', thstrm: '6,000' }],
                })
            );
            expect(await fetchAlotMatter('00244455', 2025)).toEqual([
                { se: '주당 현금배당금(원)', thstrm: '6,000' },
            ]);
            const params = requestTo('/api/alotMatter.json').searchParams;
            expect(params.get('corp_code')).toBe('00244455');
            expect(params.get('bsns_year')).toBe('2025');
            expect(params.get('reprt_code')).toBe('11011');
        });

        it('returns null (not an empty list) for 013 so the caller can try an earlier year', async () => {
            fetchSpy.mockResolvedValueOnce(
                json({ status: '013', message: '조회된 데이타가 없습니다.' })
            );
            expect(await fetchAlotMatter('00435297', 2025)).toBeNull();
        });

        it('throws for other DART statuses', async () => {
            fetchSpy.mockResolvedValueOnce(
                json({ status: '100', message: '필드의 부적절한 값' })
            );
            await expect(
                fetchAlotMatter('00244455', 2025)
            ).rejects.toBeInstanceOf(DartApiError);
        });
    });

    describe('quota guard', () => {
        it('counts each request under the KST date key and expires the counter after two days', async () => {
            fetchSpy.mockImplementation(async () =>
                json({ status: '013', message: '' })
            );
            await fetchMajorStock('00126380');
            await fetchExecutiveStock('00126380');
            const key = dartDailyCallCounterKey(TODAY_KST);
            expect(redisState.store.get(key)).toBe('2');
            expect(redisState.ttl.get(key)).toBe(2 * 24 * 60 * 60);
        });

        it('uses the KST date, not the UTC date, right after KST midnight', async () => {
            vi.setSystemTime(new Date('2026-10-16T15:30:00Z')); // 2026-10-17 00:30 KST
            fetchSpy.mockImplementation(async () =>
                json({ status: '013', message: '' })
            );
            await fetchMajorStock('00126380');
            expect(
                redisState.store.get(dartDailyCallCounterKey('2026-10-17'))
            ).toBe('1');
        });

        it('warns once when the daily count reaches 80% of the quota', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const threshold = Math.ceil(
                DART_DAILY_QUOTA * DART_QUOTA_WARN_RATIO
            );
            redisState.store.set(
                dartDailyCallCounterKey(TODAY_KST),
                String(threshold - 1)
            );
            fetchSpy.mockImplementation(async () =>
                json({ status: '013', message: '' })
            );
            await fetchMajorStock('00126380');
            await fetchMajorStock('00126380');
            expect(
                messagesStartingWith(
                    warn,
                    `[dart] quota warning — ${threshold} of ${DART_DAILY_QUOTA}`
                )
            ).toHaveLength(1);
            expect(
                messagesStartingWith(warn, '[dart] quota warning')
            ).toHaveLength(1);
        });

        it('refuses without a request once the daily call budget is used up', async () => {
            redisState.store.set(
                dartDailyCallCounterKey(TODAY_KST),
                String(DART_DAILY_CALL_BUDGET)
            );
            await expect(fetchMajorStock('00126380')).rejects.toBeInstanceOf(
                DartQuotaError
            );
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('020 opens a breaker until the next KST midnight and later calls make no request', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            fetchSpy.mockResolvedValueOnce(
                json({ status: '020', message: '요청 제한을 초과하였습니다.' })
            );
            await expect(fetchMajorStock('00126380')).rejects.toBeInstanceOf(
                DartQuotaError
            );
            expect(redisState.store.get(DART_QUOTA_BREAKER_KEY)).toBe(
                TODAY_KST
            );
            // 10:00 KST → next midnight is 14 hours away.
            expect(redisState.ttl.get(DART_QUOTA_BREAKER_KEY)).toBe(
                14 * 60 * 60
            );
            await expect(
                fetchExecutiveStock('00126380')
            ).rejects.toBeInstanceOf(DartQuotaError);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('honours a breaker opened by another instance', async () => {
            redisState.store.set(DART_QUOTA_BREAKER_KEY, TODAY_KST);
            await expect(fetchMajorStock('00126380')).rejects.toBeInstanceOf(
                DartQuotaError
            );
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('still requests (fail-open) when Redis is not configured', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            mockGetRedis.mockReturnValue(null);
            fetchSpy.mockResolvedValueOnce(
                json({ status: '013', message: '' })
            );
            expect(await fetchMajorStock('00126380')).toEqual([]);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            mockGetRedis.mockRestore();
        });

        it('still requests (fail-open) when a Redis command fails', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            redisState.fail = true;
            fetchSpy.mockResolvedValueOnce(
                json({ status: '013', message: '' })
            );
            expect(await fetchMajorStock('00126380')).toEqual([]);
        });
    });

    describe('status handling', () => {
        it('012 throws DartIpNotAllowedError and logs the remediation', async () => {
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            fetchSpy.mockResolvedValueOnce(
                json({ status: '012', message: '접근할 수 없는 IP입니다.' })
            );
            const caught = await fetchMajorStock('00126380').catch(
                (e: unknown) => e
            );
            expect(caught).toBeInstanceOf(DartIpNotAllowedError);
            expect(dartFatalReason(caught)).toBe('ip_not_allowed');
            expect(
                messagesStartingWith(error, '[dart] ip_not_allowed')
            ).toHaveLength(1);
        });

        it.each([
            ['010', 'auth_failed'],
            ['011', 'auth_failed'],
            ['901', 'auth_failed'],
            ['800', 'maintenance'],
            ['100', null],
            ['900', null],
        ] as const)(
            'status %s is fatal for the run: %s',
            async (status, reason) => {
                fetchSpy.mockResolvedValueOnce(json({ status, message: 'x' }));
                const caught = await fetchMajorStock('00126380').catch(
                    (e: unknown) => e
                );
                expect(caught).toBeInstanceOf(DartApiError);
                expect((caught as DartApiError).dartStatus).toBe(status);
                expect(dartFatalReason(caught)).toBe(reason);
                // A DART status is an answer, not a transient fault — no retry.
                expect(fetchSpy).toHaveBeenCalledTimes(1);
            }
        );

        it('classifies a missing key as fatal (disabled) and other errors as not fatal', () => {
            expect(dartFatalReason(new DartDisabledError())).toBe('disabled');
            expect(dartFatalReason(new Error('boom'))).toBeNull();
        });

        it('retries a 5xx once, then throws an HTTP error', async () => {
            fetchSpy.mockImplementation(
                async () => new Response('busy', { status: 503 })
            );
            const caught = await fetchMajorStock('00126380').catch(
                (e: unknown) => e
            );
            expect(caught).toBeInstanceOf(DartApiError);
            expect((caught as DartApiError).httpStatus).toBe(503);
            expect(dartFatalReason(caught)).toBeNull();
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('retries a network failure and recovers', async () => {
            fetchSpy
                .mockRejectedValueOnce(new TypeError('fetch failed'))
                .mockResolvedValueOnce(json({ status: '013', message: '' }));
            expect(await fetchMajorStock('00126380')).toEqual([]);
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('rejects a body that is not JSON', async () => {
            fetchSpy.mockResolvedValueOnce(new Response('<html>maintenance'));
            await expect(fetchMajorStock('00126380')).rejects.toThrow(
                'response is not JSON'
            );
        });
    });

    describe('never leaks the key', () => {
        it('keeps the key out of network, HTTP and status error messages', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const failures = [
                () =>
                    Promise.reject(
                        new TypeError(
                            `fetch failed https://opendart.fss.or.kr/api/majorstock.json?crtfc_key=${KEY}`
                        )
                    ),
                () => Promise.resolve(new Response('', { status: 400 })),
                () =>
                    Promise.resolve(
                        json({
                            status: '100',
                            message: '필드의 부적절한 값입니다.',
                        })
                    ),
            ];
            const messages = await Promise.all(
                failures.map(async failure => {
                    fetchSpy.mockReset();
                    fetchSpy.mockImplementation(failure);
                    const caught = await fetchMajorStock('00126380').catch(
                        (e: unknown) => e
                    );
                    return `${(caught as Error).message} ${String((caught as Error).cause ?? '')}`;
                })
            );
            expect(messages).toHaveLength(failures.length);
            for (const message of messages) {
                expect(message).not.toContain('crtfc_key');
                expect(message).not.toContain(KEY);
            }
        });
    });

    describe('fetchCorpCodeZip', () => {
        it('returns the zip bytes', async () => {
            const zip = zipSync({
                'CORPCODE.xml': strToU8('<result></result>'),
            });
            fetchSpy.mockResolvedValueOnce(new Response(zip));
            const bytes = await fetchCorpCodeZip();
            expect([...bytes]).toEqual([...zip]);
            expect(
                requestTo('/api/corpCode.xml').searchParams.get('crtfc_key')
            ).toBe(KEY);
        });

        it('reads the status XML DART sends instead of a zip (020 → quota breaker)', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            fetchSpy.mockResolvedValueOnce(
                new Response(
                    '<?xml version="1.0" encoding="UTF-8"?><result><status>020</status><message>요청 제한을 초과하였습니다.</message></result>'
                )
            );
            await expect(fetchCorpCodeZip()).rejects.toBeInstanceOf(
                DartQuotaError
            );
            expect(redisState.store.get(DART_QUOTA_BREAKER_KEY)).toBe(
                TODAY_KST
            );
        });

        it('treats a 000 status without a zip as a failure, not an empty map', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response('<result><status>000</status></result>')
            );
            await expect(fetchCorpCodeZip()).rejects.toThrow(
                'status 000 without a zip'
            );
        });
    });

    describe('secondsUntilNextKstMidnight', () => {
        it('counts to the next 00:00 KST', () => {
            expect(
                secondsUntilNextKstMidnight(new Date('2026-10-16T14:00:00Z'))
            ).toBe(60 * 60); // 23:00 KST
        });

        it('never returns less than a minute', () => {
            expect(
                secondsUntilNextKstMidnight(new Date('2026-10-16T14:59:59Z'))
            ).toBe(60);
        });
    });
});
