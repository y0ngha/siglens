import 'server-only';
import type { ModelId, Timeframe } from '@y0ngha/siglens-core';
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

export type Failure = Extract<PublicToolOutcome, { ok: false }>;

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
