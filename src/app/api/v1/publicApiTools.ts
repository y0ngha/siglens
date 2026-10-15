import 'server-only';
import {
    findToolSpec,
    selectTools,
    type AgentToolSpec,
} from '@y0ngha/siglens-core';
import { availableToolNames } from '@/app/api/ai/chat/tools/chatTools';

/**
 * 에이전트가 쓰는 도구 중 공개 API에 **내보내지 않는** 것.
 *
 * - `web_search`: 서버의 검색 키(Brave/Naver) 비용이 든다 — "서버 비용 없이 사용자 BYOK 키만"이라는
 *   원칙 위반. (E2E나 검색 키가 없는 환경에서는 실행기 목록에서 이미 빠지지만, 키가 있는 운영에서도
 *   이 목록이 막는다.)
 * - `run_fresh_analysis`: 서버 키로 LLM 분석을 생성하는 경로다. 사용자 BYOK 전용 경로
 *   (`resolveByokOnlyKey`)와 `ai` 한도 버킷이 생기는 PR-B에서 노출한다.
 *
 * 남은 도구에 서버 비용이 새지 않는지의 감사(2026-10):
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
    'run_fresh_analysis',
]);

export function publicApiToolNames(): ReadonlySet<string> {
    return new Set(
        [...availableToolNames()].filter(
            name => !PUBLIC_API_EXCLUDED_TOOLS.has(name)
        )
    );
}

/** 노출 도구의 core 스펙(순서는 `AGENT_TOOL_SPECS` 그대로). */
export function publicApiToolSpecs(): AgentToolSpec[] {
    return selectTools(publicApiToolNames());
}

/** 노출 도구가 아니면 `undefined` — 제외 목록의 도구도 여기서 걸러진다. */
export function findPublicApiToolSpec(name: string): AgentToolSpec | undefined {
    return publicApiToolNames().has(name) ? findToolSpec(name) : undefined;
}
