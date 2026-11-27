import type {
    Bar,
    GetBarsOptions,
    MarketDataProvider,
    MarketDailyClose,
    MarketQuote,
    MarketSessionSpec,
} from '@y0ngha/siglens-core';
import {
    MINUTES_PER_HOUR,
    MS_PER_DAY,
    MS_PER_MINUTE,
    MS_PER_SECOND,
} from '@/shared/config/time';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import { zonedDate, zonedWallClockToUtc } from '@/shared/lib/marketSessionDate';

/**
 * 골든 테스트의 합성 시장. 종목마다 결정적인 일봉·분봉·시세를 만든다 — 같은 날짜의 값은 조회 창(`from`)과 무관하게
 * 늘 같아서, 같은 종목을 여러 도구가 다른 창으로 읽어도 서로 어긋나지 않는다.
 *
 * 가격은 누적 난수 보행이 아니라 날짜 번호의 닫힌 식이다(완만한 추세 + 두 주기의 물결 + 해시 잡음). 누적이 없어
 * 앞 날짜를 모두 계산하지 않아도 되고, 테스트 보조 코드도 CONVENTIONS.md#CP-6을 지킨다. 실제 공급자처럼 일봉은
 * 거래일 UTC 자정에 찍히고, 휴장일·주말은 세션 규격(`closeMinuteFor`, `weekendDays`)이 정한다.
 */
export interface SeriesSpec {
    /** 기준일(`SERIES_EPOCH`)의 가격. */
    base: number;
    /** 하루 추세 비율(0.0004 = 하루 0.04%). */
    drift: number;
    /** 물결의 위상과 잡음을 종목마다 다르게 하는 값. */
    seed: number;
    /** 평균 거래량. */
    volume: number;
    /** 가격 소수 자릿수(USD 2, KRW 0). */
    decimals: number;
    /** 이 날짜 뒤로는 거래가 없다(죽은 리스팅). */
    lastDate?: string;
    /** 이 날짜 전에는 상장 전이다(짧은 이력). */
    firstDate?: string;
}

export const SERIES_EPOCH = '2020-01-02';

const INTRADAY_MINUTES: Readonly<Record<string, number>> = {
    '5Min': 5,
    '15Min': 15,
    '30Min': 30,
    '1Hour': 60,
    '4Hour': 240,
};

const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const mix = (x: number, multiplier: number, shift: number): number =>
    Math.imul(x ^ (x >>> shift), multiplier);

/** (seed, i, k) → [-1, 1) 결정적 잡음. */
export function noise(seed: number, i: number, k: number): number {
    const start =
        Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^
        Math.imul(i + 1, 0xc2b2ae35) ^
        Math.imul(k + 7, 0x27d4eb2f);
    const mixed = mix(mix(start, 0x2c1b3c6d, 15), 0x297a2d39, 12);
    return (((mixed ^ (mixed >>> 15)) >>> 0) / 0x100000000) * 2 - 1;
}

const roundTo = (value: number, decimals: number): number =>
    Number(value.toFixed(decimals));

const dayIndex = (isoDate: string): number =>
    Math.round(
        (Date.parse(`${isoDate}T00:00:00Z`) -
            Date.parse(`${SERIES_EPOCH}T00:00:00Z`)) /
            MS_PER_DAY
    );

/** 날짜 번호 → 반올림 전 종가. */
function rawClose(spec: SeriesSpec, d: number): number {
    const wave =
        0.09 * Math.sin(d / 29 + spec.seed) +
        0.05 * Math.sin(d / 9.7 + spec.seed * 1.7) +
        0.012 * noise(spec.seed, d, 0);
    return spec.base * (1 + spec.drift) ** d * (1 + wave);
}

export function dailyBarOn(spec: SeriesSpec, isoDate: string): Bar {
    const d = dayIndex(isoDate);
    const close = roundTo(rawClose(spec, d), spec.decimals);
    const open = roundTo(
        rawClose(spec, d - 1) * (1 + 0.004 * noise(spec.seed, d, 1)),
        spec.decimals
    );
    const high = roundTo(
        Math.max(open, close) * (1 + 0.007 * Math.abs(noise(spec.seed, d, 2))),
        spec.decimals
    );
    const low = roundTo(
        Math.min(open, close) * (1 - 0.007 * Math.abs(noise(spec.seed, d, 3))),
        spec.decimals
    );
    const volume = Math.round(
        spec.volume *
            (1 +
                0.35 * Math.sin(d / 5.3 + spec.seed) +
                0.25 * noise(spec.seed, d, 4))
    );
    return {
        time: Date.parse(`${isoDate}T00:00:00Z`) / MS_PER_SECOND,
        open,
        high,
        low,
        close,
        volume,
    };
}

