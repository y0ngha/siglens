import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    INDEXNOW_ENDPOINTS,
    INDEXNOW_KEY,
    INDEXNOW_KEY_LOCATION,
    INDEXNOW_TIMEOUT_MS,
} from '@/shared/config/indexNow';
import {
    isIndexNowEnabled,
    isUrlRejectionStatus,
    parseRetryAfterSeconds,
    submitIndexNow,
} from '../indexNow';

const API_ENDPOINT = INDEXNOW_ENDPOINTS[0];

// 기본 구현은 **거부**다. 구현 없는 vi.fn()/spyOn은 원본 fetch를 부르므로
// 테스트가 실제 api.indexnow.org·searchadvisor.naver.com로 요청을 내보낼 수 있다.
const fetchMock = vi.fn<typeof fetch>();

function okResponse(
    status = 200,
    headers: Record<string, string> = {}
): Response {
    return new Response(null, { status, headers });
}

interface RecordedCall {
    readonly endpoint: string;
    readonly init: RequestInit;
    readonly body: {
        host: string;
        key: string;
        keyLocation: string;
        urlList: string[];
    };
}

/** 호출 순서에 기대지 않도록 엔드포인트로 호출을 찾는다. */
function callsTo(endpoint: string): RecordedCall[] {
    return fetchMock.mock.calls
        .filter(([input]) => input === endpoint)
        .map(([input, init]) => ({
            endpoint: String(input),
            init: init ?? {},
            body: JSON.parse(String(init?.body)),
        }));
}

function enableProduction(): void {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('E2E_TEST', '');
}

const URL_A = 'https://siglens.io/AAPL';
const URL_B = 'https://siglens.io/AAPL/news';

describe('isIndexNowEnabled', () => {
    it('운영 빌드(NODE_ENV=production)이고 E2E가 아니며 운영 호스트면 켜진다', () => {
        enableProduction();

        expect(isIndexNowEnabled()).toBe(true);
    });

    it('개발·테스트 환경에서는 꺼진다', () => {
        vi.stubEnv('NODE_ENV', 'development');

        expect(isIndexNowEnabled()).toBe(false);
    });

    it('E2E 빌드에서는 운영 환경이어도 꺼진다', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('E2E_TEST', '1');

        expect(isIndexNowEnabled()).toBe(false);
    });

    it('SITE_URL의 호스트가 siglens.io가 아니면(프리뷰·로컬) 꺼진다', async () => {
        vi.resetModules();
        vi.doMock('@/shared/lib/seo', () => ({
            SITE_URL: 'http://localhost:4200',
            SITE_HOST: 'siglens.io',
        }));
        enableProduction();

        const mod = await import('../indexNow');

        expect(mod.isIndexNowEnabled()).toBe(false);
        vi.doUnmock('@/shared/lib/seo');
        vi.resetModules();
    });
});

