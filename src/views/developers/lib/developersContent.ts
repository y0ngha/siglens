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
