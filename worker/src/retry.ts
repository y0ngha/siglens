/**
 * 5xx 에러로 모든 재시도가 소진되었음을 나타내는 센티넬 에러 코드.
 * 클라이언트(useAnalysis.ts)에서 동일한 문자열로 매칭하여 사용자 안내 메시지를 표시한다.
 */
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

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts: number; baseDelayMs: number }
): Promise<T> {
    const { maxAttempts, baseDelayMs } = options;

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

            if (kind === 'rate_limit') {
                const delay = get429RetryDelay(error) ?? baseDelayMs;

                if (delay >= RETRY_ALLOWABLE_TIME_MS) {
                    console.warn(
                        `[Retry] Do not attempt to retry beyond the allowable time. Response received: ${delay}`
                    );
                    break;
                }

                console.warn(
                    `[Retry] Attempt ${attempt}/${maxAttempts} failed (429). Retrying in ${delay}ms...`,
                    error
                );
                await sleep(delay);
            } else {
                // server_error | retryable → 지수 백오프
                const delay = baseDelayMs * Math.pow(2, attempt - 1);
                console.warn(
                    `[Retry] Attempt ${attempt}/${maxAttempts} failed (5xx). Retrying in ${delay}ms...`,
                    error
                );
                await sleep(delay);
            }
        }
    }
    // unreachable — for 루프가 항상 return 또는 throw
    throw new Error(AI_SERVER_UNSTABLE_CODE);
}
