import { FmpHttpError } from './FmpHttpError';

const FMP_ERROR_STATUS_RE = /^FMP(?: API error:|\s+\S+)\s+(\d{3})\b/i;

export const FMP_TEMPORARY_UNAVAILABLE_MESSAGE =
    '미국 증시 데이터 서버에 요청이 많아 지금은 처리하기 어렵습니다. 수 분 후 다시 시도해 주세요.';

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

export function getFmpUserFacingMessage(error: unknown): string | null {
    const status = getFmpErrorStatus(error);
    if (status === null) return null;

    return status === 429 || status >= 500
        ? FMP_TEMPORARY_UNAVAILABLE_MESSAGE
        : null;
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
