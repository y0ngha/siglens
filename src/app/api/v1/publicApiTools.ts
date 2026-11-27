import 'server-only';
import {
    findToolSpec,
    selectTools,
    type AgentToolSpec,
} from '@y0ngha/siglens-core';
import { API_KNOWN_MODELS } from '@/entities/siglens-api-key/lib/apiModels';
import { availableToolNames } from '@/features/agent-tools/server/createToolExecutor';
import {
    GET_MY_WATCHLIST_TOOL,
    PROPOSE_PRICE_ALERT_TOOL,
} from '@/features/agent-tools/spec/watchlistAlertTools';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';
import { CHART_DATA_TOOL_SPEC } from './chartDataToolSpec';

/**
 * 에이전트가 쓰는 도구 중 공개 API에 **내보내지 않는** 것.
 *
 * - `web_search`: 서버의 검색 키(Brave/Naver) 비용이 든다 — "서버 비용 없이 사용자 BYOK 키만"이라는
 *   원칙 위반. (E2E나 검색 키가 없는 환경에서는 실행기 목록에서 이미 빠지지만, 키가 있는 운영에서도
 *   이 목록이 막는다.)
 *
 * 공개 API는 **서버 LLM 키를 쓰지 않는다**(서버의 FMP·Yahoo 시장 데이터 키는 쓴다 — 아래). 감사(2026-10):
 *
 * `run_fresh_analysis`는 내보낸다 — 단 에이전트 구현(서버 키로 LLM 호출)이 아니라 사용자 BYOK 키만 쓰는
 * `runByokFreshAnalysis`로 간다(`executePublicTool`).
 * - 분석 생성(기술·종합·뉴스·옵션)은 모두 사용자 키로만 나간다 — 서버 키 env는 읽지 않고, core에
 *   `keyPolicy: 'byok-only'`를 보내 모델 등급·tier와 무관하게 사용자 키만 쓰게 하며, 키 없이 생성하려는
 *   호출은 core를 부르기 전에 거절한다(`resolveCallerKeyOptions`). 캐시 확인도 같은 정책으로, 적중이면
 *   키 없이 돌려주고 미스면 키 게이트 전에 `miss_no_trigger`로 끝난다.
 * - 분석 결과의 쉬운 말 재작성(`rewriteToPlainLanguage`)·언어 번역(`translateAnalysisForLocale`)은 SSE 분석
 *   라우트의 후처리일 뿐 이 경로에 없다 — 생성 언어는 core의 `locale`로 정해진다.
 *
 * 서버 키 LLM이 닿을 수 있는 곳은 두 군데였고 둘 다 막았다:
 * - `get_news`의 `ensureSymbolData`(FMP 적재 + 뉴스 카드 분석)는 `refreshSymbolData: false`로 끈다 —
 *   저장된 기사만 돌려준다.
 * - 회사명 한글 번역(`translateCompanyNames`, 서버 Gemini 키)은 `search_ticker`의 `searchTicker`와
 *   `getAssetInfo`(`resolveMarketProfile`·`resolveAssetInfoOrNull`이 거치는 길 전부, `run_fresh_analysis`의
 *   입력 조립 포함)에서 일어났다. `executePublicTool`이 도구 흐름을 `runWithoutServerLlm`으로 감싸 이 호출을
 *   건너뛴다 — 영문 이름으로 답하고, 번역 없는 결과는 웹이 읽는 캐시·임시 항목이 아니라 API 전용 키(1시간)에만
 *   남겨 웹의 번역을 막지 않으면서 반복 호출이 FMP/Yahoo를 다시 부르지 않게 한다. 번역 함수 자체도 같은 정책을 마지막으로 한 번 더 확인한다(`koreanTranslator`).
 *
 * `get_analyst_views`·`get_macro_quotes`(2026-11): LLM은 부르지 않지만 Yahoo Finance의 비공식 엔드포인트
 *   (`quoteSummary`·선물/환율 `quote`·`chart`)를 읽는다. Yahoo는 재배포 약관이 없어 제3자 개발자에게 그대로
 *   내보내면 라이선스 위험이 커서 **공개 API에서는 제외**한다. SiglensAI 에이전트에서만 쓴다.
 *   `get_fundamentals`는 공개 API에 남지만, 새 Yahoo 보강 필드(`consensusAnalysts`·`consensusSource`·
 *   `priceTargetSource`·`priceTargetYahoo`·`targetSourcesDisagree`·실적 세션·대체 날짜 등)는
 *   `allowUnofficialSources: false`일 때 도구가 Yahoo를 부르지도 내보내지도 않는다. 미국 종목의 투자의견 건수도
 *   Yahoo 우선인 프로바이더 메서드가 아니라 FMP 자체 값(`getFmpGradesConsensus`, 원래 Redis 키
 *   `fundamental:grades-consensus:<SYM>`)을 읽는다 — 미국 종목의 공개 `get_fundamentals` 출력은 이 변경 전과
 *   같다(FMP 건수, 새 키 없음). 한국 종목은 원래 Yahoo 프로바이더라 그대로다. `consensus`에는 다섯 건수만 싣는다.
 *
 * `get_company_filings`(2026-11): 공개 API에 **노출한다**. LLM을 부르지 않고, SEC EDGAR(공공 자료, 재배포 제한 없음)의
 *   제출 목록·색인·문서와 DB의 CIK 맵(`sec_cik_symbol_map`)만 읽는다. SEC 요청은 `secClient`의 전역 요청 간격과
 *   연락처 User-Agent를 타고, 결과는 에이전트와 같은 공유 캐시(제출 목록 30분, 공시별 제목·본문 30일)를 거쳐
 *   반복 호출이 SEC를 다시 부르지 않는다. 본문 읽기의 턴당 횟수 상한은 core가 세는 에이전트 전용 규칙이고, API는
 *   회원 단위 분당/일 한도(`PUBLIC_API_RATE_LIMITS.data`)가 호출 수를 묶는다.
 *
 * `get_x_posts`(2026-11): **공개 API에서 제외**한다. X 개발자 약관은 X 콘텐츠를 제3자에게 다시 내보내는 것을 제한하고,
 *   X는 읽은 글 수만큼 과금한다 — "서버 비용 없이"라는 API 전제와 맞지 않는다. SiglensAI 에이전트에서만 쓴다.
 *
 * `get_theme_snapshot`·`get_index_history_stats`(2026-11): **공개 API에서 제외**한다. 한국 테마 종목 일봉과 KOSPI·KOSDAQ
 *   월봉이 Yahoo Finance 비공식 엔드포인트를 거친다(재배포 약관 없음). 테마 바스켓은 SIGLENS가 고른 묶음이라
 *   제3자 API 계약으로 고정하기도 이르다. SiglensAI 에이전트에서만 쓴다.
 *
 * `get_swing_history`(2026-11): **공개 API에서 제외**한다. 한국 종목 일봉 이력이 Yahoo Finance 비공식 엔드포인트를
 *   거치고, 미국 종목은 캐시 미스마다 FMP 일봉 구간 6개를 읽는다. SiglensAI 에이전트에서만 쓴다.
 *
 * `get_price_stats`(2026-11): **공개 API에서 제외**한다. 한국 종목·KOSPI·KOSDAQ 일봉 이력이 Yahoo Finance 비공식 엔드포인트를
 *   거치고, 미국 종목은 5년 캐시에 닿지 않는 기간(`max`·10년 등)이면 캐시 미스마다 FMP 일봉 구간 6개를 읽는다(미국 지수는 항상).
 *   종가 이력 위의 계산 결과라 제3자 API 계약으로 고정하기도 이르다. SiglensAI 에이전트에서만 쓴다.
 *
 * `show_chart`(2026-11): **공개 API에서 제외**한다. 답변 아래 그림을 그리는 표시 전용 도구라 결과(`{rendered, kind, summary}`)가
 *   제3자 API 계약에 쓸모가 없고, 그림 데이터는 `emitChart`로만 나가는데 API 실행기에는 그 길이 없다(데이터는 각
 *   데이터 도구가 이미 준다). SiglensAI 에이전트에서만 쓴다.
 *
 * `get_my_watchlist`·`propose_price_alert`(2026-11): **공개 API에서 제외**한다. 관심종목을 API 키로 읽을지는 별도 결정이고,
 *   알림 제안은 카드 블록(`emitChart`)으로만 의미가 있는데 API 실행기에는 그 길이 없다(제안은 아무것도 만들지 않는다).
 *   siglens가 소유한 도구라 core `selectTools`가 모르는 이름이기도 하다 — 제외하지 않으면 명세 없이 노출된다.
 *   SiglensAI 에이전트에서만 쓴다.
 *
 * 나머지 도구의 감사: LLM 호출이 없다.
 * - `get_cached_analysis`·`get_market_overview`·`get_economy`의 AI 산출물은 `peek*`(읽기 전용 캐시/DB)만
 *   읽고 생성하지 않는다.
 * - 시세·봉·재무·옵션·의회 거래·수급(`get_investor_flows`: DB의 13F·FINRA·DART + FMP 내부자·13D/G를 읽어 코드가 계산한
 *   점수표를 압축할 뿐 LLM을 부르지 않는다)·경제 지표는 서버의 **시장 데이터 키**(FMP/Yahoo)를 쓴다.
 *   예외 처리: 한국 종목 `get_investor_flows`의 `krInvestorTrend`(2026-10-24)는 키 없이 네이버 증권의 비공식 모바일 JSON
 *   (`m.stock.naver.com`)을 읽는다. 공식 API·약관이 없는 소스를 제3자 개발자에게 재배포하는 것은 라이선스 위험이 커서
 *   **공개 API에서는 제외**한다 — 실행기를 `allowUnofficialSources: false`로 만들어(`executePublicTool`) 도구가 네이버를
 *   부르지도 않고 `krInvestorTrend`·`trendNote` 키도 응답에서 빠진다. SiglensAI 에이전트에서만 쓴다. LLM이 아니고
 *   공유 캐시를 거치며, 회원 단위 분당/일 한도(`PUBLIC_API_RATE_LIMITS.data`)가 호출 수를 묶는다.
 * - `get_guide`·`get_my_portfolio`·`get_news`(저장분)는 DB(와 보유종목 시세 캐시)만 읽는다.
 *
 * 실행기 목록(`availableToolNames`)에서 빼는 방식이라, 에이전트에 새 도구가 생기면 이
 * 목록에 올리지 않는 한 API에도 자동으로 따라온다 — 새 도구는 위 감사 기준으로 다시 확인한다.
 */
