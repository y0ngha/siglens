import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import {
    FMP_PAYMENT_REQUIRED_LOG_PREFIX,
    FMP_TEMPORARY_UNAVAILABLE_MESSAGE,
    getFmpPaymentRequiredLogMessage,
    getFmpErrorStatus,
    getFmpUserFacingMessage,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';

describe('getFmpErrorStatus 함수는', () => {
    describe('FMP 에러를 받으면', () => {
        it('FmpHttpError에서 상태 코드를 읽는다', () => {
            expect(
                getFmpErrorStatus(new FmpHttpError('profile', 429, null))
            ).toBe(429);
        });

        it('siglens-core FMP 에러 메시지에서 상태 코드를 읽는다', () => {
            expect(
                getFmpErrorStatus(
                    new Error('FMP API error: 429 Too Many Requests')
                )
            ).toBe(429);
        });

        it('shared FMP HTTP 클라이언트 에러 메시지에서 상태 코드를 읽는다', () => {
            expect(getFmpErrorStatus(new Error('FMP profile 500'))).toBe(500);
        });
    });

    describe('비 FMP 에러를 받으면', () => {
        it('null을 반환한다', () => {
            expect(getFmpErrorStatus(new Error('network error'))).toBeNull();
        });
    });
});

describe('getFmpUserFacingMessage 함수는', () => {
    describe('일시 장애 상태 코드에서', () => {
        it.each([429, 500, 503])(
            '상태 코드 %i는 안내 문구로 매핑한다',
            status => {
                expect(
                    getFmpUserFacingMessage(
                        new FmpHttpError('profile', status, null)
                    )
                ).toBe(FMP_TEMPORARY_UNAVAILABLE_MESSAGE);
            }
        );
    });

    describe('비 일시 장애 상태 코드에서', () => {
        it.each([400, 402, 404])('상태 코드 %i는 null을 반환한다', status => {
            expect(
                getFmpUserFacingMessage(
                    new FmpHttpError('profile', status, null)
                )
            ).toBeNull();
        });
    });
});

describe('isFmpPaymentRequiredError 함수는', () => {
    describe('402 에러를 받으면', () => {
        it('true를 반환한다', () => {
            expect(
                isFmpPaymentRequiredError(
                    new Error('FMP API error: 402 Payment Required')
                )
            ).toBe(true);
        });
    });

    describe('402가 아닌 에러를 받으면', () => {
        it('false를 반환한다', () => {
            expect(
                isFmpPaymentRequiredError(
                    new Error('FMP API error: 429 Too Many Requests')
                )
            ).toBe(false);
        });
    });
});

describe('getFmpPaymentRequiredLogMessage 함수는', () => {
    describe('402 에러를 받으면', () => {
        it('비용 예외 로그 문구로 변환한다', () => {
            expect(
                getFmpPaymentRequiredLogMessage(
                    new Error('FMP API error: 402 Payment Required')
                )
            ).toBe(
                `${FMP_PAYMENT_REQUIRED_LOG_PREFIX} Error: FMP API error: 402 Payment Required`
            );
        });
    });

    describe('402가 아닌 에러를 받으면', () => {
        it('null을 반환한다', () => {
            expect(
                getFmpPaymentRequiredLogMessage(
                    new Error('FMP API error: 429 Too Many Requests')
                )
            ).toBeNull();
        });
    });
});

describe('logFmpPaymentRequiredError 함수는', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('402 에러를 받으면', () => {
        it('console.error에 한 번 기록한다', () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            const error = new Error('FMP API error: 402 Payment Required');

            logFmpPaymentRequiredError(error);

            expect(errorSpy).toHaveBeenCalledOnce();
            expect(errorSpy).toHaveBeenCalledWith(
                `${FMP_PAYMENT_REQUIRED_LOG_PREFIX} Error: FMP API error: 402 Payment Required`
            );
        });

        it('같은 에러 객체는 중복 기록하지 않는다', () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            const error = new Error('FMP API error: 402 Payment Required');

            logFmpPaymentRequiredError(error);
            logFmpPaymentRequiredError(error);

            expect(errorSpy).toHaveBeenCalledOnce();
        });
    });
});
