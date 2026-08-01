/**
 * 스냅샷 프로즈의 "기준일" 캡션용 포맷터.
 *
 * 로케일과 타임존을 명시 고정한다 — 서버 환경의 기본 로케일/TZ에 의존하면 같은
 * 스냅샷이 환경에 따라 다른 문자열로 렌더되어 ISR 캐시 엔트리 간 출력이 흔들린다.
 * 미국 장마감 기준이므로 타임존은 America/New_York을 쓴다(EST/EDT 자동 처리).
 *
 * 입력은 DB 행의 `generatedAt`이어야 한다. 렌더 중 `new Date()`를 넣으면 재검증
 * 시점마다 값이 바뀌어 결정적 출력 원칙이 깨진다.
 *
 * 프로덕션 `node:22-alpine` 이미지의 full-ICU가 사전 검증되어 있어(Intl 옵션이
 * 로케일/월 이름을 항상 완전히 지원) `formatToParts`로 재작성할 필요는 없다.
 */
const SNAPSHOT_AS_OF_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
});

/**
 * `date`가 Invalid Date이면 `null`을 반환한다 — 절대로 throw하지 않는다.
 *
 * `Intl.DateTimeFormat.format()`은 Invalid Date에 `RangeError: Invalid time
 * value`를 던진다. 이 함수는 ISR-생성 페이지의 React 렌더 안에서 호출되므로,
 * 그 RangeError는 `getSeoSnapshotsStatic`의 try/catch로도 잡히지 않는다(렌더는
 * 그 함수의 바깥이다) — 이 저장소가 문서화한 "uncaught loader throw가 빈 ISR
 * 캐시 엔트리를 굳혀버린" 인시던트와 동일한 실패 클래스다. 호출부는 `null`을
 * `asOf === undefined`와 동일하게 취급해 고정 캡션으로 폴백해야 한다 — 잘못된
 * 값은 렌더를 멈추는 게 아니라 항상 안전하게 degrade해야 한다.
 */
export function formatSnapshotAsOf(date: Date): string | null {
    if (Number.isNaN(date.getTime())) return null;
    return SNAPSHOT_AS_OF_FORMATTER.format(date);
}
