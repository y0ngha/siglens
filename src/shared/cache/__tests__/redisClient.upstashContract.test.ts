import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    REDIS_COMMAND_TIMEOUT_MS,
    __resetRedisClientForTests,
    getRedisClient,
} from '@/shared/cache/redisClient';

/**
 * `redisClient`가 거는 timeout·재시도가 **실제** `@upstash/redis` 클라이언트에서 그대로
 * 동작하는지 고정한다(TESTING.md#TE-8 — 목 클라이언트로는
 * 옵션 전달만 보일 뿐 패키지가 그 옵션을 어떻게 쓰는지는 검증되지 않는다).
 *
 * fetch만 스텁하고 클라이언트는 진짜를 쓴다. `AbortSignal.timeout`은 테스트가 직접 abort할
 * 수 있는 signal로 바꿔 실제 2초를 기다리지 않는다.
 */
const URL = 'https://contract-test.upstash.io';

describe('redisClient × @upstash/redis 계약', () => {
    beforeEach(() => {
        __resetRedisClientForTests();
        process.env.UPSTASH_REDIS_REST_URL = URL;
        process.env.UPSTASH_REDIS_REST_TOKEN = 'contract-test-token';
        delete process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetRedisClientForTests();
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('응답이 오지 않으면 timeout signal로 명령이 reject된다 — 무한 대기하지 않는다', async () => {
        const controller = new AbortController();
        const timeoutSpy = vi
            .spyOn(AbortSignal, 'timeout')
            .mockReturnValue(controller.signal);
        // abort될 때까지 끝나지 않는 fetch(실제 fetch처럼 signal abort에 reject로 반응한다).
        const fetchMock = vi.fn(
            (_input: RequestInfo | URL, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    const signal = init?.signal;
                    // 자동 파이프라이닝이 요청을 다음 tick으로 미루므로 이미 abort됐을 수 있다.
                    if (signal?.aborted) return reject(signal.reason);
                    signal?.addEventListener('abort', () =>
                        reject(signal.reason)
                    );
                })
        );
        vi.stubGlobal('fetch', fetchMock);

        const pending = getRedisClient()!.get('k');
        controller.abort(new DOMException('timed out', 'TimeoutError'));

        await expect(pending).rejects.toThrow('timed out');
        expect(timeoutSpy).toHaveBeenCalledWith(REDIS_COMMAND_TIMEOUT_MS);
        // timeout은 재시도하지 않는다 — 상한이 재시도까지 합친 시간이다.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('네트워크 오류는 1회만 재시도하고 던진다(기본 5회 아님)', async () => {
        const fetchMock = vi.fn(() =>
            Promise.reject(new TypeError('fetch failed'))
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(getRedisClient()!.get('k')).rejects.toThrow(
            'fetch failed'
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('정상 응답은 그대로 돌려준다', async () => {
        const result = Buffer.from('"v"').toString('base64');
        vi.stubGlobal(
            'fetch',
            // 기본 옵션은 자동 파이프라이닝이라 단일 명령도 `/pipeline`으로 간다.
            vi.fn(async (input: RequestInfo | URL) =>
                Response.json(
                    String(input).endsWith('/pipeline')
                        ? [{ result }]
                        : { result }
                )
            )
        );

        await expect(getRedisClient()!.get('k')).resolves.toBe('v');
    });
});
