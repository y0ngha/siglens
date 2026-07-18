import { dynamicDecimals, formatUsdPrice } from '@/shared/lib/priceFormat';
import type { PositionModel, RangeClamp } from './positionGeometry';

/**
 * "$300" 형태 — sub-$1 정밀도 자산군(암호화폐 등)은 고정 2자리 포맷이 "$0"으로
 * 뭉개지므로(예: $0.0006 → "$0") shared/lib/priceFormat의 dynamicDecimals(이미
 * crypto 지표 포맷에 쓰이는 유틸)로 유효자리를 보존한다. PositionGauge는 이 케이스를
 * §6에서 스코프 밖으로 punt했지만, 이 컴포넌트는 misleading "$0"을 최소 방어선으로 삼는다.
 */
export function formatUsd(value: number): string {
    if (value !== 0 && Math.abs(value) < 1) {
        return `$${value.toFixed(dynamicDecimals(value))}`;
    }
    return `$${formatUsdPrice(value)}`;
}

/** in-SVG 라벨 폭이 고정 viewBox라 고가 종목(예: BRK.A $600,000+)에서 잘릴 수 있어
 * 이 라벨에서만 축약한다. aria-label은 정밀도를 위해 항상 전체 값을 쓴다. */
const IN_SVG_COMPACT_THRESHOLD = 100_000;

/** Exported so the clipping-regression test can build the exact string the
 * component renders (avoids a second, potentially-drifting copy in the test). */
export function formatUsdCompactForSvgLabel(value: number): string {
    if (Math.abs(value) >= IN_SVG_COMPACT_THRESHOLD) {
        return `$${Math.round(value / 1000)}K`;
    }
    return formatUsd(value);
}

export function buildAriaLabel(
    symbol: string,
    model: PositionModel,
    avgDisplay: string,
    currentDisplay: string,
    avgFloorNote: string
): string {
    const returnSign = model.returnPct >= 0 ? '+' : '';
    return (
        `${symbol} 내 위치: 평단 ${avgDisplay}, 현재가 ${currentDisplay}, ` +
        `수익률 ${returnSign}${model.returnPct.toFixed(1)}%, ` +
        `최근 범위의 ${model.rangePositionPct.toFixed(0)}% 지점, ${avgFloorNote}`
    );
}

export function outOfRangeNote(clamped: RangeClamp): string | null {
    if (clamped === 'above') return '최근 고점보다 높은 곳';
    if (clamped === 'below') return '최근 저점보다 낮은 곳';
    return null;
}

/**
 * floorIndex(0=최저가 인접 층)를 저층/중층/고층/펜트하우스 중 하나로 서술한다.
 * 최하층은 항상 저층, 최상층(bandCount-1)은 항상 펜트하우스 — 그 사이는 3등분해
 * 저층 쪽 절반은 중층, 그 위는 고층으로 갈린다(BAND_COUNT=5 기준: 0→저층,
 * 1~2→중층, 3→고층, 4→펜트하우스). bandCount가 바뀌어도(테스트 등) 안전하게
 * 동작하도록 리터럴 인덱스가 아니라 bandCount 비율로 경계를 계산한다.
 */
function describeFloorTier(floorIndex: number, bandCount: number): string {
    if (bandCount <= 1 || floorIndex === bandCount - 1) return '펜트하우스';
    if (floorIndex === 0) return '저층';
    const midBoundary = Math.floor((bandCount * 2) / 3);
    return floorIndex < midBoundary ? '중층' : '고층';
}

