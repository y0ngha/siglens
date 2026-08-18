import {
    US_EQUITY_SESSION,
    CRYPTO_SESSION,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import type { SessionModel } from '@/shared/config/marketProfile/types';

const KR_MARKET_OPEN_MINUTE = 9 * 60; // 09:00 KST
const KR_MARKET_CLOSE_MINUTE = 15 * 60 + 30; // 15:30 KST

/**
 * `KR_MARKET_HOLIDAYS`가 관측을 마친 마지막 날짜(포함, `YYYY-MM-DD`). 이 날짜를
 * 넘어서는 `closeMinuteFor`가 그 날을 알 수 없으므로 정상 개장으로 폴백하고
 * `console.warn`으로 남긴다 — 미래 휴장일을 추측하느니, 과거만 정확히 알고 모르는
 * 구간은 눈에 띄게 근사치를 내는 편이 낫다(core `UNSCHEDULED_CLOSURES`와 같은 이유).
 * 새 관측 구간이 생기면 `KR_MARKET_HOLIDAYS`와 이 값을 함께 늘린다.
 */
export const KR_CALENDAR_HORIZON = '2026-08-18';

/**
 * KRX 정규장이 폐장한 평일 — 규칙이 아니라 리터럴 목록이다.
 *
 * 설·추석은 음력이라 계산식이 없고, 대체공휴일·임시공휴일(선거일 등)은 그때그때
 * 지정돼 미리 규칙으로 도출할 수 없다. yahoo `005930.KS` 일봉과 평일 달력을 대조해
 * 실제로 봉이 없는 평일만 뽑았다(`KR_CALENDAR_HORIZON`까지 관측). 다음 휴장일이
 * 지나면 이 목록에 한 줄을 추가한다.
 */
const KR_MARKET_HOLIDAYS = new Set<string>([
    '2026-01-01',
    '2026-02-16',
    '2026-02-17',
    '2026-02-18',
    '2026-03-02',
    '2026-05-01',
    '2026-05-05',
    '2026-05-25',
    '2026-06-03',
    '2026-07-17',
    '2026-08-17',
]);

const krDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** `now`가 속한 KST 달력 날짜(`YYYY-MM-DD`). KST는 DST가 없어 오프셋 보정이 불필요하다. */
function krCalendarDate(now: Date): string {
    return krDateFormatter.format(now);
}

/**
 * `now`가 속한 KST 달력일의 마감 분. `MarketSessionSpec.closeMinuteFor`와 core
 * `usMarketCloseMinute`가 쓰는 것과 같은 신호(0 = 휴장)를 낸다.
 *
 * 관측 지평선(`KR_CALENDAR_HORIZON`) 밖 날짜는 휴장 여부를 알 수 없으므로 정상
 * 개장으로 폴백하되, `console.warn`으로 CloudWatch에 남겨 조용히 틀리지 않게 한다.
 */
/**
 * 이미 경고한 지평선 밖 날짜. **dedup이 없으면 로그가 폭주한다** — prewarm은 심볼마다
 * `snapshotCloseBoundaryFor`를 부르고 그 안에서 최대 `MAX_REWIND_DAYS`만큼 되감으므로,
 * KR 심볼 100개 × 되감기 ~11회 × 5분 tick이면 하루 10⁴건 규모가 된다. 그렇게 되면
 * 이 줄은 신호가 아니라 소음이 되고, 정작 캘린더를 갱신해야 한다는 사실이 묻힌다.
 */
const warnedBeyondHorizon = new Set<string>();

function krMarketCloseMinuteFor(now: Date): number {
    const date = krCalendarDate(now);
    if (date > KR_CALENDAR_HORIZON) {
        if (!warnedBeyondHorizon.has(date)) {
            warnedBeyondHorizon.add(date);
            console.warn(
                `[KR_EQUITY_SESSION] ${date}는 KR_MARKET_HOLIDAYS 관측 지평선(${KR_CALENDAR_HORIZON}) 밖입니다 — sessionSpecFor.ts의 KR_MARKET_HOLIDAYS/KR_CALENDAR_HORIZON을 갱신하세요. 정상 개장으로 폴백합니다.`
            );
        }
        return KR_MARKET_CLOSE_MINUTE;
    }
    return KR_MARKET_HOLIDAYS.has(date) ? 0 : KR_MARKET_CLOSE_MINUTE;
}

/** 테스트 전용 — 모듈 레벨 dedup 상태를 비운다. */
export function __resetKrHorizonWarnings(): void {
    warnedBeyondHorizon.clear();
}

/**
 * KRX 정규장 세션 — 09:00~15:30 KST, 주말 휴장, `closeMinuteFor`로 휴장일까지 반영.
 *
 * core에 상수를 추가하지 않고 siglens에 두는 이유: `MarketSessionSpec`은 순수
 * 데이터 유니온(`kind`/`timeZone`/`openMinute`/`closeMinute`/`weekendDays`/
 * `closeMinuteFor`)이고, 이 값은 계산식이 아니라 시장 메타데이터다. `SCOPE.md §0`이
 * core로 보내는 트리거(지표 계산식·신호 임계값·프롬프트·캐시 정책)에 해당하지 않는다.
 *
 * `getCachedMarketDataProvider`가 `US_EQUITY_SESSION`/`CRYPTO_SESSION`과 마찬가지로
 * **참조 동일성**으로 이 값을 분기하므로 반드시 모듈 레벨 상수여야 한다 — 호출마다
 * 새 객체를 만들면 provider 싱글톤 분기가 조용히 깨진다.
 *
 * 예전에는 한국 공휴일을 표현하지 않아 KRX 휴장일도 정상 개장으로 취급했다. 그
 * 결과는 데이터 오답 없음이 아니라 `lastClosedSessionCloseUtc`(EOD 캐시 키, sitemap
 * lastmod, SEO freshness 경계가 공유하는 함수)가 실제 마감보다 며칠 앞선 날짜를
 * "마지막 마감"으로 잘못 주장하는 것이었다 — 2026-08-17 대체공휴일(광복절 대체) 실측
 * 사례에서 +3일 과잉 신선도 주장으로 확인됨. `closeMinuteFor`가 그 격차를 없앤다.
 * KST는 DST가 없어 오프셋 계산은 여전히 불필요하다.
 */
export const KR_EQUITY_SESSION: MarketSessionSpec = {
    kind: 'scheduled',
    timeZone: 'Asia/Seoul',
    openMinute: KR_MARKET_OPEN_MINUTE,
    closeMinute: KR_MARKET_CLOSE_MINUTE,
    weekendDays: [0, 6],
    closeMinuteFor: krMarketCloseMinuteFor,
};

/**
 * Map a market profile to the core MarketSessionSpec.
 *
 * The mapping is explicit and exhaustive over `SessionModel` values so that
 * adding a new session model (e.g. 'kr-equity-et') forces a compile-time
 * decision here rather than silently falling through to US_EQUITY_SESSION.
 * The previous `=== 'always-open' ? CRYPTO : US_EQUITY` ternary would
 * mis-classify any future non-equity, non-crypto profile (e.g. 'kr-equity')
 * as US equity without a type error.
 */
export function sessionSpecFor(profile: MarketProfileId): MarketSessionSpec {
    const sessionModel: SessionModel = getDescriptor(profile).sessionModel;
    switch (sessionModel) {
        case 'always-open':
            return CRYPTO_SESSION;
        case 'us-equity-et':
            return US_EQUITY_SESSION;
        case 'kr-equity-kst':
            return KR_EQUITY_SESSION;
        default: {
            // Exhaustiveness guard: TypeScript narrows `sessionModel` to `never`
            // here if all SessionModel variants are handled above. If a new
            // variant is added to SessionModel without updating this switch,
            // the assignment below produces a compile error.
            const _exhaustive: never = sessionModel;
            console.error(
                `[sessionSpecFor] Unhandled SessionModel: ${String(_exhaustive)} — defaulting to US_EQUITY_SESSION`
            );
            return US_EQUITY_SESSION;
        }
    }
}
