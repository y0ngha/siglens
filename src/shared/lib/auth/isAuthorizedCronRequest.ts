import { safeBearerCompare } from './safeBearerCompare';

/**
 * cron·진단 엔드포인트의 `Authorization: Bearer $CRON_SECRET` 게이트.
 *
 * **fail-closed**: `CRON_SECRET`이 비어 있으면 무조건 거부한다. 빈 문자열을
 * `safeBearerCompare`에 그대로 넘기면 `Bearer `(공백만)와 일치하는 요청이
 * 통과해 버리므로, 비교 전에 여기서 막는다 — 이 순서를 라우트마다 다시 쓰지
 * 않도록 한 곳에 둔다.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false;
    return safeBearerCompare(request.headers.get('authorization'), expected);
}
