import type { ChartOverlay } from '@y0ngha/siglens-core';

export type FibLevelKind = 'retracement' | 'extension' | 'abcExtension';

export interface ParsedFibLevel {
    kind: FibLevelKind;
    /** `61.8%` 꼴 — core `formatFibRatio` 출력 그대로. */
    percent: string;
}

/** 되돌림 비율 상한(78.6%). 그 위(100%~)는 전부 확장이다. */
const MAX_RETRACEMENT_PERCENT = 78.6;

/** core `fibonacciCandidates`가 붙이는 접두사 — 정규식과 분기가 같은 값을 쓴다. */
const ABC_PREFIX = 'ABC ';
const EXT_PREFIX = 'ext ';

const FIB_LABEL = new RegExp(
    `^(${ABC_PREFIX}|${EXT_PREFIX})?(\\d+(?:\\.\\d+)?)%$`
);

/**
 * core 피보나치 레벨 라벨(`61.8%`, `ext 127.2%`, `ABC 127.2%`)을 종류별로 가른다.
 *
 * 되돌림은 다리 끝, 확장은 다리 시작 기준이라 같은 `%` 사다리로 그리면 순서가
 * 뒤집혀 보인다 — 화면에서 "되돌림/확장"을 붙여 구분하려고 파싱한다.
 * `ext ` 접두사 도입(core PR #239) 전 캐시 분석(`100%`, `127.2%`)도 같은 결과가
 * 나오도록 접두사가 없으면 비율 크기로 가른다(되돌림은 78.6%까지).
 */
export function parseFibLevelLabel(label: string): ParsedFibLevel | null {
    const m = FIB_LABEL.exec(label);
    if (!m) return null;
    const [, prefix, value] = m;
    const percent = `${value}%`;
    if (prefix === ABC_PREFIX) return { kind: 'abcExtension', percent };
    if (prefix === EXT_PREFIX || Number(value) > MAX_RETRACEMENT_PERCENT)
        return { kind: 'extension', percent };
    return { kind: 'retracement', percent };
}

export type FibLegDirection = 'up' | 'down';

/**
 * 피보나치 작도의 기준 다리 방향 — 첫 앵커 선분(다리: 시작→끝, ABC: A→B)의 끝 가격이
 * 시작보다 낮으면 하락. ABC의 B→C(되돌림) 선분은 보지 않는다. 같은 가격(core가
 * 만들지 않는 수평 다리)은 상승으로 둔다. 선분이 없으면 판단하지 않는다.
 */
export function fibLegDirection(
    segments: ChartOverlay['segments']
): FibLegDirection | null {
    const [s] = segments;
    if (s === undefined) return null;
    return s.to.price < s.from.price ? 'down' : 'up';
}

/**
 * 종류 × 다리 방향별 화면 문구 — 번역 함수(`t`)는 호출부가 쥐고 여기엔 결과 함수만
 * 넘긴다. 같은 `61.8%`라도 하락 다리에선 "반등"(저항), 상승 다리에선 "눌림"(지지)이라
 * 퍼센트만으로는 읽기 어렵다(사용자 피드백).
 */
export type FibLevelTexts = Readonly<
    Record<
        FibLevelKind,
        Readonly<Record<FibLegDirection, (percent: string) => string>>
    >
>;

/**
 * 피보나치 작도의 레벨 라벨이면 다리 방향에 맞는 화면 문구로, 아니면(다른 작도·방향
 * 미상·피보나치 라벨 아님) `null`.
 */
export function formatFibLevelLabel(
    label: string,
    overlay: Pick<ChartOverlay, 'kind' | 'segments'>,
    texts: FibLevelTexts
): string | null {
    if (overlay.kind !== 'fibonacci') return null;
    const direction = fibLegDirection(overlay.segments);
    const fib = parseFibLevelLabel(label);
    return direction && fib ? texts[fib.kind][direction](fib.percent) : null;
}
