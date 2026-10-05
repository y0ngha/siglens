import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { MS_PER_DAY } from '@/shared/config/time';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';

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
 * 프로덕션 이미지의 ICU는 `Dockerfile`의 빌드 가드(`scripts/assert-icu-locale.mjs`)가
 * 이 포맷(연 숫자·월 이름·일 숫자) 옵션 조합을 브라우저 기대값과 직접 대조한다 —
 * 그래서 `formatToParts`로 재작성할 필요가 없다.
 */
const SNAPSHOT_TIME_ZONE_BY_PROFILE: Record<MarketProfileId, string> = {
    'us-equity': 'America/New_York',
    'kr-equity': 'Asia/Seoul',
    crypto: 'UTC',
};

/**
 * 로케일 × 시장 조합으로 포맷터를 캐시한다.
 *
 * `Intl.DateTimeFormat` 생성은 싸지 않고 이 캡션은 종목 페이지 9개 탭 전부에
 * 렌더된다. 예전에는 시장별 상수 3개를 모듈 스코프에 두었는데, 로케일이
 * `'ko-KR'`로 **고정**돼 있어 `/en/AAPL`이 `2026년 8월 18일`을 찍었다.
 */
function formatterFor(locale: Locale, marketProfile: MarketProfileId) {
    return cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: SNAPSHOT_TIME_ZONE_BY_PROFILE[marketProfile],
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

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
    marketProfile: MarketProfileId,
    locale: Locale,
    withTime = false
): string | null {
    if (Number.isNaN(date.getTime())) return null;
    const formatted = formatterFor(locale, marketProfile).format(date);
    return withTime ? `${formatted} ${utcClockTime(date)}` : formatted;
}

/**
 * `HH:mm`(UTC). `Intl`의 시간 옵션을 쓰지 않는다 — 시·분 표기는 로케일·ICU 버전마다 달라
 * (`h23`·오전/오후·"at") 서버 이미지의 ICU 차이가 곧 hydration mismatch가 된다
 * (`scripts/assert-icu-locale.mjs`가 막는 부류). 숫자 두 자리는 환경과 무관하다.
 */
function utcClockTime(date: Date): string {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

/** 스냅샷 `content`와 행에서 읽은 기준 후보. 없으면 `null`/생략. */
export interface SnapshotAsOfCandidates {
    /** 분석에 쓴 마지막 봉의 시작 시각(`dataAsOf.barTime`). */
    readonly barTime?: Date | null;
    /** 분석 실행 시각(`analyzedAt`). */
    readonly analyzedAt?: Date | null;
    /** 스냅샷 행의 생성 시각 — 마지막 폴백. */
    readonly generatedAt?: Date | null;
}

export interface ResolvedSnapshotAsOf {
    /** `formatSnapshotAsOf`에 넘길 순간. */
    readonly instant: Date;
    /** 시각(HH:mm UTC)까지 표시하는가 — 크립토만. */
    readonly withTime: boolean;
}

/** 캡션 정착 버퍼 — `entities/seo-snapshot/lib/freshness`의 30분과 같은 값이다. */
const CAPTION_SETTLE_BUFFER_MINUTES = 30;

function validDate(date: Date | null | undefined): Date | null {
    return date != null && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * 캡션이 말할 **데이터 기준일**을 정한다. 렌더 중 `new Date()`를 쓰지 않는다 — 입력은
 * 전부 저장된 값이라 같은 스냅샷은 언제 렌더해도 같은 문자열이다.
 *
 * 예전 캡션은 행의 `generatedAt`(프리웜이 행을 쓴 날)을 그대로 찍었다. 그러나 글은 그 시점의
 * 데이터가 아니라 **분석에 쓴 봉**의 글이다 — 한국 종목을 전날 저녁에 만든 분석이 다음 날
 * 아침 행으로 저장되면 "오늘 기준"으로 읽혔다.
 *
 * **주식(US·KR)**: 기준 시각에서 그 시장의 **직전 완료 세션**의 날짜를 낸다(정착 버퍼 30분 동일).
 * 기준 후보 순서는 `barTime` → `analyzedAt` → `generatedAt`이다.
 *  - `analyzedAt`·`generatedAt`은 "그 순간 이전의 마지막 완료 세션"이다.
 *  - `barTime`은 봉의 **시작**이라 그 순간 이전에는 아직 그 세션이 마감되지 않았다. 하루를
 *    더해서 "그 봉이 속한 세션"이 직전 완료 세션이 되게 한다(시장 타임존 자정이든 UTC 자정이든
 *    봉 시작은 해당 세션 당일 안에 있고 마감은 24시간 안에 온다).
 *
 * **크립토**: 일봉이 장중에도 움직여 분석 가격은 특정 **시각**의 시세다 — 날짜와 시각(UTC)까지
 * 낸다. 일봉 시작(`barTime`)은 항상 00:00이라 시세 시각을 말해 주지 못하므로 `analyzedAt` →
 * `generatedAt` → `barTime` 순으로 읽는다.
 *
 * 후보가 하나도 유효하지 않으면 `null` — 호출부는 고정 폴백 캡션을 쓴다.
 */
export function resolveSnapshotAsOf(
    candidates: SnapshotAsOfCandidates,
    marketProfile: MarketProfileId
): ResolvedSnapshotAsOf | null {
    const barTime = validDate(candidates.barTime);
    const analyzedAt = validDate(candidates.analyzedAt);
    const generatedAt = validDate(candidates.generatedAt);

    if (marketProfile === 'crypto') {
        const instant = analyzedAt ?? generatedAt ?? barTime;
        return instant === null ? null : { instant, withTime: true };
    }

    const spec = sessionSpecFor(marketProfile);
    if (barTime !== null) {
        return {
            instant: lastClosedSessionCloseUtc(
                spec,
                new Date(barTime.getTime() + MS_PER_DAY),
                CAPTION_SETTLE_BUFFER_MINUTES
            ),
            withTime: false,
        };
    }
    const instant = analyzedAt ?? generatedAt;
    return instant === null
        ? null
        : {
              instant: lastClosedSessionCloseUtc(
                  spec,
                  instant,
                  CAPTION_SETTLE_BUFFER_MINUTES
              ),
              withTime: false,
          };
}
