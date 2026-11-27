/**
 * 코드 유닛 비교 — 서버 ICU 로케일에 의존하지 않는다. 동률 해소용이라 "사람이 읽는
 * 순서"가 아니라 **어디서 돌려도 같은 순서**가 필요하다(`localeCompare()`는 런타임
 * 기본 로케일을 쓴다).
 */
export function compareCodeUnits(a: string, b: string): number {
    return Number(a > b) - Number(a < b);
}
