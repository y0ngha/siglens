import type {
    AnalysisGateBlockedResult,
    AnalysisGateErrorCode,
} from '@/shared/lib/types';

/**
 * `AnalysisGateErrorCode`의 모든 멤버를 키로 강제하는 컴파일 타임 완전성 장치.
 * 유니온에 코드를 추가하면 여기에도 넣기 전까지 컴파일이 실패한다. 값은 쓰지
 * 않고 키만 읽는다.
 */
const GATE_ERROR_CODE_KEYS: Record<AnalysisGateErrorCode, true> = {
    tier_premium_blocked: true,
    invalid_model: true,
    api_key_corrupted: true,
    ai_server_unstable: true,
    unexpected_error: true,
};

/**
 * 모든 게이트 에러 코드의 런타임 배열. {@link GATE_ERROR_CODE_KEYS}에서 뽑아
 * `AnalysisGateErrorCode` 유니온과 자동으로 동기화된다.
 */
// safe: Object.keys는 string[]로 넓히지만, Record<AnalysisGateErrorCode, true>가
// 유니온의 모든 멤버를 키로 갖도록 강제하므로 런타임에 어긋나지 않는다.
export const GATE_ERROR_CODES: readonly AnalysisGateErrorCode[] = Object.keys(
    GATE_ERROR_CODE_KEYS
) as AnalysisGateErrorCode[];

const GATE_ERROR_CODE_SET: ReadonlySet<string> = new Set(GATE_ERROR_CODES);

/**
 * `AnalysisGateBlockedResult`를 `status: 'error'`의 형제 변형과 구별하는 타입 가드.
 * 형제 변형은 `error`의 모양이 다르다(예: `SubmitFundamentalAnalysisLimitError.error`는
 * `AnalysisLimitError`). `code`가 게이트 코드 집합에 드는지로 판정한다 — 게이트가
 * 아닌 결과의 코드(`'fetch_failed'`, `'no_news'`, `'usage_limit_exceeded'`)는
 * 네임스페이스가 달라 걸리지 않는다. 패널 훅들이 거부 안내와 일반 오류를 가르는 용도다.
 */
export function isGateBlockedResult(result: {
    status: 'error';
    error?: unknown;
}): result is AnalysisGateBlockedResult {
    const { error } = result;
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return false;
    }
    return (
        typeof error.code === 'string' && GATE_ERROR_CODE_SET.has(error.code)
    );
}
