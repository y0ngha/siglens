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
} from '@/shared/cache/redisClient';

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
            expect(mockRedisConstructor).toHaveBeenCalledWith({
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
            expect(mockRedisConstructor).toHaveBeenNthCalledWith(1, {
                url: URL,
                token: TOKEN,
            });
            expect(mockRedisConstructor).toHaveBeenNthCalledWith(2, {
                url: URL,
                token: RO,
            });
        });

        it('빈 문자열 readonly token은 미설정으로 취급한다(reader === writer)', () => {
            process.env.UPSTASH_REDIS_REST_URL = URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
            process.env.UPSTASH_REDIS_REST_READONLY_TOKEN = '';
            const pair = getRedisReaderWriter();
            expect(pair!.reader).toBe(pair!.writer);
        });
    });
});
