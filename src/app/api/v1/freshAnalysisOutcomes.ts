import 'server-only';
import {
    UserApiKeyMissingError,
    type ModelId,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { truncateToolResult } from '@/app/api/ai/chat/tools/truncate';
import { unwrap, type Outcome } from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { PUBLIC_API_RESULT_CAPS } from '@/shared/config/publicApi';
import { providerFailureStatus } from '@/shared/lib/aiProviderFailure';
import { ByokOnlyRoutingError } from '@/shared/lib/byokOnly';
import { API_STATUS } from './apiResponse';
import {
    isTruncatedEnvelope,
    type PublicToolOutcome,
} from './publicToolOutcome';

/** `PublicToolOutcome`의 실패 갈래. */
export type Failure = Extract<PublicToolOutcome, { ok: false }>;

/** 실패 결과를 만든다. `details`가 없으면 키 자체를 두지 않는다. */
export function fail(
    status: number,
    code: string,
    message: string,
    details?: unknown
): Failure {
    return {
        ok: false,
        status,
        code,
        message,
        ...(details === undefined ? {} : { details }),
    };
}

/** 캐시 적중 또는 새 생성의 분석 결과를 `unwrap`해 크기 상한을 적용한 성공 결과로 만든다. */
export function success(
    kind: string,
    timeframe: Timeframe,
    outcome: Outcome,
    source: 'cache' | 'fresh',
    model: ModelId
): PublicToolOutcome {
    const unwrapped = unwrap(
        kind,
        kind === 'technical' || kind === 'overall' ? timeframe : undefined,
        outcome
    );
    const data = truncateToolResult(
        unwrapped,
        PUBLIC_API_RESULT_CAPS.cachedAnalysis
    );
    return {
        ok: true,
        data,
        truncated: isTruncatedEnvelope(data),
        meta: { source, model },
    };
}

/** `unwrap`이 실패 시 돌려주는 `{ error, code }`에서 `code`만 꺼낸다(캐스트 없이). */
function errorCodeOf(value: unknown): string | undefined {
    return typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        typeof value.code === 'string'
        ? value.code
        : undefined;
}

/**
 * 400 `byok_key_required { provider }` — 이 API는 사용자 키로만 생성한다. `unreadable`이면 저장된 키를
 * 복호화하지 못한 경우라 다시 등록하라고 안내한다.
 */
export function byokKeyRequired(
    provider: string,
    reason: 'not_registered' | 'unreadable' = 'not_registered'
): Failure {
    return fail(
        API_STATUS.badRequest,
        'byok_key_required',
        reason === 'unreadable'
            ? `Your stored ${provider} key could not be read. Register it again at siglens.io/account.`
            : `No cached analysis exists and generating one needs your own ${provider} API key. Register it at siglens.io/account.`,
        { provider }
    );
}

/**
 * core가 키 게이트에서 돌려주는 `key_error` 결과인가(그 결과의 코드는 키 게이트가 유일하게 내는 값이라
 * `status`만 본다).
 * 생성 호출은 사용자 키를 싣고 가므로 보통은 오지 않는다.
 */
export function isKeyRequiredOutcome(outcome: Outcome): boolean {
    return outcome.status === 'key_error';
}

/** 분석이 결과를 내지 못한 상태를 422 `analysis_failed`로 바꾼다. 내부 상세 대신 상태 코드만 싣는다. */
export function analysisFailed(
    kind: string,
    timeframe: Timeframe,
    outcome: Outcome
): Failure {
    const result = unwrap(kind, timeframe, outcome);
    return fail(
        API_STATUS.unprocessable,
        'analysis_failed',
        'The analysis could not be produced for this request.',
        { code: errorCodeOf(result) ?? outcome.status }
    );
}

/**
 * 던져진 오류를 **오류 자체로** 분류하고 항상 기록한다. 생성은 요청 signal에 묶이지 않으므로(끊김·마감 뒤에도
 * 계속 돈다) signal 상태로 분류하면 끊김 뒤의 provider 401/429나 라우팅 가드 위반이 로그에서 사라진다.
 * 끊김·마감 응답은 이 함수가 아니라 `executePublicTool`의 경쟁이 만든다.
 */
export function mapThrown(error: unknown, provider: string): Failure {
    // 키 게이트가 없는 use-case는 키가 없으면 던진다(`key_error` 변종이 없다). 500이 아니라 400이다.
    if (error instanceof UserApiKeyMissingError)
        return byokKeyRequired(provider);
    if (error instanceof ByokOnlyRoutingError) {
        // 호출자 버그다. 사용자에게는 일반 500이고, 서버 키로는 나가지 않았다.
        console.error(
            '[api/v1 run_fresh_analysis] routing guard tripped:',
            error
        );
        return fail(
            API_STATUS.internalError,
            'tool_failed',
            'The tool failed to produce a result.'
        );
    }
    const providerFailure = providerFailureStatus(error);
    if (providerFailure !== null) {
        // 오류 객체는 싣지 않는다(SDK 오류는 요청 헤더를 품을 수 있다) — provider와 상태만.
        console.warn('[api/v1 run_fresh_analysis] provider failure:', {
            provider,
            status: providerFailure.status,
        });
        return fail(
            API_STATUS.badGateway,
            'provider_error',
            providerFailure.status === null
                ? `The ${provider} API kept failing (rate limit or server error). Retry later.`
                : `The ${provider} API rejected the request with HTTP ${providerFailure.status}. Check your ${provider} key, quota and model access.`,
            { provider, status: providerFailure.status }
        );
    }
    console.error('[api/v1 run_fresh_analysis] failed:', error);
    return fail(
        API_STATUS.internalError,
        'tool_failed',
        'The tool failed to produce a result.'
    );
}
