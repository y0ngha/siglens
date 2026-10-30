import type { Bar } from '@y0ngha/siglens-core';
import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/shared/config/brand';
import { CHART_COLORS_RAW_DARK } from '@/shared/lib/chartColors';
import { OG_BG, OG_FG, OG_MUTED } from '@/shared/lib/og';
import {
    computeChartGeometry,
    isReportChartMaPeriod,
    REPORT_CHART_MA_PERIODS,
    type ReportChartMaPeriod,
} from '../lib/chartGeometry';

/** 메일 본문 폭 600px의 2배 — 레티나에서 흐리지 않게 한다. */
const REPORT_CHART_WIDTH = 1200;
const REPORT_CHART_HEIGHT = 600;
const HEADER_HEIGHT = 120;
const PLOT_HEIGHT = REPORT_CHART_HEIGHT - HEADER_HEIGHT;
const PLOT_PADDING = 24;

/** 기간별 이동평균선 색 — 사이트 차트와 같은 색을 쓴다. 키는 `REPORT_CHART_MA_PERIODS`와 같아야 한다. */
const MA_COLORS: Readonly<Record<ReportChartMaPeriod, string>> = {
    20: CHART_COLORS_RAW_DARK.period20,
    60: CHART_COLORS_RAW_DARK.period60,
};

/** `buildReportChartImage`의 입력. 호출자(라우트)가 봉·이동평균·캐시 정책을 정한다. */
export interface ReportChartImageInput {
    symbol: string;
    /** 이미지에 찍는 기준일(`YYYY-MM-DD`). */
    date: string;
    bars: readonly Bar[];
    ma: Readonly<Record<number, readonly (number | null)[]>>;
    /** 응답의 `cache-control` 헤더 값. 실제 메일은 불변 장기 캐시, 샘플은 하루. */
    cacheControl: string;
}

/** 헤더에 찍는 종가 — 1000 이상은 정수(천 단위 구분), 그 아래는 소수 둘째 자리. */
function formatPrice(value: number): string {
    return value >= 1000
        ? value.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : value.toFixed(2);
}

/**
 * 메일용 일봉 차트 PNG. 글자는 심볼·숫자·날짜뿐이라 기본(라틴) 글꼴로 충분하다 —
 * 로케일 글꼴을 내려받지 않아 첫 요청이 가볍다.
 *
 * 봉이 없으면 `null`. 호출자가 404로 답한다.
 */
export function buildReportChartImage(
    input: ReportChartImageInput
): ImageResponse | null {
    const ma = Object.fromEntries(
        REPORT_CHART_MA_PERIODS.flatMap(period => {
            const values = input.ma[period];
            return values === undefined ? [] : [[period, values]];
        })
    );
    const maPeriods = REPORT_CHART_MA_PERIODS.filter(
        period => ma[period] !== undefined
    );
    const geo = computeChartGeometry(input.bars, ma, {
        width: REPORT_CHART_WIDTH,
        height: PLOT_HEIGHT,
        padding: PLOT_PADDING,
    });
    const last = input.bars.at(-1);
    if (geo === null || last === undefined) return null;

    const prev = input.bars.at(-2);
    const changePct =
        prev !== undefined && prev.close !== 0
            ? ((last.close - prev.close) / prev.close) * 100
            : null;
    const changeColor =
        changePct === null || changePct >= 0
            ? CHART_COLORS_RAW_DARK.bullish
            : CHART_COLORS_RAW_DARK.bearish;

    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: OG_BG,
                color: OG_FG,
            }}
        >
            <div
                style={{
                    height: HEADER_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 40px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 52, fontWeight: 700 }}>
                        {input.symbol}
                    </span>
                    <span style={{ fontSize: 40, marginLeft: 24 }}>
                        {formatPrice(last.close)}
                    </span>
                    {changePct !== null ? (
                        <span
                            style={{
                                fontSize: 32,
                                marginLeft: 16,
                                color: changeColor,
                            }}
                        >
                            {`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
                        </span>
                    ) : null}
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        color: OG_MUTED,
                        fontSize: 26,
                    }}
                >
                    <span>{SITE_NAME}</span>
                    <div style={{ display: 'flex' }}>
                        <span>{input.date}</span>
                        {maPeriods.map(p => (
                            <span
                                key={p}
                                style={{ marginLeft: 20, color: MA_COLORS[p] }}
                            >
                                {`MA${p}`}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <svg
                width={REPORT_CHART_WIDTH}
                height={PLOT_HEIGHT}
                viewBox={`0 0 ${REPORT_CHART_WIDTH} ${PLOT_HEIGHT}`}
            >
                {geo.candles.map(c => {
                    const color = c.up
                        ? CHART_COLORS_RAW_DARK.bullish
                        : CHART_COLORS_RAW_DARK.bearish;
                    return (
                        <g key={c.x}>
                            <line
                                x1={c.x}
                                x2={c.x}
                                y1={c.wickTop}
                                y2={c.wickBottom}
                                stroke={color}
                                strokeWidth={2}
                            />
                            <rect
                                x={c.x - geo.bodyWidth / 2}
                                y={c.bodyTop}
                                width={geo.bodyWidth}
                                height={c.bodyHeight}
                                fill={color}
                            />
                        </g>
                    );
                })}
                {geo.maLines
                    .filter(line => line.points.length > 0)
                    .map(line => (
                        <polyline
                            key={line.period}
                            points={line.points}
                            fill="none"
                            stroke={
                                isReportChartMaPeriod(line.period)
                                    ? MA_COLORS[line.period]
                                    : undefined
                            }
                            strokeWidth={3}
                        />
                    ))}
            </svg>
        </div>,
        {
            width: REPORT_CHART_WIDTH,
            height: REPORT_CHART_HEIGHT,
            headers: { 'cache-control': input.cacheControl },
        }
    );
}
