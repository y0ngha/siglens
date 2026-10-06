import type {
    BarsData,
    IndicatorResult,
    MarketSessionSpec,
} from '@y0ngha/siglens-core';
import { US_EQUITY_SESSION, isRegularSessionOpen } from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/**
 * Drops the last per-bar element from every per-bar indicator array in lockstep
 * with the forming bar being stripped from `bars`. Whole-series snapshot fields
 * (volumeProfile, smc) are left untouched.
 *
 * Per-bar fields fall into three shapes:
 *   1. Plain arrays (`rsi`, `macd`, `bollinger`, etc.) — direct `.slice(0, -1)`.
 *   2. Record-of-arrays (`ma`, `ema`: `Record<number, (number|null)[]>`) —
 *      all values are arrays → slice each value array.
 *   3. Snapshot objects (`volumeProfile`: VolumeProfileResult|null, `smc`: SMCResult) —
 *      NOT all values are arrays (e.g. smc.premiumZone is an object, not an array)
 *      → pass through untouched.
 *
 * The "all values are arrays" predicate is the distinguishing heuristic:
 *   - ma/ema entries: every value is `(number|null)[]` → allArrays = true → slice.
 *   - smc: premiumZone/discountZone/equilibriumZone are objects → allArrays = false → skip.
 *   - volumeProfile: it is `null` or a single object with non-array props → skip.
 *
 * CAVEAT: this heuristic relies on snapshot fields (volumeProfile, smc) having at least
 * one non-array value. If `@y0ngha/siglens-core` adds a new snapshot field where every
 * value happens to be an array (e.g. `{ segments: [], zones: [] }`), it will be wrongly
 * sliced. When upgrading siglens-core, audit any new IndicatorResult fields for this case.
 * Tracked: https://github.com/y0ngha/siglens/issues/576 (whitelist-based hardening).
 */
function dropLastIndicatorBar(indicators: IndicatorResult): IndicatorResult {
    // safe: Object.fromEntries preserves every key of `indicators`, only removing
    // the last element from per-bar arrays — runtime shape is structurally identical
    // to IndicatorResult.
    return Object.fromEntries(
        Object.entries(indicators).map(([key, value]) => {
            if (Array.isArray(value)) {
                return [key, value.slice(0, -1)];
            }
            if (value !== null && typeof value === 'object') {
                // Could be Record<number, array> (ma/ema) or a snapshot object (volumeProfile/smc).
                // Distinguish by checking whether ALL values of this object are arrays.
                // safe: guarded by `typeof value === 'object' && value !== null` above —
                // any non-null object is string-indexable, so Object.entries accepts it.
                const entries = Object.entries(
                    value as Record<string, unknown>
                );
                const allArrays =
                    entries.length > 0 &&
                    entries.every(([, v]) => Array.isArray(v));
                if (allArrays) {
                    return [
                        key,
                        Object.fromEntries(
                            // safe: allArrays(=true) verified Array.isArray(v) for every entry above.
                            entries.map(([k, v]) => [
                                k,
                                (v as unknown[]).slice(0, -1),
                            ])
                        ),
                    ];
                }
                return [key, value];
            }
            return [key, value];
        })
    ) as unknown as IndicatorResult;
}

/**
 * 지금 **형성 중(forming) 봉이 있을 수 있는가** — 정규장이 열려 있으면 참이다(crypto는 24/7이라 항상 참).
 *
 * "있을 수 있는가"다. 세션이 열려 있어도 시리즈에 오늘 봉이 아직 없을 수 있다(개장 직후 quote 미반영,
 * 휴장 직후 등) — 그 경우 `quantizeBarsDataToLastClosed`는 아무것도 떼지 않는다(마지막 봉이 현재 세션
 * 날짜의 봉일 때만 뗀다). 그래서 이 함수는 quantize의 "떼는 조건"이 아니라 그 **필요조건**이다.
 *
 * 쓰이는 곳은 둘 다 클라이언트의 seed 복원 재조회(`shouldRefetchBarsSeed`)를 게이트한다.
 * - **생성 시점**(`page.tsx`의 `seedHasFormingBarTrimmed`): ISR HTML을 만들 때 정규장이 열려 있었는가.
 *   장중에 만든 HTML을 장 마감 뒤에 열면 seed에 그날 마지막 봉이 없을 수 있고, 그 사이 만들어진 분석의
 *   작도는 그 봉 시각을 참조한다(PR #957). 실제로 뗐는지가 아니라 세션 기준이어야 그 경로가 닫힌다.
 * - **뷰 시점**(`ChartContent`의 `formingBarNow`): 지금 열려 있으면 라이브 봉을 받으러 간다.
 *
 * 형성 중 봉이 seed에서 빠졌으면 서버가 형성 중 봉 시각을 참조하는 분석 작도(`chartOverlays`)는 seed 봉에
 * 맞지 않아 "차트 작도" 메뉴가 비므로(`isOverlayAlignedToBars`), 그 재조회는 사람 입력을 기다리면 안 된다.
 */
