import { timingSafeEqual } from 'crypto';

/**
 * `Authorization: Bearer <secret>` 헤더를 타이밍 공격에 안전하게 비교한다.
 *
 * 길이를 먼저 비교하는 이유는 `timingSafeEqual`이 길이가 다른 버퍼를 받으면
 * 던지기 때문이다 — 이 조기 반환 자체는 길이를 누설하지만, 시크릿의 *내용*은
 * 누설하지 않으므로 허용 가능한 트레이드오프다.
 *
 * cron/진단 엔드포인트가 공유하는 fail-closed 게이트다. 호출 측은 반드시
 * `process.env.CRON_SECRET`가 비어 있는 경우를 먼저 401로 막아야 한다 —
 * 빈 문자열을 `expected`로 넘기면 `Bearer `(공백 포함)와 일치하는 요청이
 * 통과해버린다.
 */
export function safeBearerCompare(
    actual: string | null,
    expected: string
): boolean {
    if (actual === null) return false;
    const a = Buffer.from(actual);
    const b = Buffer.from(`Bearer ${expected}`);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}
