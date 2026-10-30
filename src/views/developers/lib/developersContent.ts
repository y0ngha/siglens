/**
 * `/developers` 본문의 구조 상수. 문구는 카탈로그(`views.developers`)에 있고, 여기에는 문구가 아닌
 * 것 — 섹션 id와 순서, 코드 예시, 도구 요약 키 — 만 둔다. 한도 숫자·경로·도구 목록·오류 코드는 공유 상수와
 * OpenAPI 빌더에서 읽으므로 여기에 따로 적지 않는다.
 */

import {
    ECONOMY_CALENDAR_DEFAULT_DAYS,
    ECONOMY_CALENDAR_MAX_RANGE_DAYS,
} from '@/shared/config/economyCalendar';

/** 캘린더 기본 일수를 "N주"로 읽어 주는 데 쓰는 한 주의 일수. */
export const DAYS_PER_WEEK = 7;

/** 도구 요약 문구 하나: 카탈로그 키와, 문구에 넣는 ICU 인자. */
export interface ToolSummaryMessage {
    readonly key: string;
    /** 숫자는 도구가 쓰는 상수에서 읽는다 — 문구에 직접 적으면 상수를 바꿀 때 문서만 옛 값으로 남는다(I18N.md#I18-6). */
    readonly values?: Readonly<Record<string, number>>;
}

/**
 * 도구 이름 → 사람용 요약 문구(`tools.summaries.<name>`). 키를 이어 붙여 만들지 않고 리터럴로 적어 둔 표다.
 * 없는 이름은 요약 문단을 생략한다 — 노출 도구마다 요약이 있는지는 `developersToolSummaries` 가드가 카탈로그 쪽에서
 * 막고, 이 표와 카탈로그가 같은 이름을 갖는지는 이 파일의 테스트가 막는다. 이 키들은 `t('…')` 호출로 스캔되지 않으므로
 * `messages/_meta/manualKeys.json`의 `preserve`가 `views.developers.tools.summaries`를 지킨다.
 */
export const TOOL_SUMMARIES: Readonly<Record<string, ToolSummaryMessage>> = {
    get_bars_indicators: { key: 'tools.summaries.get_bars_indicators' },
    get_cached_analysis: { key: 'tools.summaries.get_cached_analysis' },
    get_chart_data: { key: 'tools.summaries.get_chart_data' },
    get_congress_trades: { key: 'tools.summaries.get_congress_trades' },
    get_economy: {
        key: 'tools.summaries.get_economy',
        values: {
            weeks: ECONOMY_CALENDAR_DEFAULT_DAYS / DAYS_PER_WEEK,
            maxDays: ECONOMY_CALENDAR_MAX_RANGE_DAYS,
        },
    },
    get_fundamentals: { key: 'tools.summaries.get_fundamentals' },
    get_guide: { key: 'tools.summaries.get_guide' },
    get_investor_flows: { key: 'tools.summaries.get_investor_flows' },
    get_market_overview: { key: 'tools.summaries.get_market_overview' },
    get_my_portfolio: { key: 'tools.summaries.get_my_portfolio' },
    get_news: { key: 'tools.summaries.get_news' },
    get_options_summary: { key: 'tools.summaries.get_options_summary' },
    get_quote: { key: 'tools.summaries.get_quote' },
    run_fresh_analysis: { key: 'tools.summaries.run_fresh_analysis' },
    search_ticker: { key: 'tools.summaries.search_ticker' },
};

/** 섹션 id 순서가 곧 목차 순서다. */
export const DEVELOPER_SECTION_IDS = [
    'quickstart',
    'authentication',
    'rate-limits',
    'responses',
    'streaming',
    'locale',
    'tools',
    'downloads',
] as const;

/** 본문 섹션 하나의 id. 제목 `h2`의 id이자 목차 링크의 해시다. */
export type DeveloperSectionId = (typeof DEVELOPER_SECTION_IDS)[number];

/** 성공 응답 본문 예시(`data` + `meta`). */
export const SUCCESS_RESPONSE_EXAMPLE = `{
  "data": { "...": "tool result" },
  "meta": { "tool": "get_quote" }
}`;

/** 실패 응답 본문 예시(`error.code` + `error.message`). */
export const ERROR_RESPONSE_EXAMPLE = `{
  "error": {
    "code": "invalid_args",
    "message": "The tool arguments do not match the tool schema."
  }
}`;

/** 계정 화면(키 만들기·BYOK 키 등록). 히어로 버튼과 빠른 시작 링크가 같은 경로를 쓴다. */
export const ACCOUNT_PATH = '/account';

/** 빠른 시작의 첫 호출 예시 도구. 목록 순서가 아니라 이름으로 고른다 — 순서가 바뀌어도 예시가 같다. */
export const QUICKSTART_TOOL = 'search_ticker';

/** Skill 다운로드 파일 이름. 경로(`/skill`)에는 확장자가 없다. */
export const SKILL_FILE_NAME = 'SKILL.md';
