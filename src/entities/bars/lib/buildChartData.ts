import type { Bar, IndicatorResult, Timeframe } from '@y0ngha/siglens-core';
import {
    CHART_DATA_PERIOD_KEYED_INDICATORS,
    CHART_DATA_SNAPSHOT_INDICATORS,
    type ChartDataIndicatorName,
} from './chartDataIndicators';

/** 봉마다 하나씩 정렬된 시리즈 — 워밍업 구간은 `null`. */
type Series = readonly unknown[];

export interface ChartDataOhlcv {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
}

export interface ChartData {
    symbol: string;
    timeframe: Timeframe;
    /** 돌려준 봉 수(= `time.length`). */
    bars: number;
    /** 유닉스 초, 오름차순. 모든 시리즈가 이 배열과 같은 길이·같은 순서다. */
    time: number[];
    ohlcv: ChartDataOhlcv;
    indicators: Record<string, unknown>;
}

export interface BuildChartDataInput {
    symbol: string;
    timeframe: Timeframe;
    /** 전체 룩백 봉(지표를 계산한 그대로). 마지막 `count`개만 내보낸다. */
    bars: readonly Bar[];
    /** `bars`와 같은 길이로 계산된, 이미 반올림된 지표(웹이 쓰는 `roundIndicators` 결과). */
    indicators: IndicatorResult;
    count: number;
    selected: readonly ChartDataIndicatorName[];
}

/**
 * 시리즈의 마지막 `size`개. 시리즈가 봉보다 짧으면 왼쪽을 `null`로 채워 꼬리를 맞춘다 — 차트 시리즈는
 * 꼬리 정렬이 규칙이라(가장 최근 봉에 값이 맞아야 한다) 앞에서부터 자르면 어긋난다.
 */
function tail(series: Series, size: number): unknown[] {
    if (series.length >= size) return series.slice(series.length - size);
    return [...Array<null>(size - series.length).fill(null), ...series];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 객체 배열(`macd[]` = `{macd, signal, histogram}[]`)을 배열의 객체(`{macd: [], signal: [], histogram: []}`)로
 * 뒤집는다. 필드 이름은 core의 것을 그대로 쓴다. 필드 목록은 첫 원소에서 읽지 않고 모든 원소의 합집합이라,
 * 앞쪽 워밍업 원소가 일부 필드를 생략하는 지표가 생겨도 필드가 빠지지 않는다.
 */
function transpose(rows: readonly Record<string, unknown>[]): {
    [field: string]: unknown[];
} {
    const fields = new Set<string>();
    for (const row of rows) for (const key of Object.keys(row)) fields.add(key);
    return Object.fromEntries(
        [...fields].map(field => [
            field,
            rows.map(row => (row[field] === undefined ? null : row[field])),
        ])
    );
}

function sliceSeries(series: Series, size: number): unknown {
    const window = tail(series, size);
    const sample = window.find(item => item !== null && item !== undefined);
    // 값이 모두 null이면 모양을 알 수 없다 — 평면 시리즈로 둔다(객체 시리즈는 워밍업이 창 전체를 덮지 않는다).
    return isRecord(sample)
        ? transpose(window.map(item => (isRecord(item) ? item : {})))
        : window;
}

/**
 * smc 스냅샷의 봉 인덱스를 반환 구간 기준으로 다시 맞춘다. core는 전체 룩백 봉 기준 인덱스를 돌려주는데,
 * 응답은 마지막 `count`개만 담아서 그대로 두면 `time[index]`가 엉뚱한 봉을 가리킨다.
 *
 * 구간 앞으로 밀린 항목의 규칙:
 * - 항목의 인덱스 필드가 **전부** 구간 앞이면 이 응답으로 가리킬 봉이 없어 뺀다. 단 `isMitigated === false`인
 *   항목(아직 유효한 가격대인 미완화 오더블록·FVG)은 살려서 아래처럼 표시한다.
 * - 일부만 구간 앞이면(예: 같은 가격대의 첫 번째 터치는 구간 앞, 두 번째는 구간 안) 구간 앞 인덱스를 `null`로 두고
 *   `startsBeforeWindow: true`를 붙여 유지한다.
 */
const DROPPED = Symbol('dropped');
const INDEX_FIELDS = ['index', 'startIndex', 'firstIndex', 'secondIndex'];

function rebaseIndices(value: unknown, offset: number): unknown {
    if (Array.isArray(value)) {
        return value
            .map(item => rebaseIndices(item, offset))
            .filter(item => item !== DROPPED);
    }
    if (!isRecord(value)) return value;
    const indexKeys = Object.keys(value).filter(
        key => INDEX_FIELDS.includes(key) && typeof value[key] === 'number'
    );
    const before = indexKeys.filter(key => (value[key] as number) < offset);
    const live = value.isMitigated === false;
    if (indexKeys.length > 0 && before.length === indexKeys.length && !live)
        return DROPPED;
    const rebased = Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (!indexKeys.includes(key))
                return [key, rebaseIndices(item, offset)];
            return [
                key,
                before.includes(key) ? null : (item as number) - offset,
            ];
        })
    );
    return before.length > 0
        ? { ...rebased, startsBeforeWindow: true }
        : rebased;
}

function snapshotFor(
    name: ChartDataIndicatorName,
    value: unknown,
    offset: number
): unknown {
    // 인덱스를 가진 스냅샷은 smc뿐이다(volumeProfile은 가격 구간별 거래량).
    return name === 'smc' ? rebaseIndices(value, offset) : value;
}

/**
 * 봉 + 지표를 한 번에 돌려주는 `get_chart_data`의 응답 본문을 만든다. 순수 함수 — 입력은 이미 전체 룩백으로
 * 계산·반올림된 값이고, 여기서는 **자르고 모양만 바꾼다**(새 계산 없음). 마지막 `count`개를 자르므로
 * 각 값은 웹 차트가 같은 봉에 보여 주는 값과 같다.
 */
export function buildChartData({
    symbol,
    timeframe,
    bars,
    indicators,
    count,
    selected,
}: BuildChartDataInput): ChartData {
    const size = Math.min(Math.max(count, 0), bars.length);
    const offset = bars.length - size;
    const window = bars.slice(offset);
    const snapshots: readonly string[] = CHART_DATA_SNAPSHOT_INDICATORS;
    const periodKeyed: readonly string[] = CHART_DATA_PERIOD_KEYED_INDICATORS;

    const picked = selected.map((name): [string, unknown] => {
        const value: unknown = indicators[name];
        if (snapshots.includes(name))
            return [name, snapshotFor(name, value, offset)];
        if (periodKeyed.includes(name) && isRecord(value))
            return [
                name,
                Object.fromEntries(
                    Object.entries(value).map(([period, series]) => [
                        period,
                        Array.isArray(series) ? tail(series, size) : series,
                    ])
                ),
            ];
        return [
            name,
            Array.isArray(value) ? sliceSeries(value, size) : (value ?? null),
        ];
    });

    return {
        symbol,
        timeframe,
        bars: size,
        time: window.map(bar => bar.time),
        ohlcv: {
            open: window.map(bar => bar.open),
            high: window.map(bar => bar.high),
            low: window.map(bar => bar.low),
            close: window.map(bar => bar.close),
            volume: window.map(bar => bar.volume),
        },
        indicators: Object.fromEntries(picked),
    };
}