/** 세션 규격으로 본 거래일 — `marketSessionDate.ts`의 판정과 같은 규칙(주말 + `closeMinuteFor`의 휴장 0). */
export function isTradingDate(
    session: MarketSessionSpec,
    isoDate: string
): boolean {
    if (session.kind === 'always-open') return true;
    const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
    if (session.weekendDays.includes(weekday)) return false;
    if (session.closeMinuteFor === undefined) return true;
    const localNoon = zonedWallClockToUtc(
        isoDate,
        12 * MINUTES_PER_HOUR,
        session.timeZone
    );
    return session.closeMinuteFor(localNoon) > 0;
}

function closeMinuteOn(
    session: Extract<MarketSessionSpec, { kind: 'scheduled' }>,
    isoDate: string
): number {
    if (session.closeMinuteFor === undefined) return session.closeMinute;
    return session.closeMinuteFor(
        zonedWallClockToUtc(isoDate, 12 * MINUTES_PER_HOUR, session.timeZone)
    );
}

interface MarketClock {
    /** 시장 현지 날짜. */
    today: string;
    /** 현지 자정부터 지난 분. */
    minutesOfDay: number;
}

function marketClock(session: MarketSessionSpec, now: Date): MarketClock {
    const timeZone = session.kind === 'always-open' ? 'UTC' : session.timeZone;
    const today = zonedDate(now, timeZone);
    const midnight = zonedWallClockToUtc(today, 0, timeZone).getTime();
    return {
        today,
        minutesOfDay: Math.floor((now.getTime() - midnight) / MS_PER_MINUTE),
    };
}

/** 오늘 봉이 이미 생겼는가 — 정규장이 열렸으면(진행 중이든 마감 뒤든) 생긴다. 24시간 시장은 늘 생긴다. */
function todayHasBar(session: MarketSessionSpec, now: Date): boolean {
    if (session.kind === 'always-open') return true;
    const { today, minutesOfDay } = marketClock(session, now);
    return isTradingDate(session, today) && minutesOfDay >= session.openMinute;
}

/** 이 순간 정규장이 진행 중인가. */
export function sessionOpenNow(session: MarketSessionSpec, now: Date): boolean {
    if (session.kind === 'always-open') return true;
    const { today, minutesOfDay } = marketClock(session, now);
    return (
        todayHasBar(session, now) &&
        minutesOfDay < closeMinuteOn(session, today)
    );
}

const maxDate = (a: string, b: string): string => (a > b ? a : b);
const minDate = (a: string, b: string): string => (a < b ? a : b);

function datesBetween(from: string, to: string): string[] {
    if (from > to) return [];
    return Array.from({ length: dayIndex(to) - dayIndex(from) + 1 }, (_, k) =>
        addUtcIsoDays(from, k)
    );
}

/** 공급자가 지금 돌려줄 일봉의 마지막 날짜(오늘 봉이 생겼으면 오늘, 아니면 어제까지). */
function lastBarDate(
    spec: SeriesSpec,
    session: MarketSessionSpec,
    now: Date
): string {
    const { today } = marketClock(session, now);
    const latest = todayHasBar(session, now) ? today : addUtcIsoDays(today, -1);
    return spec.lastDate === undefined
        ? latest
        : minDate(latest, spec.lastDate);
}

export function dailyBars(
    spec: SeriesSpec,
    session: MarketSessionSpec,
    now: Date,
    from?: string
): Bar[] {
    const start = maxDate(
        maxDate(SERIES_EPOCH, spec.firstDate ?? SERIES_EPOCH),
        from === undefined ? SERIES_EPOCH : from.slice(0, 10)
    );
    return datesBetween(start, lastBarDate(spec, session, now))
        .filter(date => isTradingDate(session, date))
        .map(date => dailyBarOn(spec, date));
}

function intradayBars(
    spec: SeriesSpec,
    session: MarketSessionSpec,
    now: Date,
    minutes: number,
    from: string
): Bar[] {
    const nowSeconds = Math.floor(now.getTime() / MS_PER_SECOND);
    return dailyBars(spec, session, now, from).flatMap(day => {
        const date = toUtcIsoDate(new Date(day.time * MS_PER_SECOND));
        const open = session.kind === 'always-open' ? 0 : session.openMinute;
        const close =
            session.kind === 'always-open'
                ? MINUTES_PER_DAY
                : closeMinuteOn(session, date);
        const zone = session.kind === 'always-open' ? 'UTC' : session.timeZone;
        const slots = Math.ceil((close - open) / minutes);
        const d = dayIndex(date);
        return Array.from({ length: slots }, (_, k): Bar => {
            const startMinute = open + k * minutes;
            const fraction = (k + 1) / slots;
            const mid =
                day.open +
                (day.close - day.open) * fraction +
                (day.high - day.low) * 0.25 * noise(spec.seed, d, 10 + k);
            const barClose = roundTo(
                Math.min(day.high, Math.max(day.low, mid)),
                spec.decimals
            );
            const barOpen = roundTo(
                Math.min(
                    day.high,
                    Math.max(
                        day.low,
                        mid -
                            (day.high - day.low) *
                                0.2 *
                                noise(spec.seed, d, 40 + k)
                    )
                ),
                spec.decimals
            );
            return {
                time:
                    zonedWallClockToUtc(date, startMinute, zone).getTime() /
                    MS_PER_SECOND,
                open: barOpen,
                high: roundTo(
                    Math.max(barOpen, barClose) +
                        (day.high - Math.max(barOpen, barClose)) * 0.5,
                    spec.decimals
                ),
                low: roundTo(
                    Math.min(barOpen, barClose) -
                        (Math.min(barOpen, barClose) - day.low) * 0.5,
                    spec.decimals
                ),
                close: barClose,
                volume: Math.round(day.volume / slots),
            };
        }).filter(bar => bar.time <= nowSeconds);
    });
}

