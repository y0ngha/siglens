import { calculateMA, type Bar } from '@y0ngha/siglens-core';
import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { REPORT_CHART_MA_PERIODS } from './chartGeometry';

/** 샘플 메일의 발송일(고정). 날짜가 바뀌어도 샘플 HTML과 차트 이미지가 흔들리지 않게 한다. */
export const SAMPLE_REPORT_DATE = '2026-10-14';

/** 전체 카드로 싣는 종목. 차트 이미지도 이 종목들만 만든다. */
export const SAMPLE_CHART_SYMBOLS = ['NVDA', 'AAPL'] as const;
/** 샘플 차트를 만들 수 있는 종목 이름. */
export type SampleChartSymbol = (typeof SAMPLE_CHART_SYMBOLS)[number];

/** 샘플 차트 라우트의 경로 파라미터가 닫힌 종목 집합 안인지 좁힌다 — 밖이면 404다. */
export function isSampleChartSymbol(value: string): value is SampleChartSymbol {
    return (SAMPLE_CHART_SYMBOLS as readonly string[]).includes(value);
}

interface BarSeed {
    /** 첫 봉 시가. */
    start: number;
    /** 하루 평균 드리프트(분수). */
    drift: number;
    /** 하루 변동 폭(분수). */
    volatility: number;
    seed: number;
}

const SAMPLE_BAR_SEEDS: Record<SampleChartSymbol, BarSeed> = {
    NVDA: { start: 142, drift: 0.0034, volatility: 0.018, seed: 3 },
    AAPL: { start: 214, drift: 0.0012, volatility: 0.011, seed: 66 },
};

const SAMPLE_BAR_COUNT = 90;
const MARKET_OPEN_UTC_HOUR = 13;
const MARKET_OPEN_UTC_MINUTE = 30;
/**
 * 미국 정규장 시작(UTC 13:30)의 하루 안 초. 봉 시각이 날짜와 어긋나지 않게 한다.
 * 시간 단위 환산은 `shared/config/time`을 쓴다.
 */
const MARKET_OPEN_SECONDS =
    MARKET_OPEN_UTC_HOUR * SECONDS_PER_HOUR +
    MARKET_OPEN_UTC_MINUTE * SECONDS_PER_MINUTE;
/** 주말이 끼어도 `count`개 거래일을 채울 만큼 거꾸로 훑는 달력일 배수. */
const CALENDAR_DAYS_PER_TRADING_DAY = 2;

interface RandomDraw {
    value: number;
    state: number;
}

/**
 * 선형 합동 생성기의 한 걸음 — 상태를 받아 `[0, 1)` 값과 다음 상태를 돌려준다.
 * `Math.random`도 클로저 변수도 없이, 같은 시드에서 늘 같은 수열을 낸다.
 */
function nextRandom(state: number): RandomDraw {
    const next = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return { value: next / 0x1_0000_0000, state: next };
}

/** `Date#getUTCDay`의 주말 값. */
const SUNDAY = 0;
const SATURDAY = 6;
/** 꼬리 길이 = 하루 변동 폭 × 이 비율 × 난수. 위·아래 꼬리가 같은 비율을 쓴다. */
const WICK_VOLATILITY_RATIO = 0.6;
/** 거래량 = 기준 + 난수 × 폭(주). */
const SAMPLE_VOLUME_BASE = 1_000_000;
const SAMPLE_VOLUME_SPREAD = 4_000_000;

/** 봉 하나가 쓰는 난수 네 개. 뽑는 순서(등락 → 윗꼬리 → 아랫꼬리 → 거래량)가 곧 수열 위치다. */
interface BarDraws {
    change: number;
    upperWick: number;
    lowerWick: number;
    volume: number;
}

/** 상태를 이어 받으며 봉 하나 몫의 난수 네 개를 뽑는다. 길이가 타입으로 고정돼 단언이 필요 없다. */
function drawBarRandoms(state: number): { draws: BarDraws; state: number } {
    const change = nextRandom(state);
    const upperWick = nextRandom(change.state);
    const lowerWick = nextRandom(upperWick.state);
    const volume = nextRandom(lowerWick.state);
    return {
        draws: {
            change: change.value,
            upperWick: upperWick.value,
            lowerWick: lowerWick.value,
            volume: volume.value,
        },
        state: volume.state,
    };
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/** `SAMPLE_REPORT_DATE`에서 거꾸로 세어 주말을 건너뛴 거래일(초 단위 epoch) 목록, 오래된 순. */
function sampleTradingTimes(count: number): number[] {
    const end = Date.parse(`${SAMPLE_REPORT_DATE}T00:00:00Z`) / 1_000;
    return Array.from(
        { length: count * CALENDAR_DAYS_PER_TRADING_DAY },
        (_, back) => end - back * SECONDS_PER_DAY
    )
        .filter(day => {
            const weekday = new Date(day * 1_000).getUTCDay();
            return weekday !== SUNDAY && weekday !== SATURDAY;
        })
        .slice(0, count)
        .map(day => day + MARKET_OPEN_SECONDS)
        .reverse();
}

interface BarWalk {
    bars: Bar[];
    previousClose: number;
    rngState: number;
}

/**
 * 샘플 일봉. 모양은 실제 `Bar` 그대로이고, 값은 시드 고정 난수 보행이라 빌드마다 같다.
 * 가격은 센트까지 반올림한다 — 차트 헤더의 종가·등락률이 메일 본문과 같은 값에서 나온다.
 * 직전 종가와 난수 상태를 `reduce`로 이어 받는다(봉마다 난수 4개 — {@link drawBarRandoms}).
 */
export function buildSampleBars(symbol: SampleChartSymbol): Bar[] {
    const { start, drift, volatility, seed } = SAMPLE_BAR_SEEDS[symbol];
    return sampleTradingTimes(SAMPLE_BAR_COUNT).reduce<BarWalk>(
        (walk, time) => {
            const open = walk.previousClose;
            const { draws, state } = drawBarRandoms(walk.rngState);
            const change = drift + (draws.change - 0.5) * 2 * volatility;
            const close = round2(open * (1 + change));
            const wickScale = volatility * WICK_VOLATILITY_RATIO;
            const high = round2(
                Math.max(open, close) * (1 + draws.upperWick * wickScale)
            );
            const low = round2(
                Math.min(open, close) / (1 + draws.lowerWick * wickScale)
            );
            return {
                bars: [
                    ...walk.bars,
                    {
                        time,
                        open: round2(open),
                        high,
                        low,
                        close,
                        volume: Math.round(
                            SAMPLE_VOLUME_BASE +
                                draws.volume * SAMPLE_VOLUME_SPREAD
                        ),
                    },
                ],
                previousClose: close,
                rngState: state,
            };
        },
        { bars: [], previousClose: start, rngState: seed >>> 0 }
    ).bars;
}

/** 차트 이미지에 겹치는 이동평균 — 라우트가 쓰는 기간과 같고, core 계산기를 그대로 쓴다. */
export function buildSampleChartMa(
    bars: Bar[]
): Record<number, (number | null)[]> {
    return Object.fromEntries(
        REPORT_CHART_MA_PERIODS.map(period => [
            period,
            calculateMA(bars, period),
        ])
    );
}
