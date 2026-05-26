import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import {
    isFmpTransientError,
    extractRetryAfterMs,
    FMP_TRANSIENT_RETRY,
} from '@/shared/api/fmp/fmpRetry';

describe('isFmpTransientError', () => {
    describe('FmpHttpError', () => {
        it.each([429, 500, 502, 503])('status %i는 true를 반환한다', status => {
            expect(
                isFmpTransientError(new FmpHttpError('profile', status, null))
            ).toBe(true);
        });

        it.each([400, 401, 403, 404])(
            'status %i는 false를 반환한다',
            status => {
                expect(
                    isFmpTransientError(
                        new FmpHttpError('profile', status, null)
                    )
                ).toBe(false);
            }
        );
    });

    it('TypeError는 true를 반환한다', () => {
        expect(isFmpTransientError(new TypeError('fetch failed'))).toBe(true);
    });

    it('DOMException은 true를 반환한다', () => {
        expect(
            isFmpTransientError(new DOMException('aborted', 'AbortError'))
        ).toBe(true);
    });

    it('일반 Error는 false를 반환한다', () => {
        expect(isFmpTransientError(new Error('something went wrong'))).toBe(
            false
        );
    });

    it('null은 false를 반환한다', () => {
        expect(isFmpTransientError(null)).toBe(false);
    });

    it('string은 false를 반환한다', () => {
        expect(isFmpTransientError('error')).toBe(false);
    });
});

describe('extractRetryAfterMs', () => {
    it('FmpHttpError의 retryAfterSeconds를 ms로 변환해 반환한다', () => {
        const err = new FmpHttpError('profile', 429, 30);
        expect(extractRetryAfterMs(err)).toBe(30_000);
    });

    it('retryAfterSeconds가 null이면 null을 반환한다', () => {
        const err = new FmpHttpError('profile', 429, null);
        expect(extractRetryAfterMs(err)).toBeNull();
    });

    it('FmpHttpError가 아니면 null을 반환한다', () => {
        expect(extractRetryAfterMs(new Error('oops'))).toBeNull();
        expect(extractRetryAfterMs(new TypeError('fetch failed'))).toBeNull();
        expect(extractRetryAfterMs(null)).toBeNull();
    });
});

describe('FMP_TRANSIENT_RETRY', () => {
    it('예상 shape을 가진다', () => {
        expect(FMP_TRANSIENT_RETRY.maxRetries).toBe(3);
        expect(FMP_TRANSIENT_RETRY.baseDelayMs).toBe(500);
        expect(FMP_TRANSIENT_RETRY.isRetryable).toBe(isFmpTransientError);
        expect(FMP_TRANSIENT_RETRY.backoffBudgetMs).toBe(8000);
    });

    it('getRetryDelayMs가 FmpHttpError의 retryAfterSeconds를 ms로 변환한다', () => {
        const getRetryDelayMs = FMP_TRANSIENT_RETRY.getRetryDelayMs!;
        const err = new FmpHttpError('profile', 429, 60);
        expect(getRetryDelayMs(err)).toBe(60_000);
    });

    it('getRetryDelayMs가 FmpHttpError가 아니면 null을 반환한다', () => {
        const getRetryDelayMs = FMP_TRANSIENT_RETRY.getRetryDelayMs!;
        expect(getRetryDelayMs(new TypeError('fetch failed'))).toBeNull();
    });
});
