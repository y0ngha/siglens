import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 규칙 문서 묶음(에이전트가 규칙의 출처로 읽는 파일들)과 그 크기 예산.
 *
 * 가드(`ruleDocSize.test.ts`, `ruleReferences.test.ts`)와 `yarn rules:size`가 같은 목록을 쓰도록
 * 여기 한 곳에 둔다. 목록이 둘로 갈라지면 스크립트가 보여 주는 총량과 가드가 막는 총량이 어긋난다.
 */

/** 루트 `CLAUDE.md`의 예산 줄. 정확히 한 번만 나와야 한다(0번이면 가드가 공허해진다). */
const BUDGET_PATTERN = /^Rule-document budget: ([\d,]+) bytes\.$/gm;

export interface RuleDocSize {
    readonly file: string;
    readonly bytes: number;
}

/** 규칙 문서 경로(저장소 루트 기준, 정렬됨): conventions 전부, 레이어별 CLAUDE.md, 루트·skills CLAUDE.md. */
export function ruleDocPaths(root: string): string[] {
    const conventions = readdirSync(path.join(root, 'docs/conventions'))
        .filter(name => name.endsWith('.md'))
        .map(name => `docs/conventions/${name}`);
    const layerDocs = readdirSync(path.join(root, 'src'), {
        withFileTypes: true,
    })
        .filter(entry => entry.isDirectory())
        .map(entry => `src/${entry.name}/CLAUDE.md`)
        .filter(file => {
            try {
                readFileSync(path.join(root, file));
                return true;
            } catch {
                return false;
            }
        });
    return [...conventions, ...layerDocs, 'CLAUDE.md', 'skills/CLAUDE.md'];
}

export function measureRuleDocs(root: string): RuleDocSize[] {
    return ruleDocPaths(root).map(file => ({
        file,
        bytes: Buffer.byteLength(
            readFileSync(path.join(root, file), 'utf8'),
            'utf8'
        ),
    }));
}

/** 예산 줄을 읽는다. 없거나 둘 이상이면 모호하므로 `null`. */
export function parseBudget(claudeMd: string): number | null {
    const matches = [...claudeMd.matchAll(BUDGET_PATTERN)];
    const digits = matches.length === 1 ? matches[0]?.[1] : undefined;
    return digits === undefined ? null : Number(digits.replaceAll(',', ''));
}

export function totalBytes(sizes: readonly RuleDocSize[]): number {
    return sizes.reduce((sum, { bytes }) => sum + bytes, 0);
}

export const NO_BUDGET_LINE_MESSAGE =
    'CLAUDE.md must contain exactly one "Rule-document budget: N bytes." line';

export interface BudgetVerdict {
    /** 위반 설명. 통과면 `null`. 가드가 그대로 단언하고 스크립트는 종료 코드로 바꾼다. */
    readonly violation: string | null;
    /** 사람이 읽을 출력: 통과·초과면 크기 표, 예산 줄이 없으면 그 안내. */
    readonly output: string;
}

/**
 * 가드(`ruleDocSize.test.ts`)와 `yarn rules:size`가 같은 판정·같은 문구를 쓰게 하는 단일 출처.
 * 예산 줄이 없거나(0번 또는 중복) 합계가 예산을 넘으면 위반이다.
 */
export function judgeBudget(
    sizes: readonly RuleDocSize[],
    budget: number | null
): BudgetVerdict {
    if (budget === null) {
        return {
            violation: NO_BUDGET_LINE_MESSAGE,
            output: NO_BUDGET_LINE_MESSAGE,
        };
    }
    const table = formatSizeTable(sizes, budget);
    return {
        violation:
            totalBytes(sizes) <= budget
                ? null
                : `rule documents exceed the budget\n${table}`,
        output: table,
    };
}

/** 파일별 바이트(큰 순), 합계, 여유분(예산 - 합계; 음수면 초과)을 한 문자열로. */
export function formatSizeTable(
    sizes: readonly RuleDocSize[],
    budget: number
): string {
    const total = totalBytes(sizes);
    const rows = sizes
        .toSorted((a, b) => b.bytes - a.bytes || (a.file < b.file ? -1 : 1))
        .map(({ file, bytes }) => `${String(bytes).padStart(9)}  ${file}`);
    const headroom = budget - total;
    return [
        ...rows,
        `${String(total).padStart(9)}  total`,
        `${String(budget).padStart(9)}  budget`,
        `${String(headroom).padStart(9)}  headroom${headroom < 0 ? ' (OVER BUDGET)' : ''}`,
    ].join('\n');
}
