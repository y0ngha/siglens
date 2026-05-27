import {
    isCoreFmpTransientError,
    getCoreFmpRetryDelayMs,
    BARS_FMP_RETRY,
} from '../lib/barsRetry';

describe('isCoreFmpTransientError 함수는', () => {
    describe('siglens-core FMP 에러 메시지를 받을 때', () => {
        it.each([429, 500, 502, 503])(
            'status %i 메시지는 true를 반환한다',
            status => {
                expect(
                    isCoreFmpTransientError(
                        new Error(`FMP API error: ${status} ...`)
                    )
                ).toBe(true);
            }
        );

        it.each([400, 401, 402, 403, 404])(
            'status %i 메시지는 false를 반환한다',
            status => {
                expect(
                    isCoreFmpTransientError(
                        new Error(`FMP API error: ${status} ...`)
                    )
                ).toBe(false);
            }
        );
    });

    describe('네트워크 오류를 받을 때', () => {
        it('TypeError는 true를 반환한다', () => {
            expect(isCoreFmpTransientError(new TypeError('fetch failed'))).toBe(
                true
            );
        });
    });

    describe('기타 값을 받을 때', () => {
        it('일반 Error는 false를 반환한다', () => {
            expect(isCoreFmpTransientError(new Error('unknown'))).toBe(false);
        });

        it('null은 false를 반환한다', () => {
            expect(isCoreFmpTransientError(null)).toBe(false);
        });
    });
});

describe('getCoreFmpRetryDelayMs 함수는', () => {
    describe('429 에러를 받을 때', () => {
        it('attempt 0은 10초를 반환한다', () => {
            const error = new Error('FMP API error: 429 Too Many Requests');
            expect(getCoreFmpRetryDelayMs(error, 0)).toBe(10_000);
        });

        it('attempt 1은 15초를 반환한다', () => {
            const error = new Error('FMP API error: 429 Too Many Requests');
            expect(getCoreFmpRetryDelayMs(error, 1)).toBe(15_000);
        });

        it('attempt 2는 20초를 반환한다', () => {
            const error = new Error('FMP API error: 429 Too Many Requests');
            expect(getCoreFmpRetryDelayMs(error, 2)).toBe(20_000);
        });
    });

    describe('429가 아닌 에러를 받을 때', () => {
        it('500 에러는 null을 반환한다', () => {
            const error = new Error('FMP API error: 500 Internal Server Error');
            expect(getCoreFmpRetryDelayMs(error, 0)).toBeNull();
        });

        it('TypeError는 null을 반환한다', () => {
            expect(
                getCoreFmpRetryDelayMs(new TypeError('fetch failed'), 0)
            ).toBeNull();
        });
    });
});

describe('BARS_FMP_RETRY 설정은', () => {
    describe('기본 shape에서', () => {
        it('예상 shape을 가진다', () => {
            expect(BARS_FMP_RETRY.maxRetries).toBe(3);
            expect(BARS_FMP_RETRY.baseDelayMs).toBe(500);
            expect(BARS_FMP_RETRY.backoffBudgetMs).toBe(60_000);
            expect(BARS_FMP_RETRY.isRetryable).toBe(isCoreFmpTransientError);
            expect(BARS_FMP_RETRY.getRetryDelayMs).toBe(getCoreFmpRetryDelayMs);
        });
    });
});
