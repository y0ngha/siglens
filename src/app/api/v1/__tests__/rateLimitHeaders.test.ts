const { mockConsume } = vi.hoisted(() => ({ mockConsume: vi.fn() }));
vi.mock('@/entities/siglens-api-key/server/rateLimit', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/siglens-api-key/server/rateLimit')
    >('@/entities/siglens-api-key/server/rateLimit');
    return { ...actual, consumeRateLimit: mockConsume };
});

import {
    enforceRateLimit,
    prefixRateLimitHeaders,
    rateLimitHeaders,
} from '@/app/api/v1/rateLimitHeaders';
import type { RateLimitVerdict } from '@/entities/siglens-api-key/lib/rateLimitWindow';
import { RateLimiterUnavailableError } from '@/entities/siglens-api-key/server/rateLimit';

const allowed: RateLimitVerdict = {
    allowed: true,
    window: 'minute',
    limit: 60,
    remaining: 41,
    resetAtEpochSeconds: 1_792_000_020,
    retryAfterSeconds: 24,
};
const denied: RateLimitVerdict = {
    allowed: false,
    window: 'minute',
    limit: 60,
    remaining: 0,
    resetAtEpochSeconds: 1_792_000_020,
    retryAfterSeconds: 24,
};

describe('rateLimitHeaders', () => {
    it('X-RateLimit-Limit/Remaining/Reset 세 개를 문자열로 만든다', () => {
        expect(rateLimitHeaders(allowed)).toEqual({
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': '41',
            'X-RateLimit-Reset': '1792000020',
        });
    });
});

describe('prefixRateLimitHeaders', () => {
    it('X-RateLimit-*에 버킷 접두를 붙이고 다른 헤더는 버린다', () => {
        expect(
            prefixRateLimitHeaders(
                {
                    ...rateLimitHeaders(allowed),
                    'Retry-After': '9',
                },
                'AI'
            )
        ).toEqual({
            'X-RateLimit-AI-Limit': '60',
            'X-RateLimit-AI-Remaining': '41',
            'X-RateLimit-AI-Reset': '1792000020',
        });
    });
});

describe('enforceRateLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('허용이면 헤더만 돌려준다', async () => {
        mockConsume.mockResolvedValue(allowed);
        const outcome = await enforceRateLimit('key-1', 'data');
        expect(outcome).toEqual({
            ok: true,
            headers: rateLimitHeaders(allowed),
        });
        expect(mockConsume).toHaveBeenCalledWith('key-1', 'data');
    });

    it('초과이면 429 + Retry-After + 한도 헤더', async () => {
        mockConsume.mockResolvedValue(denied);
        const outcome = await enforceRateLimit('key-1', 'data');
        if (outcome.ok) throw new Error('expected failure');
        const { response } = outcome;
        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('24');
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
        expect(response.headers.get('X-RateLimit-Reset')).toBe('1792000020');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        const body = (await response.json()) as {
            error: { code: string; message: string };
        };
        expect(body.error.code).toBe('rate_limited');
        expect(body.error.message).toContain('24 seconds');
    });

    it('일 창 거절은 일 창 값을 헤더에 싣는다', async () => {
        mockConsume.mockResolvedValue({
            ...denied,
            window: 'day',
            limit: 3000,
            resetAtEpochSeconds: 1_792_022_400,
            retryAfterSeconds: 22_380,
        });
        const outcome = await enforceRateLimit('key-1', 'data');
        if (outcome.ok) throw new Error('expected failure');
        expect(outcome.response.headers.get('X-RateLimit-Limit')).toBe('3000');
        expect(outcome.response.headers.get('Retry-After')).toBe('22380');
    });

    it('한도 저장소 장애는 fail-open이 아니라 503 rate_limiter_unavailable', async () => {
        mockConsume.mockRejectedValue(new RateLimiterUnavailableError());
        const outcome = await enforceRateLimit('key-1', 'data');
        if (outcome.ok) throw new Error('expected failure');
        expect(outcome.response.status).toBe(503);
        expect(outcome.response.headers.get('Retry-After')).toBe('30');
        await expect(outcome.response.json()).resolves.toMatchObject({
            error: { code: 'rate_limiter_unavailable' },
        });
    });

    it('예상 밖 오류는 삼키지 않고 다시 던진다', async () => {
        mockConsume.mockRejectedValue(new TypeError('boom'));
        await expect(enforceRateLimit('key-1', 'data')).rejects.toThrow('boom');
    });
});
