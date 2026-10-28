/**
 * 포지션 빌딩의 문구 — aria 요약, 층 안내(N층·옥상 위/지하 메타포), 범위 밖 안내, 층 툴팁 콘텐츠.
 * 위치 서술만 한다 — 매수/매도 판단 언어는 쓰지 않는다(scope fence).
 */
import type { PositionModel, RangeClamp } from './positionGeometry';
import { formatAmount } from './buildingPriceFormat';

/**
 * `widgets.portfolio-position.positionNote` 번역자.
 *
 * 이 모듈은 순수 함수 모음이라 훅을 부를 수 없다 — 호출부(컴포넌트)가 받아 넘긴다.
 * 예전에는 층 비유 문구가 한국어 리터럴이라 네 로케일 전부 한국어로 나갔다.
 */
export type PositionTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

/** svg aria-label 요약 — 평단·현재가·수익률·범위 내 위치·층 안내를 전부 담는다(전체 값, 축약 없음). */
export function buildAriaLabel(
    symbol: string,
    model: PositionModel,
    avgDisplay: string,
    currentDisplay: string,
    avgFloorNote: string,
    t: PositionTranslator
): string {
    const returnSign = model.returnPct >= 0 ? '+' : '';
    return t('ariaSummary', {
        v0: symbol,
        v1: avgDisplay,
        v2: currentDisplay,
        v3: returnSign,
        v4: model.returnPct.toFixed(1),
        v5: model.rangePositionPct.toFixed(0),
        v6: avgFloorNote,
    });
}

/**
 * 평단 없이 현재가만 그리는 건물(`PositionBuilding`의 `avg={null}`)의 aria 요약.
 * 평단·수익률은 정의되지 않으므로 문구에 넣지 않는다 — `rangePositionPct`는 평단
 * 위치라서 쓰지 않고 `currentPos`를 직접 퍼센트로 바꾼다. `currentFloorNote`는
 * 현재가의 층 안내(`describeFloor(model.currentPos, ...)`).
 */
export function buildAriaLabelCurrentOnly(
    symbol: string,
    model: PositionModel,
    currentDisplay: string,
    currentFloorNote: string,
    t: PositionTranslator
): string {
    return t('ariaSummaryCurrentOnly', {
        v0: symbol,
        v1: currentDisplay,
        v2: (model.currentPos * 100).toFixed(0),
        v3: currentFloorNote,
    });
}

/** 범위 밖 마커 안내 — 최근 고점 위/저점 아래면 그 문구, 범위 안이면 null. */
export function outOfRangeNote(
    clamped: RangeClamp,
    t: PositionTranslator
): string | null {
    if (clamped === 'above') return t('aboveHigh');
    if (clamped === 'below') return t('belowLow');
    return null;
}

/**
 * floorIndex(0=최저가 인접 층)를 저층/중층/고층/펜트하우스 중 하나로 서술한다.
 * 최하층은 항상 저층, 최상층(bandCount-1)은 항상 펜트하우스 — 그 사이는 3등분해
 * 저층 쪽 절반은 중층, 그 위는 고층으로 갈린다(BAND_COUNT=5 기준: 0→저층,
 * 1~2→중층, 3→고층, 4→펜트하우스). bandCount가 바뀌어도(테스트 등) 안전하게
 * 동작하도록 리터럴 인덱스가 아니라 bandCount 비율로 경계를 계산한다.
 */
function describeFloorTier(
    floorIndex: number,
    bandCount: number,
    t: PositionTranslator
): string {
    if (bandCount <= 1 || floorIndex === bandCount - 1) return t('penthouse');
    if (floorIndex === 0) return t('lowFloor');
    const midBoundary = Math.floor((bandCount * 2) / 3);
    return floorIndex < midBoundary ? t('midFloor') : t('highFloor');
}

/** 범위 밖 ★평단의 아파트 메타포 phrase(방향만) — describeFloor(전체 문구)와
 * avgFloorVisualNote(시각 노트, 폭 제약)가 함께 파생하는 단일 소스라 리터럴을
 * 양쪽에 중복 선언하지 않는다. */
