import { describe, it, expect } from 'vitest';
import { FmpHttpError } from '../FmpHttpError';

describe('FmpHttpError — 심볼 귀속(2026-07-26 관측성 개선)', () => {
    it('심볼이 있으면 메시지에 포함해 로그에서 귀속이 된다', () => {
        const e = new FmpHttpError(
            'historical-price-eod/full',
            402,
            null,
            'SKHY'
        );
        expect(e.message).toBe('FMP historical-price-eod/full 402 (SKHY)');
        expect(e.symbol).toBe('SKHY');
    });

    it('심볼이 없으면 기존 메시지 형식을 그대로 유지한다(하위 호환)', () => {
        const e = new FmpHttpError('profile', 429, null);
        expect(e.message).toBe('FMP profile 429');
        expect(e.symbol).toBeNull();
    });

    it('status·retryAfterSeconds 기존 계약은 변하지 않는다', () => {
        const e = new FmpHttpError('quote', 429, 30, 'AAPL');
        expect(e.status).toBe(429);
        expect(e.retryAfterSeconds).toBe(30);
        expect(e.name).toBe('FmpHttpError');
    });
});