export function hasFormingBar(session: MarketSessionSpec, now: Date): boolean {
    return isRegularSessionOpen(session, now);
}

/**
 * 시리즈의 마지막 봉이 **지금 진행 중인 세션의 봉**인가.
 *
 * 일봉 `Bar.time`은 세션 날짜의 UTC 자정이다. 현재 세션 날짜는 스케줄 세션이면 거래소 현지
 * 달력(`session.timeZone` — KST/ET), 24/7(crypto)이면 UTC 날짜다. 그 날짜의 UTC 자정 이상이면
 * 현재 세션의 봉이다(`>=`라 분봉 같은 장중 시각 봉도 같은 판정을 받는다).
 *
 * 이 판정이 없던 옛 quantize는 정규장이면 **무조건** 마지막 봉을 뗐다. 오늘 봉이 아직 없는 시리즈
 * (개장 직후, 휴장 직후 quote 봉 부재)에서는 확정된 직전 거래일 봉을 떼어 한 세션 뒤처진 값을 냈다
 * (2026-10-06 373220.KS: 10-02 종가 대신 09-30 종가를 표기).
 */
function lastBarIsCurrentSession(
    lastBarTime: number,
    session: MarketSessionSpec,
    now: Date
): boolean {
    const sessionToday =
        session.kind === 'always-open'
            ? toUtcIsoDate(now)
            : zonedDate(now, session.timeZone);
    return (
        lastBarTime * MS_PER_SECOND >= Date.parse(`${sessionToday}T00:00:00Z`)
    );
}

/**
 * SSR 직렬화 전용: 정규장 중에는 진행 중(forming) 당일 봉을 bars와 indicators 양쪽에서
 * lockstep으로 제외해 SSR 출력이 장 마감 시 하루 1회만 변경되게 한다(ISR write churn 제거).
 *
 * 차트·fear-greed 페이지는 일봉(DEFAULT_TIMEFRAME='1Day') BarsData를 TechnicalFactsSummary와
 * dehydrate seed로 SSR HTML에 박는다. bars Redis TTL이 장중 60초라, 가공 없이 박으면 ISR
 * 재생성마다 forming 봉의 가격과 지표값(RSI/MACD/etc.)이 달라 매번 ISR write가 발생한다
 * (= $25/사이클의 주범). indicators도 per-bar 배열이므로 forming 봉의 마지막 원소를 함께 제거해야
 * buildTechnicalFacts의 lastNonNull(rsi) 등이 완료 봉 기준으로 읽힌다.
 *
 * 정규장 중에 **마지막 봉이 오늘(현재 세션) 봉일 때만** 제외한다 — 그 봉이 아직 확정되지 않은(forming)
 * 봉이다 → SSR 출력이 장 마감 시 하루 1회만 변경된다. 장 마감 후·주말·휴일에는 마지막 봉이 이미
 * 완료이므로 보존하고, 정규장 중이어도 마지막 봉이 이전 세션 날짜면(오늘 봉이 아직 없음) 그 봉은
 * 확정된 봉이라 보존한다.
 * 클라이언트(useBars/getBarsAction)는 이 함수를 거치지 않으므로 사용자는 라이브 가격을 그대로 본다.
 *
 * volumeProfile / smc은 전체 시리즈 스냅샷이므로 슬라이스 대상에서 제외한다.
 */
export function quantizeBarsDataToLastClosed(
    data: BarsData,
    now: Date,
    session: MarketSessionSpec = US_EQUITY_SESSION
): BarsData {
    if (data.bars.length === 0 || !hasFormingBar(session, now)) return data;
    const lastBar = data.bars[data.bars.length - 1]!;
    if (!lastBarIsCurrentSession(lastBar.time, session, now)) return data;
    return {
        ...data,
        bars: data.bars.slice(0, -1),
        indicators: dropLastIndicatorBar(data.indicators),
        // 공포·탐욕용 5년 일봉도 같은 형성 중 봉을 끝에 달고 있다 — 함께 떼어야
        // 서버 점수가 표준 봉과 같은 날까지만 본다.
        ...(data.fearGreedBars !== undefined
            ? { fearGreedBars: data.fearGreedBars.slice(0, -1) }
            : {}),
    };
}
