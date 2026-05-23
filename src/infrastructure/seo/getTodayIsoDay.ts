/**
 * schema.org Article의 dateModified용 ISO 문자열 — 오늘 0시(UTC)로 양자화한다.
 *
 * 매 요청마다 ISO 정확 시각을 노출하면 Google이 거짓 freshness 신호로 인식해
 * 크롤 우선순위 가중치가 부정확해질 수 있다. 일 단위로 절삭하면 실제 콘텐츠
 * 갱신 빈도(News 등 daily-refresh 페이지)와 정합한다.
 *
 * 반환 형식: `YYYY-MM-DDT00:00:00.000Z`
 *
 * **반드시 서버(RSC / Route Handler / Server Action)에서만 호출**한다. 클라이언트
 * 컴포넌트에서 호출하면 서버 시각과 클라이언트 시각이 달라 hydration mismatch나
 * 의도하지 않은 schema 재작성이 발생할 수 있어 lib 대신 infrastructure에 둔다
 * (lib는 client/server 양쪽 import가 가능해 시한폭탄이 될 위험이 있다).
 */
export function getTodayIsoDay(): string {
    return `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`;
}