describe('submitIndexNow', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockRejectedValue(new Error('network blocked in test'));
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('비활성 환경', () => {
        it('개발 환경에서는 fetch를 한 번도 부르지 않고 0을 돌려준다', async () => {
            vi.stubEnv('NODE_ENV', 'development');

            const result = await submitIndexNow([URL_A]);

            expect(result).toEqual({
                submitted: 0,
                ok: 0,
                failed: 0,
                outcome: { kind: 'disabled' },
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('E2E 환경에서는 fetch를 부르지 않는다', async () => {
            vi.stubEnv('NODE_ENV', 'production');
            vi.stubEnv('E2E_TEST', '1');

            const result = await submitIndexNow([URL_A]);

            expect(result).toEqual({
                submitted: 0,
                ok: 0,
                failed: 0,
                outcome: { kind: 'disabled' },
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('활성 환경', () => {
        beforeEach(() => {
            enableProduction();
            fetchMock.mockResolvedValue(okResponse());
        });

        it('공용 IndexNow 엔드포인트 한 곳에만 { host, key, keyLocation, urlList }를 JSON으로 POST한다', async () => {
            const result = await submitIndexNow([URL_A, URL_B]);

            expect(result).toEqual({
                submitted: 2,
                ok: 1,
                failed: 0,
                outcome: { kind: 'ok' },
            });
            // 참여 엔진(Bing·Naver·Yandex 등)은 제출을 서로 공유한다 — 다른 곳에 또
            // 보내면 중복 제출이고 429 위험만 는다.
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const calls = callsTo(API_ENDPOINT);
            expect(calls).toHaveLength(1);
            const [call] = calls;
            expect(call?.init.method).toBe('POST');
            expect(call?.init.headers).toEqual({
                'Content-Type': 'application/json; charset=utf-8',
            });
            expect(call?.body).toEqual({
                host: 'siglens.io',
                key: INDEXNOW_KEY,
                keyLocation: INDEXNOW_KEY_LOCATION,
                urlList: [URL_A, URL_B],
            });
        });

        it('Next fetch 캐시에 들어가지 않도록 no-store로 보낸다', async () => {
            await submitIndexNow([URL_A]);

            expect(callsTo(API_ENDPOINT)[0]?.init.cache).toBe('no-store');
        });

        it('202도 성공으로 센다', async () => {
            fetchMock.mockResolvedValue(okResponse(202));

            const result = await submitIndexNow([URL_A]);

            expect(result).toEqual({
                submitted: 1,
                ok: 1,
                failed: 0,
                outcome: { kind: 'ok' },
            });
        });

        it('중복 URL은 한 번만 보내고 운영 호스트가 아닌 URL은 버린다', async () => {
            const result = await submitIndexNow([
                URL_A,
                URL_A,
                'https://example.com/AAPL',
                'https://ai.siglens.io/',
                'not a url',
                URL_B,
            ]);

            expect(result.submitted).toBe(2);
            expect(callsTo(API_ENDPOINT)[0]?.body.urlList).toEqual([
                URL_A,
                URL_B,
            ]);
        });

        it('보낼 URL이 하나도 남지 않으면 fetch를 부르지 않는다', async () => {
            const result = await submitIndexNow([
                'https://example.com/x',
                'garbage',
            ]);

            expect(result).toEqual({
                submitted: 0,
                ok: 0,
                failed: 0,
                outcome: { kind: 'empty' },
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('빈 입력이면 fetch를 부르지 않는다', async () => {
            const result = await submitIndexNow([]);

            expect(result).toEqual({
                submitted: 0,
                ok: 0,
                failed: 0,
                outcome: { kind: 'empty' },
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it.each([
            [400, { kind: 'rejected', status: 400 }],
            [403, { kind: 'rejected', status: 403 }],
            [422, { kind: 'rejected', status: 422 }],
            [429, { kind: 'rateLimited', retryAfterSeconds: null }],
            [500, { kind: 'transient', status: 500 }],
            [503, { kind: 'transient', status: 503 }],
            [408, { kind: 'transient', status: 408 }],
        ])(
            '상태 %i는 실패로 세고 던지지 않으며 outcome으로 분류한다',
            async (status, outcome) => {
                fetchMock.mockResolvedValue(okResponse(status));

                await expect(submitIndexNow([URL_A])).resolves.toEqual({
                    submitted: 1,
                    ok: 0,
                    failed: 1,
                    outcome,
                });
            }
        );

        it('429의 Retry-After(초)를 읽는다', async () => {
            fetchMock.mockResolvedValue(
                okResponse(429, { 'Retry-After': '120' })
            );

            const result = await submitIndexNow([URL_A]);

            expect(result.outcome).toEqual({
                kind: 'rateLimited',
                retryAfterSeconds: 120,
            });
        });

        it('네트워크 오류로 reject돼도 던지지 않고 실패로 센다', async () => {
            fetchMock.mockRejectedValue(new Error('boom'));

            await expect(submitIndexNow([URL_A])).resolves.toEqual({
                submitted: 1,
                ok: 0,
                failed: 1,
                outcome: { kind: 'transient', status: null },
            });
        });

        it('실패는 엔드포인트와 상태만 한 줄로 로그하고 URL 목록은 남기지 않는다 — 403과 422를 구분할 수 있다', async () => {
            const errorSpy = vi.spyOn(console, 'error');

            for (const status of [403, 422]) {
                errorSpy.mockClear();
                fetchMock.mockResolvedValue(okResponse(status));

                await submitIndexNow([URL_A]);

                const failureLogs = errorSpy.mock.calls.filter(
                    ([message]) => message === '[indexnow] submit failed'
                );
                expect(failureLogs).toHaveLength(1);
                expect(failureLogs[0]?.[1]).toEqual({
                    endpoint: API_ENDPOINT,
                    status,
                });
                expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
                    URL_A
                );
            }
        });

        it('네트워크 오류는 error 필드로 로그한다', async () => {
            const errorSpy = vi.spyOn(console, 'error');
            const failure = new Error('socket hang up');
            fetchMock.mockRejectedValue(failure);

            await submitIndexNow([URL_A]);

            const failureLogs = errorSpy.mock.calls.filter(
                ([message]) => message === '[indexnow] submit failed'
            );
            expect(failureLogs).toHaveLength(1);
            expect(failureLogs[0]?.[1]).toEqual({
                endpoint: API_ENDPOINT,
                error: failure,
            });
        });

        it('INDEXNOW_TIMEOUT_MS짜리 AbortSignal을 단다', async () => {
            const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

            await submitIndexNow([URL_A]);

            expect(timeoutSpy).toHaveBeenCalledWith(INDEXNOW_TIMEOUT_MS);
            expect(callsTo(API_ENDPOINT)[0]?.init.signal).toBeInstanceOf(
                AbortSignal
            );
        });

        it('타임아웃으로 신호가 중단되면 실패로 세고 던지지 않는다', async () => {
            const controller = new AbortController();
            vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
            fetchMock.mockImplementation(
                (_input, init) =>
                    new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () =>
                            reject(new DOMException('timeout', 'TimeoutError'))
                        );
                    })
            );

            const pending = submitIndexNow([URL_A]);
            controller.abort();

            await expect(pending).resolves.toEqual({
                submitted: 1,
                ok: 0,
                failed: 1,
                outcome: { kind: 'transient', status: null },
            });
        });

        it('상한을 넘는 URL은 청크로 나눠 순서대로 보낸다', async () => {
            const urls = [1, 2, 3, 4, 5].map(n => `https://siglens.io/SYM${n}`);

            const result = await submitIndexNow(urls, {
                maxUrlsPerRequest: 2,
            });

            expect(result).toEqual({
                submitted: 5,
                ok: 1,
                failed: 0,
                outcome: { kind: 'ok' },
            });
            expect(callsTo(API_ENDPOINT).map(c => c.body.urlList)).toEqual([
                urls.slice(0, 2),
                urls.slice(2, 4),
                urls.slice(4),
            ]);
        });

        it('청크 하나라도 실패하면 실패이고 나머지 청크는 보내지 않는다', async () => {
            const urls = [1, 2, 3, 4].map(n => `https://siglens.io/SYM${n}`);
            fetchMock.mockResolvedValue(okResponse(429));

            const result = await submitIndexNow(urls, {
                maxUrlsPerRequest: 2,
            });

            expect(result).toEqual({
                submitted: 4,
                ok: 0,
                failed: 1,
                outcome: { kind: 'rateLimited', retryAfterSeconds: null },
            });
            expect(callsTo(API_ENDPOINT)).toHaveLength(1);
        });
    });
});

describe('parseRetryAfterSeconds', () => {
    const NOW = Date.parse('2026-10-05T00:00:00Z');

    it('정수 초를 읽는다', () => {
        expect(parseRetryAfterSeconds('90', NOW)).toBe(90);
        expect(parseRetryAfterSeconds(' 0 ', NOW)).toBe(0);
    });

    it('HTTP 날짜는 지금부터 남은 초(올림)로 바꾼다', () => {
        expect(
            parseRetryAfterSeconds('Mon, 05 Oct 2026 00:01:30 GMT', NOW)
        ).toBe(90);
    });

    it('과거 날짜는 0으로 접는다', () => {
        expect(
            parseRetryAfterSeconds('Sun, 04 Oct 2026 00:00:00 GMT', NOW)
        ).toBe(0);
    });

    it('없거나 읽을 수 없으면 null', () => {
        expect(parseRetryAfterSeconds(null, NOW)).toBeNull();
        expect(parseRetryAfterSeconds('soon', NOW)).toBeNull();
        expect(parseRetryAfterSeconds('-5', NOW)).toBeNull();
    });
});

describe('isUrlRejectionStatus', () => {
    it.each([400, 422])('%i는 URL 자체의 문제다', status => {
        expect(isUrlRejectionStatus(status)).toBe(true);
    });

    it.each([401, 403, 404, 429, 500])('%i는 URL 문제가 아니다', status => {
        expect(isUrlRejectionStatus(status)).toBe(false);
    });
});
