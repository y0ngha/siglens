import { FmpHttpError } from './FmpHttpError';

const FMP_ERROR_STATUS_RE = /^FMP(?: API error:|\s+\S+)\s+(\d{3})\b/i;

/**
 * 카탈로그 키. 이 모듈은 훅도 컴포넌트도 아니라 스스로 번역할 수 없으므로,
 * **키만 돌려주고 번역은 호출부가** 한다. 예전에는 한국어 리터럴을 돌려줬는데,
 * 그 값이 `<ErrorBanner>`·`AiSummaryErrorSection`을 통해 그대로 렌더돼
 * 일본어·영어 화면에 한국어 문장이 박혔다.
 */
export const FMP_TEMPORARY_UNAVAILABLE_KEY = 'shared.api.fmpBusy';

// 402(결제/쿼터 한도)는 사용자가 재시도로 해결할 수 없는 운영자 측 문제다.
// "일시적/다시 시도"로 헛된 재시도를 유도하지 않도록 중립적으로 안내한다 — 내부
// 청구 사유는 노출하지 않고, 복구 여부는 운영자(logFmpPaymentRequiredError 알림)에 달려 있다.
export const FMP_DATA_UNAVAILABLE_KEY = 'shared.api.fmpUnavailable';

export const FMP_PAYMENT_REQUIRED_LOG_PREFIX =
    '비용 예외가 필요한 API가 호출되었습니다.';

const loggedPaymentRequiredErrors = new WeakSet<object>();

function getErrorMessage(error: unknown): string | null {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return null;
}

export function getFmpErrorStatus(error: unknown): number | null {
    if (error instanceof FmpHttpError) return error.status;

    const message = getErrorMessage(error);
    if (message === null) return null;

    const match = FMP_ERROR_STATUS_RE.exec(message);
    return match?.[1] !== undefined ? Number(match[1]) : null;
}

/**
 * FMP 오류를 사용자에게 보여줄 **카탈로그 키**로 바꾼다(문구가 아니다).
 * 호출부에서 `t(key)`로 번역한다.
 */
export function getFmpUserFacingKey(error: unknown): string | null {
    const status = getFmpErrorStatus(error);
    if (status === null) return null;

    if (status === 429 || status >= 500) {
        return FMP_TEMPORARY_UNAVAILABLE_KEY;
    }
    // 402 (payment required) means an FMP plan/quota limit was hit — an operator
    // problem the user can't act on. Surface a neutral message instead of
    // leaking the raw "FMP <path> 402" internal string through the client error
    // fallbacks (ChartErrorFallback 등은 message가 null이면 error.message를 그대로
    // 노출). Operators are still alerted separately via logFmpPaymentRequiredError.
    if (status === 402) {
        return FMP_DATA_UNAVAILABLE_KEY;
    }
    return null;
}

export function isFmpPaymentRequiredError(error: unknown): boolean {
    return getFmpErrorStatus(error) === 402;
}

export function getFmpPaymentRequiredLogMessage(error: unknown): string | null {
    if (!isFmpPaymentRequiredError(error)) return null;
    return `${FMP_PAYMENT_REQUIRED_LOG_PREFIX} ${String(error)}`;
}

export function logFmpPaymentRequiredError(error: unknown): void {
    const message = getFmpPaymentRequiredLogMessage(error);
    if (message === null) return;

    if (typeof error === 'object' && error !== null) {
        if (loggedPaymentRequiredErrors.has(error)) return;
        loggedPaymentRequiredErrors.add(error);
    }
    console.error(message);
}

/**
 * FMP 오류를 사용자 문구로 바꾼다.
 *
 * `t`는 **루트 번역자**여야 한다(`useTranslations()` / `await getTranslations()`,
 * 네임스페이스 인자 없이). 이 모듈이 돌려주는 키는
 * `shared.api.fmpBusy`처럼 완전 수식이라 네임스페이스가 걸린 번역자로는 못 찾는다.
 */
export function translateFmpError(
    error: unknown,
    t: (key: string) => string
): string | null {
    const key = getFmpUserFacingKey(error);
    return key === null ? null : t(key);
}
