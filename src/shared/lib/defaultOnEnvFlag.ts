/** 기본 켜짐 플래그를 끄는 값(trim·소문자 비교). 그 밖의 값(빈 문자열 포함)과 미설정은 켜짐이다. */
const FALSY_FLAG_VALUES: readonly string[] = ['false', '0', 'off', 'no'];

/**
 * **기본 켜짐** env 플래그의 해석 — 비어 있거나 미설정이면 켜짐, `false`/`0`/`off`/`no`(대소문자·앞뒤 공백 무관)만 끈다.
 * 라이선스 스위치(`FINRA_SHORT_DATA_ENABLED`, `REG_SHO_THRESHOLD_DATA_ENABLED`)가 같은 규칙을 쓴다 — 한쪽만 다르게 읽히면
 * 운영에서 같은 값으로 하나는 꺼지고 하나는 켜진다.
 */
export function isDefaultOnFlagEnabled(raw: string | undefined): boolean {
    const value = raw?.trim().toLowerCase();
    if (value === undefined || value === '') return true;
    return !FALSY_FLAG_VALUES.includes(value);
}
