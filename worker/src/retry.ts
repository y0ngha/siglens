/** useAnalysis.ts가 이 문자열로 매칭하여 사용자 안내 메시지를 표시하는 5xx 소진 센티넬 코드. */
export const AI_SERVER_UNSTABLE_CODE = 'AI_SERVER_UNSTABLE';

type ErrorKind = 'rate_limit' | 'server_error' | 'retryable' | 'none';

const RETRY_ALLOWABLE_TIME_MS = 300_000;

function classifyError(error: unknown): ErrorKind {
    if (typeof error !== 'object' || error === null) return 'none';

    if (
        'status' in error &&
        typeof (error as { status: unknown }).status === 'number'
    ) {
        const status = (error as { status: number }).status;
        if (status === 429) return 'rate_limit';
        if (status >= 500) return 'server_error';
        return 'none';
    }

    if (
        'retryable' in error &&
        (error as { retryable: unknown }).retryable === true
    ) {
        return 'retryable';
    }

    return 'none';
}

const GRPC_RETRY_INFO_TYPE =
    'type.googleapis.com/google.rpc.RetryInfo' as const;

interface GrpcRetryInfo {
    '@type': typeof GRPC_RETRY_INFO_TYPE;
    retryDelay: string; // e.g. "15s", "58s"
}

function isRetryInfo(detail: unknown): detail is GrpcRetryInfo {
    return (
        typeof detail === 'object' &&
        detail !== null &&
        (detail as Record<string, unknown>)['@type'] === GRPC_RETRY_INFO_TYPE &&
        typeof (detail as Record<string, unknown>)['retryDelay'] === 'string'
    );
}

// Gemini SDK ApiError: message가 JSON 문자열이고 details는 그 안에 포함됨
//   → error.message = '{"error":{"details":[{RetryInfo}]}}'
// Anthropic SDK RateLimitError: error.retryDelay — 숫자(ms)
function get429RetryDelay(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;

    // Anthropic SDK — retryDelay(ms) 숫자
    const direct = (error as Record<string, unknown>)['retryDelay'];
    if (typeof direct === 'number') return direct;

    // Gemini SDK — message JSON 파싱 후 details 탐색
    const message = (error as Record<string, unknown>)['message'];
    if (typeof message !== 'string') return undefined;

    let details: unknown;
    try {
        const parsed = JSON.parse(message) as Record<string, unknown>;
        const inner = parsed['error'];
        if (typeof inner === 'object' && inner !== null) {
            details = (inner as Record<string, unknown>)['details'];
        }
    } catch {
        return undefined;
    }

    if (!Array.isArray(details)) return undefined;

    const retryInfo = details.find(isRetryInfo);
    if (!retryInfo) return undefined;

    // "15s" → 15000, "58.4s" → 58400
    const match = retryInfo.retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
    if (!match) return undefined;
    return Math.ceil(parseFloat(match[1]) * 1000);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** 누적 지연이 abortIfCumulativeDelayReachesMs 이상이면 즉시 루프를 중단하고 AI_SERVER_UNSTABLE_CODE를 throw한다. */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts: number;
        baseDelayMs: number;
        abortIfCumulativeDelayReachesMs?: number;
    }
): Promise<T> {
    const { maxAttempts, baseDelayMs, abortIfCumulativeDelayReachesMs } =
        options;
    const delayLimit =
        abortIfCumulativeDelayReachesMs ?? RETRY_ALLOWABLE_TIME_MS;
    let cumulativeDelay = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const kind = classifyError(error);

            if (kind === 'none' || attempt === maxAttempts) {
                if (kind !== 'none') {
                    throw new Error(AI_SERVER_UNSTABLE_CODE);
                }
                throw error;
            }

            const delay =
                kind === 'rate_limit'
                    ? (get429RetryDelay(error) ?? baseDelayMs)
                    : baseDelayMs * Math.pow(2, attempt - 1);

            if (cumulativeDelay + delay >= delayLimit) {
                console.warn(
                    `[Retry] Cumulative retry delay (${cumulativeDelay + delay}ms) would exceed limit (${delayLimit}ms). Aborting retries.`
                );
                break;
            }

            const label = kind === 'rate_limit' ? '429' : '5xx';
            console.warn(
                `[Retry] Attempt ${attempt}/${maxAttempts} failed (${label}). Retrying in ${delay}ms...`,
                error
            );
            cumulativeDelay += delay;
            await sleep(delay);
        }
    }
    // delay 한도 초과로 break된 경우에만 도달
    throw new Error(AI_SERVER_UNSTABLE_CODE);
}