export const PUBLIC_API_EXCLUDED_TOOLS: ReadonlySet<string> = new Set([
    'web_search',
    'get_analyst_views',
    'get_macro_quotes',
    'get_x_posts',
    'get_theme_snapshot',
    'get_index_history_stats',
    'get_swing_history',
    'get_price_stats',
    'show_chart',
    GET_MY_WATCHLIST_TOOL,
    PROPOSE_PRICE_ALERT_TOOL,
]);

/** BYOK 분석 생성 도구. 에이전트 스펙에서 `model` 인자와 API 전용 설명을 덧붙여 내보낸다. */
export const PUBLIC_API_FRESH_ANALYSIS_TOOL = 'run_fresh_analysis';

const FRESH_ANALYSIS_DESCRIPTION = `Get an AI analysis for a symbol (kind: technical, overall, news or options) in the same structure as get_cached_analysis. A shared cached analysis is returned at no cost (meta.source "cache"). Otherwise a NEW analysis is generated (usually about a minute, at most ${FRESH_ANALYSIS_DEADLINE_SECONDS} seconds) with YOUR registered LLM key (BYOK only: SIGLENS never spends its own LLM key) and counts against the stricter "ai" rate limit. Any listed model can be generated, but only with a registered key for that model's provider.`;

/**
 * 에이전트 스펙(`inputSchema`: symbol·kind·timeframe)에 API 전용 `model`을 더한다. 생략하면 계정의 "API 기본 모델"이다.
 * 열거값은 로스터 전체다 — 어느 모델이든 캐시 적중은 키 없이 읽고, 미스면 호출자 자신의 provider 키로 생성한다.
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
                    description: `Model to use. Optional: defaults to the API default model set at siglens.io/account, and the request fails with model_required when neither is set. Every model listed here is generated with your own provider key (SIGLENS's own LLM key is never used), so register the key of that model's provider at siglens.io/account.`,
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

/**
 * 공개 API에만 있는 도구(에이전트·core 스펙에는 없다). 시장 데이터 키만 쓰는 읽기 전용 도구이고 LLM을
 * 부르지 않는다(`executePublicTool`이 `runWithoutServerLlm`으로 감싸 이중으로 막는다) — 감사 기준은 위와 같다.
 * 실행은 `createToolExecutor`가 아니라 `getChartDataTool`로 간다.
 */
