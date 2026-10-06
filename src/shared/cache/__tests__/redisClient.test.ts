const { mockRedisConstructor } = vi.hoisted(() => ({
    mockRedisConstructor: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (opts: unknown) {
        mockRedisConstructor(opts);
        return { __opts: opts };
    }),
}));

import {
    getRedisClient,
    getRedisReaderWriter,
    __resetRedisClientForTests,
    getUpstashWriterCredentials,
    REDIS_COMMAND_TIMEOUT_MS,
    REDIS_LONG_COMMAND_TIMEOUT_MS,
} from '@/shared/cache/redisClient';
import { __resetOfflineBuildWarningsForTests } from '@/shared/api/offlineBuild';
import { runAsBatchWork } from '@/shared/lib/renderBudget';

const URL = 'https://test.upstash.io';
const TOKEN = 'writer-token';
const RO = 'readonly-token';

describe('redisClient', () => {
    beforeEach(() => {
        __resetRedisClientForTests();
        mockRedisConstructor.mockClear();
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
        delete process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    });

    describe('getRedisClient', () => {
        it('env 미설정 시 null을 반환하고 Redis를 생성하지 않는다', () => {
            expect(getRedisClient()).toBeNull();
            expect(mockRedisConstructor).not.toHaveBeenCalled();
        });

        it('env 설정 시 반복 호출이 동일 인스턴스를 반환한다(싱글톤)', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            const a = getRedisClient();
            const b = getRedisClient();
            expect(a).not.toBeNull();
            expect(a).toBe(b);
            expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
            expect(mockRedisConstructor).toHaveBeenCalledWith(
                expect.objectContaining({ url: URL, token: TOKEN })
            );
        });
    });

    describe('timeout·재시도 옵션', () => {
        it('writer·reader 모두 재시도 1회와 명령마다 새 timeout signal을 받는다', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            process.env.UPSTASH_REDIS_REST_READONLY_TOKEN = RO;
            getRedisReaderWriter();

            expect(mockRedisConstructor).toHaveBeenCalledTimes(2);
            for (const [opts] of mockRedisConstructor.mock.calls) {
                const { retry, signal } = opts as {
                    retry: { retries: number };
                    signal: () => AbortSignal;
                };
                expect(retry).toEqual({ retries: 1 });
                // 함수여야 한다 — signal 하나를 공유하면 첫 timeout 뒤 모든 명령이 abort된다.
                expect(typeof signal).toBe('function');
                expect(signal()).not.toBe(signal());
            }
        });
    });

    describe('배치 컨텍스트(runAsBatchWork)', () => {
        it('배치는 긴 timeout의 별도 클라이언트를 받는다 — 요청 경로 클라이언트와 섞이지 않는다', async () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

            const request = getRedisClient();
            const batch = await runAsBatchWork(async () => getRedisClient());
            expect(batch).not.toBe(request);
            // 배치 안의 반복 호출은 같은 싱글턴이다.
            await expect(
                runAsBatchWork(async () => getRedisClient())
            ).resolves.toBe(batch);

            const [[requestOpts], [batchOpts]] = mockRedisConstructor.mock
                .calls as [
                [{ signal: () => AbortSignal }],
                [{ signal: () => AbortSignal }],
            ];
            requestOpts.signal();
            batchOpts.signal();
            expect(timeoutSpy.mock.calls.map(([ms]) => ms)).toEqual([
                REDIS_COMMAND_TIMEOUT_MS,
                REDIS_LONG_COMMAND_TIMEOUT_MS,
            ]);
            timeoutSpy.mockRestore();
        });
    });

    describe('getUpstashWriterCredentials', () => {
        it('env 미설정 시 null', () => {
            expect(getUpstashWriterCredentials()).toBeNull();
        });

        // 렌더 안전 경로(node:https)는 쓰기 토큰을 써야 한다 — 읽기 전용 토큰이 있어도.
        it('읽기 전용 토큰이 있어도 쓰기 토큰을 돌려준다', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            process.env.UPSTASH_REDIS_REST_READONLY_TOKEN = 'readonly';
            expect(getUpstashWriterCredentials()).toEqual({
                url: URL,
                token: TOKEN,
            });
        });
    });

    describe('getRedisReaderWriter', () => {
        it('env 미설정 시 null', () => {
            expect(getRedisReaderWriter()).toBeNull();
        });

        it('readonly token 미설정 시 reader === writer 이고 writer === getRedisClient()', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            const pair = getRedisReaderWriter();
            expect(pair).not.toBeNull();
            expect(pair!.reader).toBe(pair!.writer);
            expect(pair!.writer).toBe(getRedisClient());
            expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
        });

        it('readonly token 설정 시 reader는 별도 인스턴스(readonly 토큰)', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            process.env.UPSTASH_REDIS_REST_READONLY_TOKEN = RO;
            const pair = getRedisReaderWriter();
            expect(pair!.reader).not.toBe(pair!.writer);
            expect(pair!.writer).toBe(getRedisClient());
            expect(mockRedisConstructor).toHaveBeenCalledTimes(2);
            expect(mockRedisConstructor).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ url: URL, token: TOKEN })
            );
            expect(mockRedisConstructor).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ url: URL, token: RO })
            );
        });

        it('빈 문자열 readonly token은 미설정으로 취급한다(reader === writer)', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            process.env.UPSTASH_REDIS_REST_READONLY_TOKEN = '';
            const pair = getRedisReaderWriter();
            expect(pair!.reader).toBe(pair!.writer);
        });

        it('두 번 호출해도 Redis constructor가 추가로 호출되지 않는다(reader 싱글톤 히트)', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            process.env.UPSTASH_REDIS_REST_READONLY_TOKEN = RO;
            const first = getRedisReaderWriter();
            const second = getRedisReaderWriter();
            expect(mockRedisConstructor).toHaveBeenCalledTimes(2); // writer + reader, once each
            expect(first!.reader).toBe(second!.reader);
            expect(first!.writer).toBe(second!.writer);
        });
    });

    describe('offline build 가드', () => {
        beforeEach(() => {
            __resetOfflineBuildWarningsForTests();
        });

        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('env가 설정돼 있어도 offline build 중이면 null을 반환하고 Redis를 생성하지 않는다', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');

            expect(getRedisClient()).toBeNull();
            expect(getRedisReaderWriter()).toBeNull();
            expect(mockRedisConstructor).not.toHaveBeenCalled();
        });

        it('offline build 판정은 캐시된 env보다 먼저 평가되어 이후 호출에도 유지된다', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');

            expect(getRedisClient()).toBeNull();
            expect(getRedisClient()).toBeNull();
            expect(mockRedisConstructor).not.toHaveBeenCalled();
        });

        it('SIGLENS_OFFLINE_BUILD가 미설정이면 평소대로 동작한다', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');

            expect(getRedisClient()).not.toBeNull();
            expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
        });
    });
});
