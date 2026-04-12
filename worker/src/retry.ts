/**
 * 5xx 에러로 모든 재시도가 소진되었음을 나타내는 센티넬 에러 코드.
 * 클라이언트(useAnalysis.ts)에서 동일한 문자열로 매칭하여 사용자 안내 메시지를 표시한다.
 */
export const AI_SERVER_UNSTABLE_CODE = 'AI_SERVER_UNSTABLE';

function isRetryableError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;

    // Anthropic SDK APIError, Gemini SDK 등은 HTTP 상태를 status 프로퍼티에 담는다.
    // unknown 타입이므로 in 연산자로 존재를 확인한 뒤 타입을 좁힌다.
    if (
        'status' in error &&
        typeof (error as { status: unknown }).status === 'number'
    ) {
        return (error as { status: number }).status >= 500;
    }

    return false;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts: number; delayMs: number }
): Promise<T> {
    const { maxAttempts, delayMs } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const retryable = isRetryableError(error);

            if (!retryable || attempt === maxAttempts) {
                if (retryable) {
                    throw new Error(AI_SERVER_UNSTABLE_CODE);
                }
                throw error;
            }

            console.warn(
                `[Retry] Attempt ${attempt}/${maxAttempts} failed (5xx). Retrying in ${delayMs}ms...`
            );
            await sleep(delayMs);
        }
    }

    // unreachable — for 루프가 항상 return 또는 throw
    throw new Error(AI_SERVER_UNSTABLE_CODE);
}
