/**
 * 스냅샷 프로즈의 "기준일" 캡션용 포맷터.
 *
 * 로케일과 타임존을 명시 고정한다 — 서버 환경의 기본 로케일/TZ에 의존하면 같은
 * 스냅샷이 환경에 따라 다른 문자열로 렌더되어 ISR 캐시 엔트리 간 출력이 흔들린다.
 * 미국 장마감 기준이므로 타임존은 America/New_York을 쓴다(EST/EDT 자동 처리).
 *
 * 입력은 DB 행의 `generatedAt`이어야 한다. 렌더 중 `new Date()`를 넣으면 재검증
 * 시점마다 값이 바뀌어 결정적 출력 원칙이 깨진다.
 */
const SNAPSHOT_AS_OF_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
});

export function formatSnapshotAsOf(date: Date): string {
    return SNAPSHOT_AS_OF_FORMATTER.format(date);
}