export function barsFor(
    spec: SeriesSpec,
    session: MarketSessionSpec,
    now: Date,
    options: GetBarsOptions
): Bar[] {
    const minutes = INTRADAY_MINUTES[options.timeframe];
    const before =
        options.before === undefined
            ? Number.POSITIVE_INFINITY
            : Date.parse(options.before) / MS_PER_SECOND;
    if (minutes === undefined) {
        return dailyBars(spec, session, now, options.from).filter(
            bar => bar.time < before
        );
    }
    const from =
        options.from ?? toUtcIsoDate(new Date(now.getTime() - 60 * MS_PER_DAY));
    const bars = intradayBars(spec, session, now, minutes, from).filter(
        bar => bar.time < before
    );
    return options.limit === undefined ? bars : bars.slice(-options.limit);
}

/** 마감된 세션의 종가(오늘 정규장이 진행 중이면 오늘 봉을 뺀다). */
export function closedDailyCloses(
    spec: SeriesSpec,
    session: MarketSessionSpec,
    now: Date
): MarketDailyClose[] {
    const bars = dailyBars(spec, session, now);
    const completed = sessionOpenNow(session, now) ? bars.slice(0, -1) : bars;
    return completed.map(bar => ({
        date: toUtcIsoDate(new Date(bar.time * MS_PER_SECOND)),
        close: bar.close,
    }));
}

/** 그 거래일 정규장이 끝난 시각(24시간 시장은 그날 UTC 끝). */
function sessionCloseMs(session: MarketSessionSpec, isoDate: string): number {
    if (session.kind === 'always-open')
        return Date.parse(`${isoDate}T00:00:00Z`) + MS_PER_DAY - MS_PER_SECOND;
    return zonedWallClockToUtc(
        isoDate,
        closeMinuteOn(session, isoDate),
        session.timeZone
    ).getTime();
}

export function quoteFor(
    spec: SeriesSpec,
    session: MarketSessionSpec,
    now: Date,
    symbol: string,
    name: string
): MarketQuote | null {
    const bars = dailyBars(spec, session, now);
    const last = bars.at(-1);
    const prev = bars.at(-2);
    if (last === undefined) return null;
    const lastDate = toUtcIsoDate(new Date(last.time * MS_PER_SECOND));
    const live =
        lastDate === marketClock(session, now).today &&
        sessionOpenNow(session, now);
    const quoteMs = live
        ? now.getTime() - 30 * MS_PER_SECOND
        : sessionCloseMs(session, lastDate);
    return {
        symbol,
        name,
        price: last.close,
        changesPercentage:
            prev === undefined
                ? 0
                : Number(((last.close / prev.close - 1) * 100).toFixed(5)),
        timestamp: Math.floor(Math.min(quoteMs, now.getTime()) / MS_PER_SECOND),
    };
}

export interface SyntheticMarketWorld {
    series: Record<string, SeriesSpec>;
    names: Record<string, string>;
    /** 이 공급자 심볼은 봉·시세 조회가 던진다. */
    failing: ReadonlySet<string>;
}

/** 세션 하나에 묶인 가짜 공급자 — `getCachedMarketDataProvider(session)`이 돌려주는 것. */
export function syntheticProvider(
    world: SyntheticMarketWorld,
    session: MarketSessionSpec
): MarketDataProvider {
    const specOf = (symbol: string): SeriesSpec | undefined => {
        if (world.failing.has(symbol))
            throw new Error(`synthetic provider failure for ${symbol}`);
        return world.series[symbol];
    };
    return {
        getBars: async options => {
            const spec = specOf(options.symbol);
            return spec === undefined
                ? []
                : barsFor(spec, session, new Date(), options);
        },
        getQuote: async symbol => {
            const spec = specOf(symbol);
            return spec === undefined
                ? null
                : quoteFor(
                      spec,
                      session,
                      new Date(),
                      symbol,
                      world.names[symbol] ?? symbol
                  );
        },
    };
}