/**
 * ★평단이 건물의 몇 층에 해당하는지 위트 있게 서술한다 — 아파트 메타포의 연장.
 * 순수 포지셔닝 서술만 담당한다(scope fence): 매수/매도 판단이나 진입
 * 퀄리티 평가("잘 사셨어요", "좋은 진입" 등) 언어는 절대 포함하지 않는다 — 그
 * 의미는 siglens-core 분석 도메인의 몫이지 이 프레젠테이션 컴포넌트의 몫이
 * 아니다. avgClamped가 'above'/'below'면 범위 밖(옥상 위/지하) 문구를, null이면
 * avgPos·bandCount로 실제 층수를 계산해 저층/중층/고층/펜트하우스 중 하나를
 * 고른다. avgClamped==='above'|'below' 케이스는 기존 outOfRangeNote와 동일한
 * 부분 문자열("최근 고점보다 높은"/"최근 저점보다 낮은")을 포함해 기존 소비처와
 * 문구 결이 어긋나지 않게 한다. aria-label·마커 아래 노트 등 ★평단을 서술하는
 * 모든 소비처가 이 하나의 빌더를 거쳐 파생해 문구 드리프트를 막는다
 * (buildFloorTooltipContent와 동일 원칙).
 */
/** 범위 밖 ★평단의 아파트 메타포 phrase(방향만) — describeAvgFloor(전체 문구)와
 * avgFloorVisualNote(시각 노트, 폭 제약)가 함께 파생하는 단일 소스라 리터럴을
 * 양쪽에 중복 선언하지 않는다. */
const ROOFTOP_METAPHOR = '옥상 위';
const BASEMENT_METAPHOR = '지하 세대';

export function describeAvgFloor(
    avgPos: number,
    avgClamped: RangeClamp,
    bandCount: number
): string {
    if (avgClamped === 'above')
        return `${ROOFTOP_METAPHOR} · 최근 고점보다 높은 곳`;
    if (avgClamped === 'below')
        return `${BASEMENT_METAPHOR} · 최근 저점보다 낮은 곳`;

    const floorIndex = Math.min(
        bandCount - 1,
        Math.max(0, Math.floor(avgPos * bandCount))
    );
    const floorNumber = floorIndex + 1;
    return `${floorNumber}층 · ${describeFloorTier(floorIndex, bandCount)}`;
}

/**
 * SVG 시각 노트(<text data-testid="avg-floor-note">) 전용 문구 — 범위 밖
 * (above/below)이면 메타포 phrase("옥상 위"/"지하 세대")만 반환한다. 뒤 설명
 * 절("· 최근 고점보다 높은 곳" 등)까지 붙이면 end-anchored 노트 폭이
 * SVG_LABEL_AVAILABLE_WIDTH(118px)를 넘겨 좌측(메타포 phrase)이 잘린다(design
 * audit). 마커가 지붕 위/바닥 아래 중앙에 떠 방향은 위치가 이미 말해주고,
 * return-readout의 "최근 범위의 N% 지점"도 함께 보여 시각 정보 손실은 없다.
 * 범위 안이면 "N층 · tier"(78px, 폭 안전)를 그대로 보여준다. 설명 절을 포함한
 * 전체 문구는 aria-label(describeAvgFloor)이 계속 담아 AT 정보량은 유지한다.
 */
export function avgFloorVisualNote(
    avgClamped: RangeClamp,
    fullNote: string
): string {
    if (avgClamped === 'above') return ROOFTOP_METAPHOR;
    if (avgClamped === 'below') return BASEMENT_METAPHOR;
    return fullNote;
}

/**
 * ★평단 층 안내 앞에 붙는 방향 glyph — 범위 밖(above/below)이면 옥상/지하
 * 메타포에 대응하는 glyph를, 범위 안이면 빈 문자열을 반환한다(FF.md §1-E:
 * nested ternary 대신 early-return 헬퍼로 분기). currentClamped용 glyph(●
 * out-of-range note)는 이 함수와 별개로 렌더 지점에서 계산한다 — currentNote는
 * out-of-range일 때만 렌더되므로(above/below 둘 중 하나) null 분기가 필요 없다.
 */
export function avgFloorPrefixGlyph(clamped: RangeClamp): string {
    if (clamped === 'above') return '☁ ';
    if (clamped === 'below') return '▽B1 ';
    return '';
}

export interface BandPriceRange {
    bandLow: number;
    bandHigh: number;
}

/** band index(0=최저가)의 가격 구간 — low/high를 bandCount개 동일 폭으로 나눈다.
 * volumeByBand.ts의 밴드 경계 컨벤션(inclusive-low/exclusive-high, 마지막
 * 밴드만 상한 포함)과 동일 산식이라 두 값이 항상 같은 구간을 가리킨다. */
