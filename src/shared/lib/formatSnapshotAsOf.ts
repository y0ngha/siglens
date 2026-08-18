import type { MarketProfileId } from '@/shared/config/marketProfile';

/**
 * 스냅샷 프로즈의 "기준일" 캡션용 포맷터 — 시장별로 하나씩 고정한다.
 *
 * 로케일과 타임존을 명시 고정한다 — 서버 환경의 기본 로케일/TZ에 의존하면 같은
 * 스냅샷이 환경에 따라 다른 문자열로 렌더되어 ISR 캐시 엔트리 간 출력이 흔들린다.
 *
 * 타임존은 시장마다 다르다: us-equity는 America/New_York(EST/EDT 자동 처리),
 * kr-equity는 Asia/Seoul(DST 없음). crypto는 특정 거래소 마감이 없는 24/7
 * 시장이라 어느 지역 타임존도 "그 시장의 마감"을 의미하지 않으므로 UTC를 쓴다.
 * 예전에는 세 시장 전부 America/New_York 하나로 포맷했다 — 한국 주식·크립토
 * 페이지가 "미국 장마감 기준"을 자처했고, 뉴욕 타임존이 표시 날짜를 하루
 * 밀거나 당길 수도 있었다(SEO 감사 실측).
 *
 * `Record<MarketProfileId, …>`로 세 값을 모두 채워야 컴파일이 통과한다 — 새
 * market profile이 추가되면 여기를 반드시 고치게 된다.
 *
 * 프로덕션 `node:22-alpine` 이미지의 full-ICU가 사전 검증되어 있어(Intl 옵션이
 * 로케일/월 이름을 항상 완전히 지원) `formatToParts`로 재작성할 필요는 없다.
 */
const SNAPSHOT_AS_OF_FORMATTER_BY_PROFILE: Record<
    MarketProfileId,
    Intl.DateTimeFormat
> = {
    'us-equity': new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }),
    'kr-equity': new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }),
    crypto: new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }),
};

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
export function formatSnapshotAsOf(
    date: Date,
    marketProfile: MarketProfileId
): string | null {
    if (Number.isNaN(date.getTime())) return null;
    return SNAPSHOT_AS_OF_FORMATTER_BY_PROFILE[marketProfile].format(date);
}
