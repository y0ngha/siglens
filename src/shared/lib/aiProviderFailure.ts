import { AI_SERVER_UNSTABLE } from './sse/LocalizedStreamError';
import type { AnalysisGateErrorCode } from './types';

/**
 * siglens-core 1.7.0의 DeepSeek 스트림 정지 코드 — 90초간 토큰이 없으면 provider가
 * 중단하고 `code: 'DEEPSEEK_STALLED'`인 Error를 던진다. 이 브랜치는 아직 core
 * 1.6.1에 고정돼 있어 상수를 import하지 않고 문자열로 맞춘다.
 */
const DEEPSEEK_STALLED_CODE = 'DEEPSEEK_STALLED';

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * LLM SDK가 던진 API 에러인지 — **모양으로** 판정한다.
 *
 * `status`만 보면 안 되는 이유: 같은 분석 경로에서 `FmpHttpError`(시세·재무
 * 데이터)도 `status: 5xx`를 싣고 던져진다. 그걸 "AI 서버 불안정 → 모델을 바꾸라"로
 * 안내하면 모델을 바꿔도 안 풀리는 장애에 틀린 조치를 권하게 된다.
 *
 *  - OpenAI(DeepSeek 포함)·Anthropic SDK의 `APIError`는 생성자에서 `status`와
 *    `headers`를 항상 own property로 둔다. 연결 실패·타임아웃(`APIConnectionError`,
 *    `APIConnectionTimeoutError`)과 스트림 도중 에러도 이 계열이고 `status`가
 *    `undefined`다.
 *  - Gemini SDK(`@google/genai`)의 `ApiError`는 `headers`가 없고 `name`을 명시적으로
 *    `'ApiError'`로 둔다(문자열 리터럴이라 번들 minify에도 살아남는다).
 *
 * `instanceof`를 쓰지 않는 건 shared가 SDK를 import하지 않기 위해서다.
 *
 * ponytail: Gemini의 네트워크 실패는 SDK가 감싸지 않은 `TypeError('fetch failed')`라
 * FMP 네트워크 실패와 구분할 수 없어 여기서 잡지 않는다(제네릭 문구로 떨어진다).
 * core가 provider 에러에 출처 표시를 달아 주면 그걸로 넓힌다.
 */
function isLlmSdkApiError(error: Record<string, unknown>): boolean {
    return (
        ('status' in error && 'headers' in error) || error.name === 'ApiError'
    );
}

/**
 * AI provider 쪽 사정으로 실패했는지 — "모델을 바꿔 보라"는 안내가 맞는 실패인지.
 *
 * 참:
 *  - core `withRetry`의 재시도 소진 sentinel(`AI_SERVER_UNSTABLE`) — 분석 경로의
 *    5xx·429·retryable 실패는 전부 이걸로 바뀌어 올라온다
 *  - `DEEPSEEK_STALLED` (core 1.7.0 스트림 정지)
 *  - SDK API 에러 중 429, 5xx, 그리고 status 없는 연결 실패·타임아웃 — 챗봇
 *    어댑터는 재시도 래퍼가 없어 원시 SDK 에러가 그대로 온다
 *
 * 거짓(기존 문구 유지): 400 등 요청 오류, BYOK 키의 401/403, 사용량·티어 게이트,
 * 봇 차단, 쿨다운, SDK 밖의 에러(FMP·DB·내부 버그).
 */
export function isAiProviderFailure(error: unknown): boolean {
    if (!isRecord(error)) return false;
    if (error.message === AI_SERVER_UNSTABLE) return true;
    if (error.code === DEEPSEEK_STALLED_CODE) return true;
    if (!isLlmSdkApiError(error)) return false;

    const { status } = error;
    if (status === undefined) return true;
    return (
        typeof status === 'number' &&
        (status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_MIN)
    );
}

/**
 * 분석 액션의 catch-all이 돌려줄 게이트 코드. 액션 6종이 같은 판정을 쓰도록
 * 여기 한 곳에 둔다.
 */
export function caughtAnalysisErrorCode(
    error: unknown
): Extract<AnalysisGateErrorCode, 'ai_server_unstable' | 'unexpected_error'> {
    return isAiProviderFailure(error)
        ? 'ai_server_unstable'
        : 'unexpected_error';
}
