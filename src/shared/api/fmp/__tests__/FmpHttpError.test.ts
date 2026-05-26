import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';

describe('FmpHttpError', () => {
    it('status와 retryAfterSeconds를 저장한다', () => {
        const err = new FmpHttpError('profile', 429, 30);
        expect(err.status).toBe(429);
        expect(err.retryAfterSeconds).toBe(30);
    });

    it('메시지 형식이 `FMP ${path} ${status}`이다', () => {
        const err = new FmpHttpError('profile', 404, null);
        expect(err.message).toBe('FMP profile 404');
    });

    it('name 프로퍼티가 "FmpHttpError"이다', () => {
        const err = new FmpHttpError('quote', 500, null);
        expect(err.name).toBe('FmpHttpError');
    });

    it('retryAfterSeconds가 제공되지 않으면 null이다', () => {
        const err = new FmpHttpError('stock-list', 503, null);
        expect(err.retryAfterSeconds).toBeNull();
    });

    it('Error를 상속한다', () => {
        const err = new FmpHttpError('profile', 500, null);
        expect(err).toBeInstanceOf(Error);
    });
});
