import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import {
    FMP_RATE_LIMIT_RETRY_DELAYS_MS,
    isFmpTransientError,
    extractRetryAfterMs,
    getFmpRateLimitRetryDelayMs,
    getFmpRetryDelayMs,
    FMP_TRANSIENT_RETRY,
} from '@/shared/api/fmp/fmpRetry';

describe('isFmpTransientError 함수는', () => {
    describe('FmpHttpError를 받을 때', () => {
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

    describe('네트워크 오류를 받을 때', () => {
        it('TypeError는 true를 반환한다', () => {
            expect(isFmpTransientError(new TypeError('fetch failed'))).toBe(
                true
            );
        });

        it('DOMException은 true를 반환한다', () => {
            expect(
                isFmpTransientError(new DOMException('aborted', 'AbortError'))
            ).toBe(true);
        });
    });

    describe('기타 값을 받을 때', () => {
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

        it('undefined는 false를 반환한다', () => {
            expect(isFmpTransientError(undefined)).toBe(false);
        });
    });
});

describe('extractRetryAfterMs 함수는', () => {
    describe('FmpHttpError를 받을 때', () => {
        it('retryAfterSeconds를 ms로 변환해 반환한다', () => {
            const err = new FmpHttpError('profile', 429, 30);
            expect(extractRetryAfterMs(err)).toBe(30_000);
        });

        it('retryAfterSeconds가 null이면 null을 반환한다', () => {
            const err = new FmpHttpError('profile', 429, null);
            expect(extractRetryAfterMs(err)).toBeNull();
        });
    });

    describe('FmpHttpError가 아닌 값을 받을 때', () => {
        it('일반 Error는 null을 반환한다', () => {
            expect(extractRetryAfterMs(new Error('oops'))).toBeNull();
        });

        it('TypeError는 null을 반환한다', () => {
            expect(
                extractRetryAfterMs(new TypeError('fetch failed'))
            ).toBeNull();
        });

        it('null은 null을 반환한다', () => {
            expect(extractRetryAfterMs(null)).toBeNull();
        });

        it('undefined는 null을 반환한다', () => {
            expect(extractRetryAfterMs(undefined)).toBeNull();
        });
    });
});

describe('FMP_TRANSIENT_RETRY 설정은', () => {
    describe('기본 shape에서', () => {
        it('예상 shape을 가진다', () => {
            expect(FMP_TRANSIENT_RETRY.maxRetries).toBe(3);
            expect(FMP_TRANSIENT_RETRY.baseDelayMs).toBe(500);
            expect(FMP_TRANSIENT_RETRY.isRetryable).toBe(isFmpTransientError);
            expect(FMP_TRANSIENT_RETRY.backoffBudgetMs).toBe(60_000);
            expect(FMP_TRANSIENT_RETRY.getRetryDelayMs).toBe(
                getFmpRetryDelayMs
            );
        });
    });

    describe('getRetryDelayMs 동작에서', () => {
        it('FmpHttpError의 retryAfterSeconds를 ms로 변환한다', () => {
            const getRetryDelayMs = FMP_TRANSIENT_RETRY.getRetryDelayMs!;
            const err = new FmpHttpError('profile', 429, 60);
            expect(getRetryDelayMs(err, 0)).toBe(60_000);
        });

        it('429에 Retry-After가 없으면 10s → 15s → 20s 스케줄을 반환한다', () => {
            const err = new FmpHttpError('profile', 429, null);

            expect(FMP_RATE_LIMIT_RETRY_DELAYS_MS).toEqual([
                10_000, 15_000, 20_000,
            ]);
            expect(getFmpRateLimitRetryDelayMs(0)).toBe(10_000);
            expect(getFmpRateLimitRetryDelayMs(1)).toBe(15_000);
            expect(getFmpRateLimitRetryDelayMs(2)).toBe(20_000);
            expect(FMP_TRANSIENT_RETRY.getRetryDelayMs?.(err, 0)).toBe(10_000);
            expect(FMP_TRANSIENT_RETRY.getRetryDelayMs?.(err, 1)).toBe(15_000);
            expect(FMP_TRANSIENT_RETRY.getRetryDelayMs?.(err, 2)).toBe(20_000);
        });

        it('FmpHttpError가 아니면 null을 반환한다', () => {
            const getRetryDelayMs = FMP_TRANSIENT_RETRY.getRetryDelayMs!;
            expect(
                getRetryDelayMs(new TypeError('fetch failed'), 0)
            ).toBeNull();
        });
    });
});
