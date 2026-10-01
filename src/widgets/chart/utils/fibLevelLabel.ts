export type FibLevelKind = 'retracement' | 'extension' | 'abcExtension';

export interface ParsedFibLevel {
    kind: FibLevelKind;
    /** `61.8%` 꼴 — core `formatFibRatio` 출력 그대로. */
    percent: string;
}

/** 되돌림 비율 상한(78.6%). 그 위(100%~)는 전부 확장이다. */
const MAX_RETRACEMENT_PERCENT = 78.6;

const FIB_LABEL = /^(ABC |ext )?(\d+(?:\.\d+)?)%$/;

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
    if (prefix === 'ABC ') return { kind: 'abcExtension', percent };
    if (prefix === 'ext ' || Number(value) > MAX_RETRACEMENT_PERCENT)
        return { kind: 'extension', percent };
    return { kind: 'retracement', percent };
}
