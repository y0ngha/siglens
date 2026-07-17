import { formatUsdPrice } from '@/shared/lib/priceFormat';
import type { PositionModel } from '../lib/positionGeometry';

interface PositionGaugeProps {
    symbol: string;
    model: PositionModel;
    low52w: number;
    high52w: number;
    current: number;
    avg: number;
}

/** "$300" 형태 — 정밀도 특화 자산군(암호화폐 등) 포맷은 이 위젯 스코프 밖이다(§6). */
function formatUsd(value: number): string {
    return `$${formatUsdPrice(value)}`;
}

/** in-SVG 마커 라벨 폭이 고정 viewBox라 고가 종목(예: BRK.A $600,000+)에서
 * 잘릴 수 있어 이 마커 텍스트에서만 축약한다. dl 리드아웃(PositionCard)과
 * aria-label은 정밀도를 위해 항상 전체 값을 쓴다. */
const IN_SVG_COMPACT_THRESHOLD = 100_000;

function formatUsdCompactForSvgLabel(value: number): string {
    if (Math.abs(value) >= IN_SVG_COMPACT_THRESHOLD) {
        return `$${Math.round(value / 1000)}K`;
    }
    return formatUsd(value);
}

const GAUGE_VIEWBOX_W = 260;
const GAUGE_VIEWBOX_H = 260;

const BAR_WIDTH = 24;
const BAR_TOP = 30;
const BAR_HEIGHT = 200;
const BAR_X = (GAUGE_VIEWBOX_W - BAR_WIDTH) / 2;
const BAR_CENTER_X = BAR_X + BAR_WIDTH / 2;

/**
 * 5×20% 구간 팔레트 — NEUTRAL 그라디언트, high=위험 의미 부여 금지(design §5).
 * 상단(최근 고점 인접)일수록 밝고 하단(저점 인접)일수록 어둡다. 의미는 마커 +
 * 색상 리드아웃이 담당하고 밴드 색은 순수 시각 리듬만 준다.
 * top→bottom 순서로 정의 — BANDS[i]는 low52w에서 i번째 구간(0=최저)이므로
 * 렌더 시 역순 인덱싱(BAND_COUNT - 1 - i)으로 매핑한다.
 */
const BAND_TOKENS: readonly string[] = [
    'text-secondary-600/40',
    'text-secondary-600/30',
    'text-secondary-700/30',
    'text-secondary-700/40',
    'text-secondary-800/40',
];

/** avg/current가 이 값 미만 차이일 때 겹침을 막기 위해 마커를 좌우로 dodge한다. */
const DODGE_EPSILON = 0.04;
const DODGE_X_OFFSET = 11;
const MARKER_HALF = 6;
const LABEL_GAP = 10;

function yFromPos(pos: number): number {
    return BAR_TOP + (1 - pos) * BAR_HEIGHT;
}

function buildAriaLabel(
    symbol: string,
    model: PositionModel,
    avgDisplay: string,
    currentDisplay: string
): string {
    const returnSign = model.returnPct >= 0 ? '+' : '';
    return (
        `${symbol} 내 위치: 평단 ${avgDisplay}, 현재가 ${currentDisplay}, ` +
        `수익률 ${returnSign}${model.returnPct.toFixed(1)}%, ` +
        `최근 범위의 ${model.rangePositionPct.toFixed(0)}% 지점`
    );
}

function outOfRangeNote(clamped: 'above' | 'below' | null): string | null {
    if (clamped === 'above') return '최근 고점보다 높은 곳에서 매수';
    if (clamped === 'below') return '최근 저점보다 낮은 곳에서 매수';
    return null;
}

/**
 * 회원 평단·현재가를 최근 고/저 범위 안에서 시각화하는 세로 밴드 게이지.
 * FearGreedGauge와 동일 idiom(viewBox + currentColor 세그먼트 + role="img")을 따른다.
 * 순수 프레젠테이션 — bands/positions는 전달받은 PositionModel에서만 파생한다.
 */
