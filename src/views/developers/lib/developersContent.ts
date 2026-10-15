/**
 * `/developers` 본문의 구조 상수. 문구는 카탈로그(`views.developers`)에 있고, 여기에는 문구가 아닌
 * 것 — 섹션 id와 순서, 헤더 이름, 코드 예시 — 만 둔다. 한도 숫자·경로·도구 목록·오류 코드는 공유 상수와 OpenAPI
 * 빌더에서 읽으므로 여기에 따로 적지 않는다.
 */

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
