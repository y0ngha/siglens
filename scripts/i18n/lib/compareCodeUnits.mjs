/**
 * 코드포인트 순 비교(-1/0/1). `localeCompare`는 ICU 로케일에 의존해 환경마다
 * 출력 순서가 갈리므로 카탈로그·기준선 JSON 정렬의 주 키로 이것을 쓴다.
 *
 * `src/shared/lib/compareCodeUnits.ts`의 사본이다(스크립트는 `src`를 import하지 않는다).
 * 한쪽을 고치면 다른 쪽도 고치고, `scripts/__tests__/compareCodeUnitsParity.test.ts`가 둘의
 * 결과가 같은지 확인한다.
 */
export const compareCodeUnits = (a, b) => Number(a > b) - Number(a < b);