export function PositionGauge({
    symbol,
    model,
    low52w,
    high52w,
    current,
    avg,
}: PositionGaugeProps) {
    const avgDisplay = formatUsd(avg);
    const currentDisplay = formatUsd(current);
    const ariaLabel = buildAriaLabel(symbol, model, avgDisplay, currentDisplay);
    const note = outOfRangeNote(model.avgClamped);

    // avg≈current면 두 마커(◆/▶)가 같은 y에서 겹쳐 하나로 보인다 — 좌우로 벌려
    // break-even(가장 흔한 상태)에서도 두 마커가 구분되게 한다.
    const isDodged = Math.abs(model.avgPos - model.currentPos) < DODGE_EPSILON;
    const avgX = BAR_CENTER_X - (isDodged ? DODGE_X_OFFSET : 0);
    const currentX = BAR_CENTER_X + (isDodged ? DODGE_X_OFFSET : 0);
    const avgY = yFromPos(model.avgPos);
    const currentY = yFromPos(model.currentPos);

    const avgDisplaySvg = formatUsdCompactForSvgLabel(avg);
    const currentDisplaySvg = formatUsdCompactForSvgLabel(current);

    return (
        <div
            className="flex min-h-[220px] flex-col items-center gap-2"
            data-testid="position-gauge"
        >
            <svg
                viewBox={`0 0 ${GAUGE_VIEWBOX_W} ${GAUGE_VIEWBOX_H}`}
                className="h-full w-full max-w-[260px]"
                role="img"
                aria-label={ariaLabel}
            >
                {/* 최근 고점/저점 눈금 라벨 */}
                <text
                    x={BAR_CENTER_X}
                    y={BAR_TOP - 12}
                    textAnchor="middle"
                    className="text-secondary-400 fill-current text-[10px] font-medium tabular-nums"
                >
                    {formatUsdCompactForSvgLabel(high52w)}
                </text>
                <text
                    x={BAR_CENTER_X}
                    y={BAR_TOP + BAR_HEIGHT + 18}
                    textAnchor="middle"
                    className="text-secondary-400 fill-current text-[10px] font-medium tabular-nums"
                >
                    {formatUsdCompactForSvgLabel(low52w)}
                </text>

                {model.bands.map((band, i) => {
                    const tokenIndex = model.bands.length - 1 - i;
                    const yTop =
                        BAR_TOP + ((100 - band.toPct) / 100) * BAR_HEIGHT;
                    const yBottom =
                        BAR_TOP + ((100 - band.fromPct) / 100) * BAR_HEIGHT;
                    return (
                        <rect
                            key={`${band.fromPct}-${band.toPct}`}
                            data-testid="position-band"
                            x={BAR_X}
                            y={yTop}
                            width={BAR_WIDTH}
                            height={yBottom - yTop}
                            fill="currentColor"
                            className={BAND_TOKENS[tokenIndex]}
                        />
                    );
                })}

                {/* 20% 경계 그리드라인 (양 끝 제외 — bar 테두리가 이미 경계를 표현) */}
                {[20, 40, 60, 80].map(pct => {
                    const y = BAR_TOP + ((100 - pct) / 100) * BAR_HEIGHT;
                    return (
                        <line
                            key={pct}
                            x1={BAR_X}
                            x2={BAR_X + BAR_WIDTH}
                            y1={y}
                            y2={y}
                            stroke="currentColor"
                            strokeWidth={0.75}
                            className="text-secondary-700"
                        />
                    );
                })}

                <rect
                    x={BAR_X}
                    y={BAR_TOP}
                    width={BAR_WIDTH}
                    height={BAR_HEIGHT}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-secondary-700"
                />

                {/* 내 평단 (◆) */}
                <g
                    data-testid="avg-marker"
                    transform={`translate(${avgX} ${avgY})`}
                >
                    <polygon
                        points={`0,${-MARKER_HALF} ${MARKER_HALF},0 0,${MARKER_HALF} ${-MARKER_HALF},0`}
                        className="fill-secondary-100"
                    />
                </g>
                <text
                    x={BAR_X - LABEL_GAP}
                    y={avgY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-current text-[10px] font-medium tabular-nums"
                >
                    <tspan className="fill-secondary-400">내 평단 </tspan>
                    <tspan className="fill-secondary-100">
                        {avgDisplaySvg}
                    </tspan>
                </text>

                {/* 현재가 (▶) */}
                <g
                    data-testid="current-marker"
                    transform={`translate(${currentX} ${currentY})`}
                >
                    <polygon
                        points={`${-MARKER_HALF},${-MARKER_HALF} ${MARKER_HALF},0 ${-MARKER_HALF},${MARKER_HALF}`}
                        className="fill-secondary-100"
                    />
                </g>
                <text
                    x={BAR_X + BAR_WIDTH + LABEL_GAP}
                    y={currentY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    className="fill-current text-[10px] font-medium tabular-nums"
                >
                    <tspan className="fill-secondary-400">현재가 </tspan>
                    <tspan className="fill-secondary-100">
                        {currentDisplaySvg}
                    </tspan>
                </text>
            </svg>
            {note && (
                <p className="text-secondary-400 text-center text-xs">{note}</p>
            )}
        </div>
    );
}
