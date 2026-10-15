import 'server-only';
import {
    TOOL_TIMEOUT_MS,
    type AgentToolSpec,
    type ToolExecutionContext,
} from '@y0ngha/siglens-core';
import { createToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { AGENT_MODEL } from '@/entities/llm-provider/api/agent/router';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { PUBLIC_API_RESULT_CAPS } from '@/shared/config/publicApi';
import {
    ANALYSIS_LOCALE_HEADER,
    isLocale,
    type Locale,
} from '@/shared/i18n/locales';
import { API_STATUS } from './apiResponse';

/**
 * API 소비자의 기본 로케일. 앱은 한국어가 기본이지만 API 호출자는 대개 에이전트·스크립트라
 * 응답 언어를 명시하지 않으면 영어가 자연스럽다. `X-Siglens-Locale`로 바꾼다.
 */
const API_DEFAULT_LOCALE = 'en' satisfies Locale;

export function resolveApiLocale(request: Request): Locale {
    const raw = request.headers.get(ANALYSIS_LOCALE_HEADER)?.trim() ?? '';
    return isLocale(raw) ? raw : API_DEFAULT_LOCALE;
}

export type PublicToolOutcome =
    | { ok: true; data: unknown; truncated: boolean }
    | {
          ok: false;
          status: number;
          code: string;
          message: string;
          details?: unknown;
      };

interface ErrorMapping {
    status: number;
    message: string;
}

/**
 * 실행기가 `{ error: '<code>' }`로 돌려주는 도메인 오류 → HTTP. 모르는 코드는 500으로
 * 두되 코드 문자열은 그대로 싣는다(실행기가 모델에게 보여 주는 값이라 내부 정보가 없다).
 */
const TOOL_ERROR_MAPPING: Readonly<Record<string, ErrorMapping>> = {
    invalid_symbol: {
        status: API_STATUS.badRequest,
        message: 'A symbol argument is not a valid ticker shape.',
    },
    invalid_args: {
        status: API_STATUS.badRequest,
        message: 'The tool arguments are not valid for this tool.',
    },
    invalid_query: {
        status: API_STATUS.badRequest,
        message: 'The query argument is empty or invalid.',
    },
    unknown_tool: {
        status: API_STATUS.notFound,
        message: 'No such tool.',
    },
    login_required: {
        status: API_STATUS.forbidden,
        message: 'This tool needs a member account.',
    },
    aborted: {
        status: API_STATUS.gatewayTimeout,
        message: 'The request was aborted before the tool finished.',
    },
    tool_failed: {
        status: API_STATUS.internalError,
        message: 'The tool failed to produce a result.',
    },
};
const UNMAPPED_TOOL_ERROR: ErrorMapping = {
    status: API_STATUS.internalError,
    message: 'The tool reported an error.',
};

interface ToolErrorPayload {
    error: string;
    [field: string]: unknown;
}

function isToolErrorPayload(value: unknown): value is ToolErrorPayload {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof (value as { error?: unknown }).error === 'string'
    );
}

/** `truncateToolResult`가 크기 상한에 걸렸을 때 만드는 `{ truncated: true, preview }` 봉투. */
function isTruncatedEnvelope(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        (value as { truncated?: unknown }).truncated === true &&
        typeof (value as { preview?: unknown }).preview === 'string'
    );
}

function timeoutSignal(spec: AgentToolSpec): AbortSignal {
    return AbortSignal.timeout(TOOL_TIMEOUT_MS[spec.costClass]);
}

/**
 * 도구 하나를 키 소유자의 신원으로 실행한다.
 *
 * `ctx.userId`/`ctx.tier`는 **인증된 principal에서만** 온다. 요청 본문·헤더로 바꿀 방법이
 * 없고(스키마가 `additionalProperties: false`라 `userId` 같은 인자는 검증에서 거절된다),
 * `get_my_portfolio`는 이 `userId`로만 보유종목을 읽는다.
 *
 * 실행기는 에이전트가 쓰는 것과 같다(`createToolExecutor`) — 요청마다 새로 만들어
 * 턴 단위 상태(뉴스 갱신 메모, 분석 글자 예산)가 요청 사이에 새지 않는다.
 *
 * `analysisModel`은 에이전트와 같은 `AGENT_MODEL`을 쓴다. PR-A의 데이터 도구에서 이 값이
 * 영향을 주는 곳은 `get_cached_analysis`의 캐시 키뿐인데, 이 값이 에이전트가 읽는
 * 공유 분석 캐시와 같은 항목을 가리켜야 웹·에이전트·API가 한 캐시를 공유한다. 사용자
 * 모델 선택(`api_default_model`)은 PR-B에서 `run_fresh_analysis`와 함께 들어온다.
 */
export async function executePublicTool(
    spec: AgentToolSpec,
    args: Record<string, unknown>,
    principal: ApiKeyPrincipal,
    locale: Locale,
    requestSignal: AbortSignal
): Promise<PublicToolOutcome> {
    // `refreshSymbolData: false` — 에이전트의 `get_news`는 심볼 뉴스를 FMP로 적재하고 서버 키
    // LLM으로 뉴스 카드를 분석한다. 공개 API는 서버 비용을 쓰지 않으므로(BYOK 원칙) 그 갱신을
    // 끄고, 이미 저장된 것만 돌려준다. 결과 상한은 API 전용 값이다(PUBLIC_API_RESULT_CAPS).
    const execute = createToolExecutor(
        { analysisModel: AGENT_MODEL },
        { refreshSymbolData: false, resultCaps: PUBLIC_API_RESULT_CAPS }
    );
    const deadline = timeoutSignal(spec);
    const signal = AbortSignal.any([requestSignal, deadline]);
    const ctx: ToolExecutionContext = {
        userId: principal.userId,
        tier: principal.tier,
        locale,
        signal,
    };

    const abortedPromise = new Promise<'aborted'>(resolve => {
        signal.addEventListener('abort', () => resolve('aborted'), {
            once: true,
        });
    });
    const result = await Promise.race([
        execute(spec.name, args, ctx),
        abortedPromise,
    ]);

    if (result === 'aborted') {
        return deadline.aborted
            ? {
                  ok: false,
                  status: API_STATUS.gatewayTimeout,
                  code: 'tool_timeout',
                  message: 'The tool did not finish before its deadline.',
              }
            : {
                  ok: false,
                  status: API_STATUS.gatewayTimeout,
                  code: 'aborted',
                  message: TOOL_ERROR_MAPPING.aborted.message,
              };
    }
    if (isToolErrorPayload(result)) {
        const { error: code, ...details } = result;
        const mapping = TOOL_ERROR_MAPPING[code] ?? UNMAPPED_TOOL_ERROR;
        return {
            ok: false,
            status: mapping.status,
            code,
            message: mapping.message,
            ...(Object.keys(details).length > 0 ? { details } : {}),
        };
    }
    return { ok: true, data: result, truncated: isTruncatedEnvelope(result) };
}
