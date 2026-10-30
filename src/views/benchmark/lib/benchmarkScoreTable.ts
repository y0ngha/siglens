/**
 * 점수표의 행·칸 모델 — 행 만들기와 행마다 최고점 강조 판정.
 */
import {
    formatBenchmarkScore,
    roundBenchmarkScore,
} from '@/shared/lib/benchmarkFormat';

/** 점수표 한 줄. 행 = 구분(레벨·시장 등), 칸 = 대상 id별 점수. */
export interface BenchmarkScoreRow {
    readonly key: string;
    readonly label: string;
    readonly scores: Readonly<Record<string, number | null>>;
}

/** 점수표 한 칸. */
export interface BenchmarkScoreCell {
    readonly targetId: string;
    readonly text: string;
    /** 이 행에서 가장 높은 점수(화면에 찍히는 반올림 값 기준)인가. */
    readonly isBest: boolean;
}

/** 구분 키 순서대로 점수표 행을 만든다. 이름이 없는 키는 키 그대로 쓴다. */
export function toBenchmarkScoreRows(
    keys: readonly string[],
    table: Readonly<Record<string, Readonly<Record<string, number | null>>>>,
    names: Readonly<Record<string, string>>
): readonly BenchmarkScoreRow[] {
    return keys.map(key => ({
        key,
        label: names[key] ?? key,
        scores: table[key] ?? {},
    }));
}

/**
 * 행 하나의 칸들(대상 순서). 가장 높은 점수는 화면에 찍히는 반올림 값끼리 비교한다 — 보이는
 * 값이 같으면 동점이라 모두 강조한다. 값이 없는 칸은 강조하지 않는다.
 */
export function toBenchmarkScoreCells(
    row: BenchmarkScoreRow,
    targetIds: readonly string[]
): readonly BenchmarkScoreCell[] {
    const values = targetIds.map(id => row.scores[id] ?? null);
    const shown = values.flatMap(value =>
        value === null ? [] : [roundBenchmarkScore(value)]
    );
    const best = shown.length > 0 ? Math.max(...shown) : null;
    return targetIds.map((targetId, index) => {
        const value = values[index] ?? null;
        return {
            targetId,
            text: formatBenchmarkScore(value),
            isBest: value !== null && roundBenchmarkScore(value) === best,
        };
    });
}
