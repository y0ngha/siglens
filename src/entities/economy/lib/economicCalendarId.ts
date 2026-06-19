import { createHash } from 'node:crypto';

/**
 * 결정론적 PK 해시 — country + dateEt + event의 SHA-256 hex.
 *
 * `actual`을 의도적으로 제외한다: 발표 후 actual이 채워져도 같은 이벤트로 upsert해
 * 갱신하기 위함(`economic_calendar` 테이블 주석 참조). 구성 요소 사이에 ` `
 * 구분자를 넣어 'a'+'bc'와 'ab'+'c' 같은 경계 충돌을 방지한다.
 */
export function economicCalendarId(
    country: string,
    dateEt: string,
    event: string
): string {
    return createHash('sha256')
        .update(`${country} ${dateEt} ${event}`)
        .digest('hex');
}
