vi.mock('server-only', () => ({}));

const { mockSet, mockGetdel, mockRedis } = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockGetdel = vi.fn();
    const mockRedis: Pick<import('@upstash/redis').Redis, 'set' | 'getdel'> = {
        set: mockSet,
        getdel: mockGetdel,
    };
    return { mockSet, mockGetdel, mockRedis };
});

const { mockCommand } = vi.hoisted(() => ({ mockCommand: vi.fn() }));

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
    getUpstashWriterCredentials: vi.fn(() => ({
        url: 'https://example.upstash.io',
        token: 'w',
    })),
}));

vi.mock('@/shared/cache/upstashRenderSafeCommand', () => ({
    runUpstashCommandOutsideFetch: mockCommand,
}));

import { SECONDS_PER_DAY } from '@/shared/config/time';
import {
    getRedisClient,
    getUpstashWriterCredentials,
} from '@/shared/cache/redisClient';
import { consumeSsrMiss, markSsrMiss } from '../ssrMissMarker';

type RedisLike = import('@upstash/redis').Redis;

describe('ssrMissMarker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as RedisLike
        );
        vi.mocked(getUpstashWriterCredentials).mockReturnValue({
            url: 'https://example.upstash.io',
            token: 'w',
        });
    });

    describe('markSsrMiss', () => {
        it('ssr-miss:{tag} 키에 2일 EX로 표시를 SET한다', async () => {
            mockCommand.mockResolvedValue('OK');

            await markSsrMiss('economy:briefing');

            expect(mockCommand).toHaveBeenCalledWith([
                'SET',
                'ssr-miss:economy:briefing',
                '1',
                'EX',
                2 * SECONDS_PER_DAY,
            ]);
        });

        // 호출부는 정적(ISR) 렌더 안이다. 패키지 클라이언트(전역 fetch, no-store)로 쓰면
        // 재생성이 "static to dynamic"으로 실패한다(v0.96.0 /en/news 500).
        it('패키지 클라이언트(전역 fetch)가 아니라 렌더 안전 경로로 쓴다', async () => {
            mockCommand.mockResolvedValue('OK');

            await markSsrMiss('t');

            expect(mockSet).not.toHaveBeenCalled();
            expect(mockCommand).toHaveBeenCalledTimes(1);
        });

        it('Redis가 없으면 noop이다', async () => {
            vi.mocked(getUpstashWriterCredentials).mockReturnValue(null);

            await expect(markSsrMiss('t')).resolves.toBeUndefined();
            expect(mockCommand).not.toHaveBeenCalled();
        });

        it('SET이 던져도 로그만 남기고 던지지 않는다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockCommand.mockRejectedValue(new Error('redis down'));

            await expect(markSsrMiss('t')).resolves.toBeUndefined();

            expect(errorSpy).toHaveBeenCalledWith(
                '[ssrMissMarker] set failed',
                expect.any(Error)
            );
            errorSpy.mockRestore();
        });
    });

    describe('consumeSsrMiss', () => {
        it('getdel로 읽기와 지우기를 한 번에 한다 — 있으면 true, 다시 부르면 false', async () => {
            mockGetdel.mockResolvedValueOnce('1').mockResolvedValueOnce(null);

            await expect(consumeSsrMiss('t')).resolves.toBe(true);
            await expect(consumeSsrMiss('t')).resolves.toBe(false);

            expect(mockGetdel).toHaveBeenCalledTimes(2);
            expect(mockGetdel).toHaveBeenCalledWith('ssr-miss:t');
        });

        it('Redis가 없으면 false다', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);

            await expect(consumeSsrMiss('t')).resolves.toBe(false);
            expect(mockGetdel).not.toHaveBeenCalled();
        });

        it('getdel이 던지면 로그를 남기고 false — 털지 않는 쪽이 안전하다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockGetdel.mockRejectedValue(new Error('redis down'));

            await expect(consumeSsrMiss('t')).resolves.toBe(false);

            expect(errorSpy).toHaveBeenCalledWith(
                '[ssrMissMarker] getdel failed',
                expect.any(Error)
            );
            errorSpy.mockRestore();
        });
    });
});
