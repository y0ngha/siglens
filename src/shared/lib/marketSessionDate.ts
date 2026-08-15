import { MARKET_CLOSE_HOUR } from '@y0ngha/siglens-core';
import { MS_PER_HOUR } from '@/shared/config/time';
import { getEasternOffsetHours } from '@/shared/lib/eastern';

/**
 * 마감(16:00 ET) 후 FMP EOD 발행까지의 안전 버퍼(시간). 이 시간 전에는 당일을
 * lastClosed로 롤하지 않아, 발행 전 불완전 EOD가 당일 키에 캐시되는 것을 막는다.
 * 버퍼 구간에도 당일 봉은 quote(최종 OHLCV)로 온전히 표시된다.
 */
export const EOD_PUBLISH_BUFFER_HOURS = 4;

/**
 * 마지막으로 마감된(16:00 ET 경과) 미국 정규 세션의 ET 날짜(YYYY-MM-DD)를 반환한다.
 * 서머타임은 getEasternOffsetHours로 반영(여름 마감=20:00 UTC, 겨울=21:00 UTC). 주말은
 * 직전 금요일로 되감는다(공휴일은 미보정 — 그 날짜로 키가 한 번 더 versioning될 뿐 EOD
 * 조회는 실제 마지막 거래일까지 반환하므로 데이터는 정확).
 *
 * EOD_PUBLISH_BUFFER_HOURS: 마감 직후 FMP가 당일 EOD를 아직 발행하지 않았을 수 있으므로,
 * 16:00 ET + 4h(20:00 ET)가 지나야 당일을 lastClosed로 롤한다. 버퍼 구간에는 직전 거래일이
 * lastClosed로 유지되어, 불완전 EOD가 당일 키에 캐시되는 갭을 방지한다.
 *
 * `server-only` 없는 순수 함수로 분리해 둔 이유: bars EOD 캐시 키(`CachedMarketDataProvider`),
 * 시장 공포·탐욕 지수 fetch 경계(`fetchDailyCloses`), sitemap lastmod(`buildPopularEntries`,
 * `buildStaticEntries`)가 **같은 "마지막 마감 세션" 정의를 공유해야** 하기 때문이다.
 * 세 곳이 각자 주말·DST 되감기를 다시 구현하면 조용히 어긋난다.
 */
export function lastClosedSessionDateEt(now: Date): string {
    const et = new Date(
        now.getTime() + getEasternOffsetHours(now) * MS_PER_HOUR
    );
    const dow = et.getUTCDay(); // 0=Sun..6=Sat (ET wall-clock via shifted UTC getters)
    const closedToday =
        1 <= dow &&
        dow <= 5 &&
        et.getUTCHours() >= MARKET_CLOSE_HOUR + EOD_PUBLISH_BUFFER_HOURS;
    const cursor = new Date(
        Date.UTC(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate())
    );
    if (!closedToday) cursor.setUTCDate(cursor.getUTCDate() - 1);
    let day = cursor.getUTCDay();
    while (day === 0 || day === 6) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        day = cursor.getUTCDay();
    }
    return cursor.toISOString().slice(0, 10);
}

/**
 * 마지막으로 마감된 미국 정규 세션의 **마감 순간**(UTC Date)을 반환한다.
 * `lastClosedSessionDateEt`가 고른 세션 날짜에 그 날짜의 ET 오프셋을 적용하므로
 * 여름 20:00 UTC / 겨울 21:00 UTC로 정확히 나온다.
 *
 * sitemap `lastmod`용 — "이 페이지 내용이 마지막으로 바뀐 시점"이 곧 직전 마감이다.
 * 요청 시각(now)을 그대로 쓰면 크롤러가 가져갈 때마다 값이 달라져, 실제로는 바뀌지
 * 않은 페이지에 매번 freshness 신호를 보내게 된다.
 *
 * 오프셋 산정에 세션 날짜의 정오(UTC)를 쓰는 이유: DST 전환은 현지 02:00에 일어나므로
 * 정오는 어느 쪽 전환일에도 전환 이후 구간에 안전하게 들어간다.
 */
export function lastClosedSessionCloseUtc(now: Date): Date {
    const [year, month, day] = lastClosedSessionDateEt(now)
        .split('-')
        .map(Number);
    const noonUtcOnSessionDate = new Date(Date.UTC(year, month - 1, day, 12));
    const offset = getEasternOffsetHours(noonUtcOnSessionDate);

    // ET → UTC: offset은 음수(-4/-5)이므로 빼면 UTC 시각이 된다(16 − (−4) = 20).
    return new Date(Date.UTC(year, month - 1, day, MARKET_CLOSE_HOUR - offset));
}
