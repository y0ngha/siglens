import 'server-only';
import {
    findToolSpec,
    selectTools,
    type AgentToolSpec,
} from '@y0ngha/siglens-core';
import { availableToolNames } from '@/app/api/ai/chat/tools/chatTools';
import {
    API_GENERATABLE_MODELS,
    API_KNOWN_MODELS,
} from '@/entities/siglens-api-key/lib/apiModels';

/**
 * 에이전트가 쓰는 도구 중 공개 API에 **내보내지 않는** 것.
 *
 * - `web_search`: 서버의 검색 키(Brave/Naver) 비용이 든다 — "서버 비용 없이 사용자 BYOK 키만"이라는
 *   원칙 위반. (E2E나 검색 키가 없는 환경에서는 실행기 목록에서 이미 빠지지만, 키가 있는 운영에서도
 *   이 목록이 막는다.)
 *
 * `run_fresh_analysis`는 내보낸다 — 단 에이전트 구현(서버 키로 LLM 호출)이 아니라 사용자 BYOK 키만 쓰는
 * `runByokFreshAnalysis`로 간다(`executePublicTool`). 그 도구의 서버 비용 감사(2026-10):
 * - 분석 생성(기술·종합·뉴스·옵션)은 모두 사용자 키로만 나간다 — 서버 키 env는 읽지 않고, core가 서버 키를
 *   고를 수 있는 호출(pro tier, free/member 등급 모델)은 호출 직전에 거절한다(`assertByokOnlyRouting`).
 * - `ensureSymbolData`(뉴스 적재 + 서버 키 뉴스 카드 분석)는 `refreshSymbolData: false`로 꺼져 있고 이 구현은
 *   아예 부르지 않는다.
 * - 분석 결과의 쉬운 말 재작성(`rewriteToPlainLanguage`)·언어 번역(`translateAnalysisForLocale`)은 SSE 분석
 *   라우트의 후처리일 뿐 이 경로에 없다 — 생성 언어는 core의 `locale`로 정해지고 서버 LLM 호출은 없다.
 * - 입력 조립의 시장 데이터 조회(FMP/Yahoo)는 LLM이 아니고 공유 캐시를 거친다. 생성 시도는 `ai` 버킷이 묶는다.
 * - **수용한 예외(사용자 결정)**: 처음 보는 심볼의 회사명 한글 번역(`getAssetInfo`의 lazy
 *   `translateCompanyNames`) 하나는 서버 Gemini 키로 나간다. 심볼당 최초 1회이고 결과(`korean_tickers`·
 *   `asset_translations`)는 전 사용자가 공유하며, 데이터 도구(`get_quote` 등)와 웹도 같은 경로로 일으킨다.
 *   사용자 키로 돌릴 수 없고(공유 캐시 채우기라 특정 사용자의 비용이 아니다) 동작을 바꾸지 않는다.
 *
 * 남은 데이터 도구에 서버 비용이 새지 않는지의 감사(2026-10):
 * - 서버 키 LLM 호출 경로는 `get_news`의 `ensureSymbolData`(FMP 적재 + 뉴스 카드 분석) 하나뿐이었고,
 *   API는 `createToolExecutor(..., { refreshSymbolData: false })`로 끈다 — 저장된 기사만 돌려준다.
 * - `get_cached_analysis`·`get_market_overview`·`get_economy`의 AI 산출물은 `peek*`(읽기 전용 캐시/DB)만
 *   읽고 생성하지 않는다.
 * - 시세·봉·재무·옵션·의회 거래·경제 지표는 서버 키의 시장 데이터 조회(FMP/Yahoo)를 부른다. LLM이 아니고
 *   공유 캐시를 거치며, 회원 단위 분당/일 한도(`PUBLIC_API_RATE_LIMITS.data`)가 호출 수를 묶는다.
 * - `search_ticker`·`get_guide`·`get_my_portfolio`는 DB(와 보유종목 시세 캐시)만 읽는다.
 *
 * 실행기 목록(`availableToolNames`)에서 빼는 방식이라, 에이전트에 새 도구가 생기면 이
 * 목록에 올리지 않는 한 API에도 자동으로 따라온다 — 새 도구는 위 감사 기준으로 다시 확인한다.
 */
export const PUBLIC_API_EXCLUDED_TOOLS: ReadonlySet<string> = new Set([
    'web_search',
]);

/** BYOK 분석 생성 도구. 에이전트 스펙에서 `model` 인자와 API 전용 설명을 덧붙여 내보낸다. */
export const PUBLIC_API_FRESH_ANALYSIS_TOOL = 'run_fresh_analysis';

const FRESH_ANALYSIS_DESCRIPTION =
    'Get an AI analysis for a symbol (kind: technical, overall, news or options) in the same structure as get_cached_analysis. A shared cached analysis is returned at no cost (meta.source "cache"). Otherwise a NEW analysis is generated (30-250 seconds) with YOUR registered LLM key — BYOK only, SigLens never spends its own key — and counts against the stricter "ai" rate limit. Generating needs a premium model that runs on your own key and a registered key for its provider.';

/**
 * 에이전트 스펙(`inputSchema`: symbol·kind·timeframe)에 API 전용 `model`을 더한다. 생략하면 계정의 "API 기본 모델"이다.
 * 열거값은 로스터 전체(캐시 적중 읽기는 어느 모델이든 가능)고, 생성 가능한 모델은 설명에 따로 적는다 — 둘 다
 * core 로스터에서 파생하므로 모델이 바뀌어도 따라온다.
 */
function withApiModelArgument(spec: AgentToolSpec): AgentToolSpec {
    return {
        ...spec,
        description: FRESH_ANALYSIS_DESCRIPTION,
        inputSchema: {
            ...spec.inputSchema,
            properties: {
                ...spec.inputSchema.properties,
                model: {
                    type: 'string',
                    enum: API_KNOWN_MODELS,
                    description: `Model to use. Optional: defaults to the API default model set at siglens.io/account, and the request fails with model_required when neither is set. Models that can be generated on your own key: ${API_GENERATABLE_MODELS.join(', ')}.`,
                },
            },
        },
    };
}

function toApiSpec(spec: AgentToolSpec): AgentToolSpec {
    return spec.name === PUBLIC_API_FRESH_ANALYSIS_TOOL
        ? withApiModelArgument(spec)
        : spec;
}

export function publicApiToolNames(): ReadonlySet<string> {
    return new Set(
        [...availableToolNames()].filter(
            name => !PUBLIC_API_EXCLUDED_TOOLS.has(name)
        )
    );
}

/** 노출 도구의 core 스펙(순서는 `AGENT_TOOL_SPECS` 그대로). */
export function publicApiToolSpecs(): AgentToolSpec[] {
    return selectTools(publicApiToolNames()).map(toApiSpec);
}

/** 노출 도구가 아니면 `undefined` — 제외 목록의 도구도 여기서 걸러진다. */
export function findPublicApiToolSpec(name: string): AgentToolSpec | undefined {
    const spec = publicApiToolNames().has(name)
        ? findToolSpec(name)
        : undefined;
    return spec === undefined ? undefined : toApiSpec(spec);
}
