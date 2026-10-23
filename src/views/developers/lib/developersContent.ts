/**
 * `/developers` 본문의 구조 상수. 문구는 카탈로그(`views.developers`)에 있고, 여기에는 문구가 아닌
 * 것 — 섹션 id와 순서, 헤더 이름, 코드 예시 — 만 둔다. 한도 숫자·경로·도구 목록·오류 코드는 공유 상수와 OpenAPI
 * 빌더에서 읽으므로 여기에 따로 적지 않는다.
 */

import {
    ECONOMY_CALENDAR_DEFAULT_DAYS,
    ECONOMY_CALENDAR_MAX_RANGE_DAYS,
} from '@/shared/config/economyCalendar';

const DAYS_PER_WEEK = 7;

/**
 * 도구 요약 문구(`tools.summaries.<name>`)에 넣는 ICU 인자. 숫자는 도구가 쓰는 상수에서 읽는다 —
 * 문구에 직접 적으면 상수를 바꿀 때 문서만 옛 값으로 남는다(CONVENTIONS.md#I18-6).
 */
export const TOOL_SUMMARY_VALUES: Readonly<
    Record<string, Readonly<Record<string, number>>>
> = {
    get_economy: {
        weeks: ECONOMY_CALENDAR_DEFAULT_DAYS / DAYS_PER_WEEK,
        maxDays: ECONOMY_CALENDAR_MAX_RANGE_DAYS,
    },
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

export type DeveloperSectionId = (typeof DEVELOPER_SECTION_IDS)[number];

export const SUCCESS_RESPONSE_EXAMPLE = `{
  "data": { "...": "tool result" },
  "meta": { "tool": "get_quote" }
}`;

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
