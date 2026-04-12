import { createJobRedis } from '@/infrastructure/jobs/redis';

jest.mock('@upstash/redis');

import { Redis } from '@upstash/redis';

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('createJobRedis 함수는', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetAllMocks();
        process.env = { ...originalEnv };
        MockRedis.mockImplementation(
            () =>
                ({
                    get: jest.fn(),
                    set: jest.fn(),
                    del: jest.fn(),
                }) as unknown as Redis
        );
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('환경변수가 없을 때', () => {
        it('URL이 없으면 null을 반환한다', () => {
            delete process.env.UPSTASH_REDIS_REST_URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

            const result = createJobRedis();

            expect(result).toBeNull();
            expect(MockRedis).not.toHaveBeenCalled();
        });

        it('TOKEN이 없으면 null을 반환한다', () => {
            process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
            delete process.env.UPSTASH_REDIS_REST_TOKEN;

            const result = createJobRedis();

            expect(result).toBeNull();
            expect(MockRedis).not.toHaveBeenCalled();
        });
    });

    describe('환경변수가 설정되었을 때', () => {
        it('Redis 인스턴스를 반환한다', () => {
            process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
            process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

            const result = createJobRedis();

            expect(result).not.toBeNull();
            expect(MockRedis).toHaveBeenCalledWith({
                url: 'https://redis.test',
                token: 'test-token',
            });
        });
    });
});
