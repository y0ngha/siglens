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
    DEFAULT_LOCALE,
    isLocale,
    type Locale,
} from '@/shared/i18n/locales';
import { API_STATUS } from './apiResponse';
import {
    isPublicToolStream,
    isTruncatedEnvelope,
    type PublicToolOutcome,
    type PublicToolResult,
} from './publicToolOutcome';
import { PUBLIC_API_FRESH_ANALYSIS_TOOL } from './publicApiTools';
import { runByokFreshAnalysis } from './runByokFreshAnalysis';
import { runWithoutServerLlm } from '@/shared/lib/serverLlmPolicy';

/**
 * `X-Siglens-Locale`이 없거나 모르는 값이면 앱 기본 로케일(`DEFAULT_LOCALE`, ko)이다. 이 값은 분석 캐시 키에
 * 접미로 접히는데 `ko`만 접미가 없는 기존 키를 맞힌다 — 기본을 ko로 두어야 API 호출자가 웹이 채운 공유 분석
 * 캐시에 적중한다(기본이 en이면 한국어 웹 사용자가 만든 캐시를 못 읽고 사용자 키로 새로 생성하게 된다).
 */
export function resolveApiLocale(request: Request): Locale {
    const raw = request.headers.get(ANALYSIS_LOCALE_HEADER)?.trim() ?? '';
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

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

function timeoutSignal(spec: AgentToolSpec): AbortSignal {
    return AbortSignal.timeout(TOOL_TIMEOUT_MS[spec.costClass]);
}

/** 실행기(`createToolExecutor`)의 결과 payload → HTTP 결과. 도메인 오류(`{ error }`)는 상태 코드로 매핑한다. */
function toOutcome(result: unknown): PublicToolOutcome {
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

async function runViaExecutor(
    spec: AgentToolSpec,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext
): Promise<PublicToolOutcome> {
    // `refreshSymbolData: false` — 에이전트의 `get_news`는 심볼 뉴스를 FMP로 적재하고 서버 키
    // LLM으로 뉴스 카드를 분석한다. 공개 API는 서버 비용을 쓰지 않으므로(BYOK 원칙) 그 갱신을
    // 끄고, 이미 저장된 것만 돌려준다. 결과 상한은 API 전용 값이다(PUBLIC_API_RESULT_CAPS).
    const execute = createToolExecutor(
        { analysisModel: AGENT_MODEL },
        { refreshSymbolData: false, resultCaps: PUBLIC_API_RESULT_CAPS }
    );
    return toOutcome(await execute(spec.name, args, ctx));
}

/**
 * 도구 하나를 키 소유자의 신원으로 실행한다.
 *
 * 서버 키로 LLM을 부르는 에이전트용 실행기(`runFreshAnalysisTool`)는 공개 API에서 **절대** 닿지 않는다 —
 * `run_fresh_analysis`는 사용자 BYOK 키만 쓰는 `runByokFreshAnalysis`로만 간다(`createToolExecutor`를 거치지 않는다).
 *
 * `ctx.userId`/`ctx.tier`는 **인증된 principal에서만** 온다. 요청 본문·헤더로 바꿀 방법이
 * 없고(스키마가 `additionalProperties: false`라 `userId` 같은 인자는 검증에서 거절된다),
 * `get_my_portfolio`는 이 `userId`로만 보유종목을 읽는다.
 *
 * 데이터 도구의 실행기는 에이전트가 쓰는 것과 같다(`createToolExecutor`) — 요청마다 새로 만들어
 * 턴 단위 상태(뉴스 갱신 메모, 분석 글자 예산)가 요청 사이에 새지 않는다. `run_fresh_analysis`만
 * 예외다: 에이전트 구현은 서버 키로 LLM을 부르므로 `runByokFreshAnalysis`(사용자 BYOK 키 전용)로 간다.
 *
 * `analysisModel`은 에이전트와 같은 `AGENT_MODEL`을 쓴다. 데이터 도구에서 이 값이 영향을 주는 곳은
 * `get_cached_analysis`의 캐시 키뿐인데, 이 값이 에이전트가 읽는 공유 분석 캐시와 같은 항목을
 * 가리켜야 웹·에이전트·API가 한 캐시를 공유한다. 사용자가 고른 모델(`model` 인자·
 * `users.api_default_model`)은 `run_fresh_analysis`에서만 쓰인다.
 */
export async function executePublicTool(
    spec: AgentToolSpec,
    args: Record<string, unknown>,
    principal: ApiKeyPrincipal,
    locale: Locale,
    requestSignal: AbortSignal
): Promise<PublicToolResult> {
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
    // `run_fresh_analysis`는 `createToolExecutor`(에이전트 실행기 — 서버 키로 LLM을 부른다)를 거치지
    // 않고 BYOK 전용 구현으로만 간다.
    //
    // 도구 흐름 전체를 `runWithoutServerLlm`으로 감싼다: 회사명 번역(`getAssetInfo`·`searchTicker`의
    // 서버 Gemini 키 호출)은 도구·분석 러너 어디서든 닿는 깊은 길에 있어, 이 한 겹이 사이트의 서버 키
    // LLM을 공개 API에서 통째로 막는다. 웹·에이전트는 감싸지 않아 그대로 번역한다.
    const work: Promise<PublicToolResult> = runWithoutServerLlm(() =>
        spec.name === PUBLIC_API_FRESH_ANALYSIS_TOOL
            ? runByokFreshAnalysis({ args, principal, locale, signal })
            : runViaExecutor(spec, args, ctx)
    );
    const result = await Promise.race([work, abortedPromise]);

    const abortedOutcome = (): PublicToolOutcome =>
        deadline.aborted
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
    if (result === 'aborted') return abortedOutcome();
    if (isPublicToolStream(result)) {
        // 스트림이 시작된 뒤에도 마감·끊김이 응답을 닫는다. 생성에는 `NEVER_ABORTED_SIGNAL`이 가므로(공유 생성을
        // 죽이지 않으려는 결정) 이 경쟁이 응답을 닫는 유일한 수단이다 — 생성은 계속 돌고 끝나면 슬롯을 반납한다.
        return {
            streaming: true,
            ...(result.headers === undefined
                ? {}
                : { headers: result.headers }),
            completion: Promise.race([
                result.completion,
                abortedPromise.then(abortedOutcome),
            ]),
        };
    }
    return result;
}