export const PUBLIC_API_ONLY_TOOL_SPECS: readonly AgentToolSpec[] = [
    CHART_DATA_TOOL_SPEC,
];

/** 에이전트 실행기를 거치지 않고 공개 API가 직접 구현한 도구인가. */
export function isPublicApiOnlyTool(name: string): boolean {
    return PUBLIC_API_ONLY_TOOL_SPECS.some(spec => spec.name === name);
}

/** 공개 API가 노출하는 도구 이름 집합. */
export function publicApiToolNames(): ReadonlySet<string> {
    return new Set(
        [...availableToolNames()].filter(
            name => !PUBLIC_API_EXCLUDED_TOOLS.has(name)
        )
    );
}

/** 노출 도구의 core 스펙(순서는 `AGENT_TOOL_SPECS` 그대로). */
export function publicApiToolSpecs(): AgentToolSpec[] {
    return [
        ...selectTools(publicApiToolNames()).map(toApiSpec),
        ...PUBLIC_API_ONLY_TOOL_SPECS,
    ];
}

/** 노출 도구가 아니면 `undefined` — 제외 목록의 도구도 여기서 걸러진다. */
export function findPublicApiToolSpec(name: string): AgentToolSpec | undefined {
    const apiOnly = PUBLIC_API_ONLY_TOOL_SPECS.find(spec => spec.name === name);
    if (apiOnly !== undefined) return apiOnly;
    const spec = publicApiToolNames().has(name)
        ? findToolSpec(name)
        : undefined;
    return spec === undefined ? undefined : toApiSpec(spec);
}