const ROOFTOP_METAPHOR_KEY = 'rooftop';
const BASEMENT_METAPHOR_KEY = 'basement';

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
export function describeFloor(
    avgPos: number,
    avgClamped: RangeClamp,
    bandCount: number,
    t: PositionTranslator
): string {
    if (avgClamped === 'above')
        return t('rooftopNote', { v0: t(ROOFTOP_METAPHOR_KEY) });
    if (avgClamped === 'below')
        return t('basementNote', { v0: t(BASEMENT_METAPHOR_KEY) });

    const floorIndex = Math.min(
        bandCount - 1,
        Math.max(0, Math.floor(avgPos * bandCount))
    );
    const floorNumber = floorIndex + 1;
    return t('floorNote', {
        v0: floorNumber,
        v1: describeFloorTier(floorIndex, bandCount, t),
    });
}

/**
 * SVG 시각 노트(<text data-testid="avg-floor-note">) 전용 문구 — 범위 밖
 * (above/below)이면 메타포 phrase("옥상 위"/"지하 세대")만 반환한다. 뒤 설명
 * 절("· 최근 고점보다 높은 곳" 등)까지 붙이면 end-anchored 노트 폭이
 * SVG_LABEL_AVAILABLE_WIDTH(118px)를 넘겨 좌측(메타포 phrase)이 잘린다(design
 * audit). 마커가 지붕 위/바닥 아래 중앙에 떠 방향은 위치가 이미 말해주고,
 * return-readout의 "최근 범위의 N% 지점"도 함께 보여 시각 정보 손실은 없다.
 * 범위 안이면 "N층 · tier"(78px, 폭 안전)를 그대로 보여준다. 설명 절을 포함한
 * 전체 문구는 aria-label(describeFloor)이 계속 담아 AT 정보량은 유지한다.
 */
export function avgFloorVisualNote(
    avgClamped: RangeClamp,
    fullNote: string,
    t: PositionTranslator
): string {
    if (avgClamped === 'above') return t(ROOFTOP_METAPHOR_KEY);
    if (avgClamped === 'below') return t(BASEMENT_METAPHOR_KEY);
    return fullNote;
}

/**
 * 범위 밖 마커 안내 앞에 붙는 방향 glyph — 옥상 위(above)는 구름, 지하(below)는 B1, 범위 안이면
 * 빈 문자열. ★평단 층 안내와 ●현재가 범위 밖 안내가 같이 쓴다.
 */
export function outOfRangeGlyph(clamped: RangeClamp): string {
    if (clamped === 'above') return '☁ ';
    if (clamped === 'below') return '▽B1 ';
    return '';
}

interface BandPriceRange {
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

/** 층 툴팁 두 줄 — 가격 구간·거주율(main)과 그 해석 한정어(qualifier). */
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
    volumePct: number,
    symbol: string,
    t: PositionTranslator
): FloorTooltipContent {
    return {
        main: t('bandMain', {
            v0: formatAmount(bandLow, symbol),
            v1: formatAmount(bandHigh, symbol),
            v2: Math.round(volumePct),
        }),
        qualifier: t('bandQualifier'),
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
 * band index가 두 곳에서 따로 계산되지 않게 한다(단일 source, CONVENTIONS.md#CP-2).
 * volumePct가 없거나 유한하지 않은 밴드(비인터랙티브)는 null.
 */
export function buildFloorTooltips(
    model: PositionModel,
    volumeByBand: readonly number[] | null | undefined,
    low52w: number,
    high52w: number,
    bandCount: number,
    symbol: string,
    t: PositionTranslator
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
        return buildFloorTooltipContent(
            bandLow,
            bandHigh,
            volumePct,
            symbol,
            t
        );
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
 * in-SVG 마커 라벨 prefix — aria-label(buildAriaLabel, "평단"/"현재가" 전체 표기,
 * 폭 제약 없음)과 별개로 고정 viewBox 폭 제약을 받는 시각 라벨 전용이다. "내
 * 평단"/"현재가"보다 짧게 둬(audit finding #1) 4자리 이상 가격에서도 라벨이
 * viewBox를 벗어나지 않게 한다.
 */
export const AVG_LABEL_PREFIX_KEY = 'avgPrefix';
/** ●현재가 라벨 prefix 번역 키. */
export const CURRENT_LABEL_PREFIX_KEY = 'currentPrefix';
