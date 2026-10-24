/**
 * `LIKE`/`ILIKE` 패턴 안에 사용자 입력을 **글자 그대로** 넣도록 `\`, `%`, `_`를 이스케이프한다.
 *
 * 패턴 안에서 `%`는 "아무 문자열", `_`는 "아무 글자 하나"다. 검색어를 그대로 넣으면 `_`
 * 한 글자가 모든 행에 매칭된다. PostgreSQL `LIKE`의 기본 이스케이프 문자는 `\`라서
 * `ESCAPE` 절 없이 이것만으로 리터럴이 된다(`\` 자신도 이스케이프해야 한다).
 *
 * 값은 Drizzle이 파라미터로 넘기므로 SQL 인젝션과는 무관하다 — 이 함수는 패턴 의미만 다룬다.
 */
export function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, char => `\\${char}`);
}
