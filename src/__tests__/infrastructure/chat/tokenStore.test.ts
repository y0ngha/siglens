import { hashIp, tryConsumeToken, getRemainingTokens } from '@/infrastructure/chat/tokenStore';

jest.mock('@upstash/redis');
import { Redis } from '@upstash/redis';

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

const mockIncr = jest.fn();
const mockExpire = jest.fn();
const mockGet = jest.fn();

describe('hashIp 함수는', () => {
    it('동일한 IP에 대해 항상 동일한 해시를 반환한다', () => {
        expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
    });

    it('서로 다른 IP는 다른 해시를 반환한다', () => {
        expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'));
    });

    it('64자 hex 문자열을 반환한다 (SHA-256)', () => {
        expect(hashIp('1.2.3.4')).toHaveLength(64);
        expect(hashIp('1.2.3.4')).toMatch(/^[0-9a-f]+$/);
    });
});

describe('tryConsumeToken 함수는', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'master-token';
        MockRedis.mockImplementation(
            () => ({ incr: mockIncr, expire: mockExpire, get: mockGet }) as unknown as Redis
        );
    });

    afterEach(() => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('첫 번째 호출 시 TTL을 설정하고 true를 반환한다', async () => {
        mockIncr.mockResolvedValueOnce(1);
        mockExpire.mockResolvedValueOnce(1);

        const result = await tryConsumeToken('abc123');

        expect(mockExpire).toHaveBeenCalledWith('chat:tokens:abc123', 86400);
        expect(result).toBe(true);
    });

    it('한도 내 호출은 true를 반환한다', async () => {
        mockIncr.mockResolvedValueOnce(5); // 5번째 호출
        mockExpire.mockResolvedValueOnce(1);

        const result = await tryConsumeToken('abc123');
        expect(result).toBe(true);
    });

    it('한도 초과 호출은 false를 반환한다', async () => {
        mockIncr.mockResolvedValueOnce(6); // 6번째 호출 (한도 5 초과)

        const result = await tryConsumeToken('abc123');
        expect(result).toBe(false);
    });

    it('Redis가 없으면 true를 반환한다 (graceful degradation)', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;

        const result = await tryConsumeToken('abc123');
        expect(result).toBe(true);
        expect(mockIncr).not.toHaveBeenCalled();
    });

    it('Redis 오류 시 true를 반환한다 (통과 처리)', async () => {
        mockIncr.mockRejectedValueOnce(new Error('connection failed'));

        const result = await tryConsumeToken('abc123');
        expect(result).toBe(true);
    });
});

describe('getRemainingTokens 함수는', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'master-token';
        MockRedis.mockImplementation(
            () => ({ incr: mockIncr, expire: mockExpire, get: mockGet }) as unknown as Redis
        );
    });

    afterEach(() => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('키가 없으면 최대 토큰 수(5)를 반환한다', async () => {
        mockGet.mockResolvedValueOnce(null);

        const result = await getRemainingTokens('abc123');
        expect(result).toBe(5);
    });

    it('2회 사용한 경우 3을 반환한다', async () => {
        mockGet.mockResolvedValueOnce(2);

        const result = await getRemainingTokens('abc123');
        expect(result).toBe(3);
    });

    it('5회 이상 사용한 경우 0을 반환한다', async () => {
        mockGet.mockResolvedValueOnce(7);

        const result = await getRemainingTokens('abc123');
        expect(result).toBe(0);
    });
});
