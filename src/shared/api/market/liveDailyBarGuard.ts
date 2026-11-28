import { type Bar, type MarketSessionSpec } from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { isTradingDate, zonedDate } from '@/shared/lib/marketSessionDate';

/** 라이브 일봉(quote 파생)을 버린 이유. */
export type LiveBarDropReason = 'non-trading-day' | 'future-date';

/**
 * quote 시각으로 날짜를 매기는 라이브 일봉이 일봉 이력에 붙어도 되는지 판정한다.
 *
 * FMP `/quote`의 timestamp는 마지막 체결 시각이라 야간 거래(23/5, 일요일 21:00 ET 개시)가
 * 그 시각을 움직이면 라이브 봉 날짜가 일요일이 되거나, 평일 21:00~24:00 ET 체결이 아직
 * 개장 전인 다음 거래일 날짜로 찍힐 수 있다. 어느 쪽이든 직전 종가를 O/H/L/C로 든 봉이
 * 지표·신호·분석 입력으로 흘러가므로, 봉 날짜가 아래에 걸리면 버린다.
 * - 세션 달력상 거래일이 아님(주말·NYSE 휴장일)
 * - 조회 시점 현지(ET) 날짜보다 뒤(야간 체결이 다음 거래일 날짜로 찍힌 경우)
 *
 * 봉 날짜는 세션 타임존의 달력 날짜를 UTC 자정으로 표현한 값이다(`toFmpTodayBar`).
 * 24시간 시장(`always-open`)은 이 가드의 대상이 아니다.
 */
export function liveDailyBarDropReason(
    bar: Bar,
    session: MarketSessionSpec,
    now: Date
): LiveBarDropReason | null {
    if (session.kind === 'always-open') return null;
    const barDate = toUtcIsoDate(new Date(bar.time * MS_PER_SECOND));
    if (!isTradingDate(session, barDate)) return 'non-trading-day';
    if (barDate > zonedDate(now, session.timeZone)) return 'future-date';
    return null;
}

/**
 * `liveDailyBarDropReason`에 걸리면 degrade 로그를 남기고 `null`을, 아니면 봉을 그대로 돌려준다.
 * quote 파생 오늘 봉을 만드는 어댑터가 봉을 내보내기 전에 한 번 거른다 — 일봉 이력에 붙이는 경로,
 * 시세 스냅샷 캐시(분할 경로), 직접 `getTodayBar` 호출자가 전부 같은 규칙을 받는다. 심볼은 공개
 * 티커라 PII가 아니다.
 */
export function keepLiveDailyBar(
    bar: Bar,
    session: MarketSessionSpec,
    now: Date,
    symbol: string
): Bar | null {
    const dropCause = liveDailyBarDropReason(bar, session, now);
    if (dropCause === null) return bar;
    console.warn(
        '[liveDailyBarGuard] live daily bar dropped:',
        symbol,
        dropCause,
        toUtcIsoDate(new Date(bar.time * MS_PER_SECOND))
    );
    return null;
}
