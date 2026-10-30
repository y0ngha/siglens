import type {
    OptionsChain,
    OptionsContract,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { ET_TIME_ZONE } from './etTimeZone';

/**
 * yahoo-finance2 v3 `CallOrPut` 응답을 본뜬 구조적 타입. 라이브러리 deep import 대신 로컬
 * 인터페이스를 쓰는 이유는 프로젝트가 `moduleResolution: "node"`라 type 전용 deep import의
 * subpath export를 해석하지 못하기 때문이다. 필드 형태는 실제 응답의 introspection 결과로
 * 확인했다(`YahooOptionsAdapter`가 이 타입으로 응답을 단언한다).
 */
export interface YahooCallOrPut {
    contractSymbol: string;
    strike: number;
    currency?: string;
    lastPrice: number;
    change: number;
    percentChange?: number;
    volume?: number;
    openInterest?: number;
    bid?: number;
    ask?: number;
    contractSize: 'REGULAR';
    expiration: Date;
    lastTradeDate: Date;
    impliedVolatility: number;
    inTheMoney: boolean;
}

/** yahoo-finance2 `Option` — 만기 하나의 콜/풋 목록. */
export interface YahooOption {
    expirationDate: Date;
    hasMiniOptions: boolean;
    calls: YahooCallOrPut[];
    puts: YahooCallOrPut[];
}

/** yahoo-finance2 `OptionsResult` — `normalizeYahooSnapshot`이 읽는 필드만 담는다. */
export interface YahooOptionsResult {
    underlyingSymbol: string;
    expirationDates: Date[];
    strikes: number[];
    hasMiniOptions: boolean;
    quote: { regularMarketPrice?: number };
    options: YahooOption[];
}

// 정오(UTC) — ET 캘린더 날짜를 UTC 인스턴트로 매핑할 때 DST 전이 윈도우
// (봄·가을 각 몇 시간씩 시각이 모호한 구간)에 걸리지 않도록 하루의 중간
// 시점에 앵커링한다. 자정 대신 정오를 쓰는 이유는 자정 자체가 DST
// 변환 시각이라 시간 산술이 한 시간씩 어긋날 수 있어서.
const ET_NOON_UTC_HOUR = 12;

/**
 * `now`와 같은 *America/New_York 달력 날짜*의 정오(UTC) 인스턴트. 정오를 쓰면 DST 전이
 * 윈도우(봄·가을에 벽시계 값이 모호한 몇 시간)를 피한다.
 *
 * ET 오프셋을 상수(-4h, EDT)로 박으면 EST(-5h)인 약 5개월 동안 하루가 어긋난다. DTE는
 * 일 단위로 반올림하지만 1시간 어긋남도 자정 경계를 넘을 수 있어 IANA 타임존을 아는
 * `zonedDate`(shared/lib/marketSessionDate)로 날짜를 구한다.
 */
function etNoonUtc(now: Date): Date {
    const [year, month, day] = zonedDate(now, ET_TIME_ZONE)
        .split('-')
        .map(Number);
    return new Date(Date.UTC(year, month - 1, day, ET_NOON_UTC_HOUR));
}

/**
 * 오늘(ET)부터 `expirationDate`(`YYYY-MM-DD`)까지의 달력 일수. 0 미만으로는 내려가지 않는다.
 *
 * Yahoo 정규화와 last-good 폴백(`rebaseOptionsSnapshot`)이 함께 써서, 다시 내보내는 스냅샷도
 * 새로 정규화한 스냅샷과 같은 방식으로 일수를 센다.
 */
export function daysToExpirationFrom(
    expirationDate: string,
    now: Date
): number {
    const expMidnight = new Date(`${expirationDate}T00:00:00.000Z`);
    const refNoon = etNoonUtc(now);
    return Math.max(
        0,
        Math.round((expMidnight.getTime() - refNoon.getTime()) / MS_PER_DAY)
    );
}

/**
 * 실제 값으로 읽는 연율 내재변동성(분수)의 하한. 아래에서 살핀 체인 하나에서 Yahoo는 호가가
 * 없는 계약에 `0.00001`과 `0.0039…`를 돌려줬다 — 상장 미국 주식의 ATM 옵션이 거래되는 값이 아니다.
 */
export const MIN_PLAUSIBLE_IMPLIED_VOLATILITY = 0.01;

const hasQuote = (price: number | undefined): boolean =>
    typeof price === 'number' && Number.isFinite(price) && price > 0;

/**
 * Yahoo의 IV. 시장 값이 아니면 `null`이다.
 *
 * 관측 사례: 2026-10-22 09:11 ET(장전)에 받은 MSI 2026-11-20 만기 체인. 현물 $467.50 근처
 * 모든 계약이 bid = ask = 0에 IV 0.00001~0.031이었다. core의 `pickAtmIv`는 null이 아닌 IV가
 * 있는 가장 가까운 행사가를 고르므로 470 콜의 0.0039가 ATM IV가 되어, 에이전트가 29일 만기에
 * ±0.11% 내재 변동폭(466.98–468.02)을 말했다. 그래서 bid도 ask도 없는 IV와
 * {@link MIN_PLAUSIBLE_IMPLIED_VOLATILITY} 미만 IV는 버리고, core는 그 계약을 건너뛴다.
 *
 * 감수한 결과: Yahoo가 호가를 보여주지 않는 시간대(정규장 밖이고 워밍된 last-good이 없는
 * 종목)에 받은 체인은 ATM IV와 내재 변동폭이 `null`이다 — 가짜 수치 대신 정직한 "모름"이다.
 */
function marketImpliedVolatility(c: YahooCallOrPut): number | null {
    const iv = c.impliedVolatility;
    if (typeof iv !== 'number' || !Number.isFinite(iv)) return null;
    if (iv < MIN_PLAUSIBLE_IMPLIED_VOLATILITY) return null;
    if (!hasQuote(c.bid) && !hasQuote(c.ask)) return null;
    return iv;
}

/**
 * 콜/풋 계약 하나를 `OptionsContract`로 바꾼다. 도메인 타입은 `volume`·`openInterest`를 null
 * 없는 `number`로 다루므로 이 경계에서 `?? 0`을 적용하고, 가격·IV 필드는 `number | null`을
 * 그대로 둔다.
 */
export function normalizeYahooContract(c: YahooCallOrPut): OptionsContract {
    return {
        contractSymbol: c.contractSymbol,
        strike: c.strike,
        lastPrice: c.lastPrice ?? null,
        bid: c.bid ?? null,
        ask: c.ask ?? null,
        volume: c.volume ?? 0,
        openInterest: c.openInterest ?? 0,
        impliedVolatility: marketImpliedVolatility(c),
        inTheMoney: c.inTheMoney,
    };
}

/** 만기 하나의 `YahooOption`을 `OptionsChain`으로 바꾼다. 계약은 행사가 오름차순이다. */
export function normalizeYahooExpiration(
    yexp: YahooOption,
    now: Date
): OptionsChain {
    const expirationDate = toUtcIsoDate(yexp.expirationDate);

    const daysToExpiration = daysToExpirationFrom(expirationDate, now);

    const calls = yexp.calls
        .map(normalizeYahooContract)
        .toSorted((a, b) => a.strike - b.strike);

    const puts = yexp.puts
        .map(normalizeYahooContract)
        .toSorted((a, b) => a.strike - b.strike);

    return {
        expirationDate,
        daysToExpiration,
        calls,
        puts,
    };
}

/**
 * `YahooOptionsResult`를 `OptionsSnapshot`으로 바꾼다. 체인은 만기 오름차순이고, 현물가가
 * 없으면 `underlyingPrice`는 0이다(어댑터가 0을 "데이터 없음"으로 거른다).
 */
export function normalizeYahooSnapshot(
    response: YahooOptionsResult,
    now: Date
): OptionsSnapshot {
    const chains = response.options
        .map(exp => normalizeYahooExpiration(exp, now))
        .toSorted((a, b) => a.expirationDate.localeCompare(b.expirationDate));

    return {
        symbol: response.underlyingSymbol,
        underlyingPrice: response.quote.regularMarketPrice ?? 0,
        chains,
        capturedAt: now.toISOString(),
    };
}
