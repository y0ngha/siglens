/**
 * 코드 유닛 순 비교(-1/0/1). 서버 ICU 로케일에 의존하지 않으므로 **어디서 돌려도 같은 순서**가
 * 나온다(`localeCompare()`는 런타임 기본 로케일을 쓴다). 사람이 읽는 순서가 아니라 결정적 순서가
 * 필요한 곳에 쓴다: 정렬의 주 키(해시 입력·JSON 키 정렬·접수번호 순)와 동률 해소용 보조 키 모두.
 *
 * `scripts/i18n/lib/compareCodeUnits.mjs`에 같은 정의의 사본이 있다(스크립트는 `src`를 import하지
 * 않는다). 둘은 `scripts/__tests__/compareCodeUnitsParity.test.ts`가 같은 결과를 내는지 확인한다.
 */
export function compareCodeUnits(a: string, b: string): number {
    return Number(a > b) - Number(a < b);
}