function bandPriceRange(
    low: number,
    high: number,
    index: number,
    bandCount: number
): BandPriceRange {
    const width = (high - low) / bandCount;
    return {
        bandLow: low + index * width,
        bandHigh: low + (index + 1) * width,
    };
}

export interface FloorTooltipContent {
    readonly main: string;
    readonly qualifier: string;
}

/**
 * 층 hover/tap 시 노출하는 문구 — "거주율"(아파트 메타포)로 그 가격대에 몰린
 * 거래량 비중을 서술한다. 실제 주주 명부가 아니라 "이 가격대에서 거래가 얼마나
 * 몰렸는가"의 친근한 은유일 뿐이라, qualifier로 52주 거래량 기준 raw 지표라는 걸
 * 항상 함께 밝힌다(scope fence — 지지/저항 같은 매수·매도 해석으로 오독되지
 * 않게). below-building 리드아웃·floating 툴팁 2곳(둘 다 포인터 전용 시각
 * 보강, role="img" 자손이라 접근성 트리엔 노출되지 않는다) 모두
 * formatFloorTooltipText를 거쳐 이 하나의 빌더에서 파생해 문구 드리프트를 막는다.
 */
function buildFloorTooltipContent(
    bandLow: number,
    bandHigh: number,
    volumePct: number
): FloorTooltipContent {
    return {
        main: `${formatUsd(bandLow)}–${formatUsd(bandHigh)} · 거주율 ${Math.round(volumePct)}%`,
        qualifier: '최근 52주 거래량 기준',
    };
}

/** below-building 리드아웃처럼 단일 plain-text가 필요한 소비처용 — floating 툴팁은
 * main/qualifier를 두 줄로 나눠 렌더하지만(qualifier를 시각적으로 muted 처리), 여기선
 * 괄호로 이어붙여 하나의 문자열로 합친다. */
export function formatFloorTooltipText(content: FloorTooltipContent): string {
    return `${content.main} (${content.qualifier})`;
}

/** hover(마우스)·pinned(클릭/탭) 중 활성 상태인 층 하나를 가리킨다 — index는
 * model.bands의 band index, rect는 activate/toggleClick 시점에 캡처한 floating
 * 툴팁 anchor 좌표(getBoundingClientRect). */
export interface FloorPointer {
    index: number;
    rect: DOMRect;
}

/**
 * 층(band) 전체(0..bandCount-1)의 툴팁 콘텐츠를 한 번에 계산한다 — 활성 층
 * 파생(컴포넌트 상단, floating 툴팁/below-building 리드아웃용)과 렌더 루프
 * (층별 isInteractive/isActive 판정용) 둘 다 이 하나의 배열에서 파생해 같은
 * band index가 두 곳에서 따로 계산되지 않게 한다(단일 source, MISTAKES #2).
 * volumePct가 없거나 유한하지 않은 밴드(비인터랙티브)는 null.
 */
export function buildFloorTooltips(
    model: PositionModel,
    volumeByBand: readonly number[] | null | undefined,
    low52w: number,
    high52w: number,
    bandCount: number
): readonly (FloorTooltipContent | null)[] {
    return model.bands.map((_, i) => {
        const volumePct = volumeByBand?.[i];
        if (typeof volumePct !== 'number' || !Number.isFinite(volumePct)) {
            return null;
        }
        const { bandLow, bandHigh } = bandPriceRange(
            low52w,
            high52w,
            i,
            bandCount
        );
        return buildFloorTooltipContent(bandLow, bandHigh, volumePct);
    });
}

/**
 * 활성 층(activeFloor)의 툴팁 콘텐츠 — floorTooltips(전체 밴드 배열)에서
 * activeFloor.index로 조회한다. activeFloor가 없으면 null(guard clause).
 */
