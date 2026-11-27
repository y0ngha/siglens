import {
    BUILT_IN_AGENT_TOOL_SET,
    type AgentToolSet,
} from '@y0ngha/siglens-core';
import {
    WATCHLIST_ALERT_ROUTING_ROWS,
    WATCHLIST_ALERT_TOOLS,
    watchlistAlertRuleLines,
} from './watchlistAlertTools';

/**
 * 에이전트가 쓰는 도구 모음: core의 기본 모음에 관심종목·가격대 알림 도구를 **덧붙인** 것이다. 두 도구가 이 턴에
 * 쓸 수 없으면(회원 전용·공개 전) 렌더 결과가 기본 모음과 바이트까지 같다 — 그 동치는
 * `agentToolSet.test.ts`가 지킨다. 도구 명세·라우팅 문구가 core에서 siglens로 옮겨 가면 이 합성이 전체
 * 모음으로 바뀐다.
 */
const BUILT_IN_ROWS = BUILT_IN_AGENT_TOOL_SET.routingRows;

export const AGENT_TOOL_SET: AgentToolSet = {
    ...BUILT_IN_AGENT_TOOL_SET,
    version: `${BUILT_IN_AGENT_TOOL_SET.version}+wp27.1`,
    tools: [...BUILT_IN_AGENT_TOOL_SET.tools, ...WATCHLIST_ALERT_TOOLS],
    // 기본 표의 마지막 줄은 "범위 밖 요청 → 도구 없음"이다. 새 줄은 그 앞에 들어가야 그 줄이 표의 끝으로 남는다.
    routingRows: [
        ...BUILT_IN_ROWS.slice(0, -1),
        ...WATCHLIST_ALERT_ROUTING_ROWS,
        ...BUILT_IN_ROWS.slice(-1),
    ],
    ruleLines: available => [
        ...BUILT_IN_AGENT_TOOL_SET.ruleLines(available),
        ...watchlistAlertRuleLines(available),
    ],
};
