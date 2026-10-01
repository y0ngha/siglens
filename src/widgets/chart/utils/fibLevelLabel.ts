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

/** 종류별 화면 문구 — 번역 함수(`t`)는 호출부가 쥐고 여기엔 결과 함수만 넘긴다. */
export type FibLevelTexts = Readonly<
    Record<FibLevelKind, (percent: string) => string>
>;

/** 피보나치 레벨 라벨이면 화면 문구로, 아니면 `null`. */
export function formatFibLevelLabel(
    label: string,
    texts: FibLevelTexts
): string | null {
    const fib = parseFibLevelLabel(label);
    return fib ? texts[fib.kind](fib.percent) : null;
}