export function computeActiveFloorTooltipContent(
    activeFloor: FloorPointer | null,
    floorTooltips: readonly (FloorTooltipContent | null)[]
): FloorTooltipContent | null {
    if (activeFloor === null) return null;
    return floorTooltips[activeFloor.index] ?? null;
}

/**
 * SVG viewBox 가로폭 및 파생 상수 — label-width budget(SVG_LABEL_AVAILABLE_WIDTH)과
 * 컴포넌트의 아이소메트릭 드로잉(PositionBuilding.tsx의 ROOF_POLYGON,
 * computeFloorFaces, 마커/라벨 좌표 등)이 공유하는 값이라 여기 lib에 단일
 * source로 둔다(두 파일에 흩어지면 드리프트 위험, MISTAKES #2). 280 → 360:
 * widened horizontally(audit finding #1) so the avg/current marker labels
 * never clip for realistic per-share prices (up to ~$99,999 before
 * IN_SVG_COMPACT_THRESHOLD kicks in). Building geometry in the component
 * (ISO_DY, FLOOR_H, ...) is unchanged — the extra width is pure side padding
 * for labels, which already lived in the margins by design.
 */
export const VIEWBOX_W = 360;
export const CENTER_X = VIEWBOX_W / 2;

/** 지붕 마름모 반폭(가로) — SVG_LABEL_AVAILABLE_WIDTH와 컴포넌트의 아이소메트릭
 * 드로잉(ROOF_POLYGON, computeFloorFaces 등)이 공유하는 단일 소스. */
export const ISO_DX = 50;

/** 마커 라벨을 viewBox 정면 모서리에서 띄우는 가로 간격 — SVG_LABEL_AVAILABLE_WIDTH와
 * 컴포넌트의 라벨 x좌표(avg/current text) 계산이 공유하는 단일 소스. */
export const LABEL_GAP = 12;

/**
 * 마커 라벨의 텍스트 anchor(text-anchor="end"/"start")에서 viewBox 가장자리까지
 * 남은 여유 폭 — avg 라벨은 왼쪽(CENTER_X - ISO_DX - LABEL_GAP만큼 안쪽에서 anchor,
 * 거기서 왼쪽으로 텍스트가 자란다), current 라벨은 대칭으로 오른쪽. CENTER_X가
 * viewBox 중앙이므로 두 방향의 여유 폭은 같다.
 */
export const SVG_LABEL_AVAILABLE_WIDTH = CENTER_X - ISO_DX - LABEL_GAP;

/**
 * in-SVG 마커 라벨 prefix — aria-label(buildAriaLabel, "평단"/"현재가" 전체 표기,
 * 폭 제약 없음)과 별개로 고정 viewBox 폭 제약을 받는 시각 라벨 전용이다. "내
 * 평단"/"현재가"보다 짧게 둬(audit finding #1) 4자리 이상 가격에서도 라벨이
 * viewBox를 벗어나지 않게 한다.
 */
export const AVG_LABEL_PREFIX = '★ 평단 ';
export const CURRENT_LABEL_PREFIX = '● 현재 ';

/**
 * 글자 하나당 대략적인 렌더 폭(px) 추정 — text-[10px] font-medium tabular-nums
 * 라벨 전용. jsdom에는 실제 텍스트 레이아웃 엔진이 없어(getBBox/
 * getComputedTextLength 모두 throw) 클리핑 회귀 테스트가 이 추정치로 "라벨이
 * viewBox 안에 들어가는가"를 검증한다. 한글/심볼(★●)은 정사각형에 가깝게
 * (~1em) 넓고, 숫자·구두점은 더 좁게(~0.6em) — 실제보다 과소평가하지 않도록
 * 보수적으로(넉넉하게) 잡는다.
 */
function estimateGlyphWidthPx(ch: string): number {
    if (ch === ' ') return 3;
    if (/[ㄱ-힣★●]/.test(ch)) return 10; // 한글 + 마커 심볼(★●)
    return 6; // 숫자, $, 쉼표, 마침표
}

export function estimateSvgLabelWidth(text: string): number {
    return Array.from(text).reduce(
        (sum, ch) => sum + estimateGlyphWidthPx(ch),
        0
    );
}
