/**
 * 회원 평단 vs 52주 고/저 범위 순수 기하 계산.
 * 도메인/시그널 의미 없음(scope fence) — 좌표·퍼센트 산출만 담당한다.
 * 시간/난수/DOM 의존 없는 순수 함수.
 */

export interface PositionInputs {
    low52w: number;
    high52w: number;
    current: number; // lastClose
    avg: number; // 회원 평단
}

export interface PositionBand {
    fromPct: number;
    toPct: number;
}

/**
 * avg/current가 52주 범위를 벗어났을 때 어느 방향인지('above'=고점 초과,
 * 'below'=저점 미만), 범위 안이면 null. avgClamped/currentClamped와
 * PositionBuilding의 파생 함수들(outOfRangeNote, frontY, describeAvgFloor,
 * avgFloorVisualNote)이 모두 이 하나의 타입을 공유한다 — union literal을
 * 파일마다 따로 반복 선언하지 않는다(CONVENTIONS: 2개 이상 멤버 union literal은
 * 타입 alias로 추출).
 */
export type RangeClamp = 'above' | 'below' | null;

export interface PositionModel {
    avgPos: number; // 0..1, [low,high] 내 정규화(clamped)
    currentPos: number; // 0..1, clamped
    avgClamped: RangeClamp;
    currentClamped: RangeClamp;
    pctFromHigh: number; // (avg - high) / high * 100
    pctAboveLow: number; // (avg - low) / low * 100, low<=0이면 0으로 가드
    returnPct: number; // (current - avg) / avg * 100
    rangePositionPct: number; // avgPos * 100
    bands: readonly PositionBand[]; // 20% 단위 5개 구간
}

/**
 * 밴드(가격대 구간) 개수 — 이 상수가 geometry의 source of truth다. 층 hover
 * 기능이 정확하려면 PositionBuilding의 렌더 층 개수와 `[symbol]/position/page.tsx`가
 * computeVolumeByBand에 넘기는 거래량 히스토그램 버킷 개수가 이 값과 항상 같아야
 * 한다 — 둘 다 이 export(BAND_COUNT)를 직접 import해 단일 소스로 묶는다
 * (audit finding: 세 값이 암묵적으로만 같았던 걸 명시적 커플링으로 전환).
 */
export const BAND_COUNT = 5;
const BAND_WIDTH_PCT = 100 / BAND_COUNT;

const BANDS: readonly PositionBand[] = Array.from(
    { length: BAND_COUNT },
    (_, i) => ({
        fromPct: i * BAND_WIDTH_PCT,
        toPct: (i + 1) * BAND_WIDTH_PCT,
    })
);

function clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function clampedDirection(
    value: number,
    low: number,
    high: number
): RangeClamp {
    if (value > high) return 'above';
    if (value < low) return 'below';
    return null;
}

/**
 * 회원 평단·현재가를 52주 고/저 범위 안에서의 위치·퍼센트로 변환한다.
 * 아래 가드 중 하나라도 걸리면 null — 호출부는 위젯을 렌더하지 않아야 한다.
 * (critical review에서 실제 division-by-zero/Infinity 케이스가 발견되어 방어함)
 */
export function computePosition(input: PositionInputs): PositionModel | null {
    const { low52w, high52w, current, avg } = input;

    if (!Number.isFinite(low52w) || !Number.isFinite(high52w)) return null;
    if (high52w <= low52w) return null;
    if (!Number.isFinite(avg) || avg <= 0) return null;
    if (!Number.isFinite(current) || current <= 0) return null;

    const range = high52w - low52w;

    const avgPos = clamp01((avg - low52w) / range);
    const currentPos = clamp01((current - low52w) / range);

    const avgClamped = clampedDirection(avg, low52w, high52w);
    const currentClamped = clampedDirection(current, low52w, high52w);

    // technicalFacts.ts:121의 방어 스타일을 그대로 따른다 — 분모 0 회피.
    const pctFromHigh = high52w > 0 ? ((avg - high52w) / high52w) * 100 : 0;
    const pctAboveLow = low52w > 0 ? ((avg - low52w) / low52w) * 100 : 0;
    const returnPct = ((current - avg) / avg) * 100;
    const rangePositionPct = avgPos * 100;

    return {
        avgPos,
        currentPos,
        avgClamped,
        currentClamped,
        pctFromHigh,
        pctAboveLow,
        returnPct,
        rangePositionPct,
        bands: BANDS,
    };
}
