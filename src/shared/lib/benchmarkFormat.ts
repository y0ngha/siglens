/** 값이 없을 때 표에 찍는 자리표시. */
export const BENCHMARK_EMPTY_CELL = '-';

const MINUS = '−';

/**
 * 소수 셋째 자리로 반올림한 점수 문자열과, 반올림 후 값. 반올림해서 0이 되는 음수는 `-0.000`이
 * 아니라 `0.000`이다 — 방향이 있는 것처럼 읽히지 않게 한다.
 */
function fixed3(value: number): string {
    const fixed = value.toFixed(3);
    return Number(fixed) === 0 ? '0.000' : fixed;
}

/**
 * 표시용으로 반올림한 점수. 표에서 "가장 높은 값"을 가릴 때 화면에 찍히는 값끼리
 * 비교하려고 쓴다(보이는 값이 같으면 동점이다).
 */
export function roundBenchmarkScore(value: number): number {
    return Number(fixed3(value));
}

/** 점수(−1~1 또는 0~1)를 소수 셋째 자리까지. 값이 없으면 자리표시. */
export function formatBenchmarkScore(value: number | null): string {
    if (value === null) return BENCHMARK_EMPTY_CELL;
    return fixed3(value).replace('-', MINUS);
}

/**
 * 부호를 항상 붙인 차이. 반올림해서 0이 되는 값은 부호 없이 `0.000`이다 —
 * `+0.000`/`−0.000`은 방향이 있는 것처럼 읽힌다.
 */
export function formatBenchmarkDiff(value: number): string {
    const text = fixed3(value);
    if (Number(text) === 0) return text;
    return value > 0 ? `+${text}` : text.replace('-', MINUS);
}

/** 95% 신뢰구간 `[하한, 상한]`. */
export function formatBenchmarkCi(ci: readonly [number, number]): string {
    return `[${formatBenchmarkDiff(ci[0])}, ${formatBenchmarkDiff(ci[1])}]`;
}

/** p값. 검정하지 않은 비교(null)는 자리표시, 0.001 미만은 `<0.001`. */
export function formatBenchmarkP(value: number | null): string {
    if (value === null) return BENCHMARK_EMPTY_CELL;
    if (value < 0.001) return '<0.001';
    return value.toFixed(3);
}

/** 측정·채점일(ISO)에서 날짜 부분만. 로케일과 무관하게 같은 표기를 쓴다. */
export function formatBenchmarkDate(iso: string): string {
    return iso.slice(0, 10);
}

/** 비교 한 건의 수치 필드(도메인 타입을 import하지 않도록 구조로만 받는다). */
interface ContrastNumbers {
    readonly diff: number;
    readonly ci95: readonly [number, number];
    readonly pHolm: number | null;
}

export interface BenchmarkContrastText {
    readonly diffText: string;
    readonly ciText: string;
    /** 검정하지 않은 비교(기준선)는 자리표시. */
    readonly pText: string;
}

/** 헤드라인 표·요약 카드가 찍는 차이·신뢰구간·p값 문자열. 화면 어디에도 손으로 쓴 숫자가 없게 한다. */
export function formatBenchmarkContrast(
    contrast: ContrastNumbers
): BenchmarkContrastText {
    return {
        diffText: formatBenchmarkDiff(contrast.diff),
        ciText: formatBenchmarkCi(contrast.ci95),
        pText: formatBenchmarkP(contrast.pHolm),
    };
}
