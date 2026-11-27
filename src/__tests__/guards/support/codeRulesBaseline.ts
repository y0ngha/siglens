import { CODE_RULES, type CodeRule, type RuleCounts } from './codeRules';

/**
 * 코드 규칙 기준선(`codeRules.baseline.json`)의 읽기·비교·갱신. 디스크를 건드리지 않는 순수 함수만 둔다.
 *
 * 기준선은 `{ "<규칙 키>": { "<저장소 경로>": <위반 수> } }`이고 **줄이기만 한다.**
 * 줄 번호가 아니라 파일별 개수를 쓴다(TESTING.md#TE-44): 줄 번호는 무관한 편집에도 밀린다.
 * 올리는 경로는 코드에 없다. 값을 올리거나 항목을 더하는 것은 JSON을 손으로 고치는 일이고
 * 사용자 승인을 PR 본문에 적어야 한다(TOOLCHAIN.md#TC-41).
 */

export const BASELINE_PATH = 'src/__tests__/guards/codeRules.baseline.json';

export type Baseline = Readonly<
    Record<string, Readonly<Record<string, number>>>
>;

export interface Regression {
    readonly rule: CodeRule;
    readonly file: string;
    readonly baseline: number;
    readonly current: number;
}

export interface StaleEntry {
    readonly rule: string;
    readonly file: string;
    readonly baseline: number;
    readonly reason: string;
}

export interface Comparison {
    /** 기준선보다 늘었거나(zero 규칙은 0보다 큰) 파일. 실패. */
    readonly regressions: readonly Regression[];
    /**
     * 파일이 사라졌거나 알 수 없는 규칙 키, 기준선을 받지 않는 zero 규칙의 항목. 실패.
     * 파일이 있는데 위반이 0이 된 항목은 실패가 아니다: 같은 파일을 줄이는 PR 둘이 각자 통과한 뒤
     * 합쳐져도 master가 깨지지 않게 하려는 것이다. `tightenable`로 보고하고 `--tighten`이 지운다.
     */
    readonly stale: readonly StaleEntry[];
    /** 현재 < 기준선(0 포함). 통과, `--tighten`으로 줄이거나 지울 수 있다. */
    readonly tightenable: readonly {
        readonly rule: string;
        readonly file: string;
        readonly baseline: number;
        readonly current: number;
    }[];
}

const ruleByKey = (key: string): CodeRule | undefined =>
    CODE_RULES.find(rule => rule.key === key);

function entriesOf(
    map: Readonly<Record<string, Readonly<Record<string, number>>>>,
    key: string
): readonly (readonly [string, number])[] {
    return Object.entries(map[key] ?? {});
}

export function compareToBaseline(
    current: RuleCounts,
    baseline: Baseline,
    existingFiles: ReadonlySet<string>
): Comparison {
    const regressions = CODE_RULES.flatMap(rule =>
        entriesOf(current, rule.key).flatMap(([file, count]) => {
            const allowed =
                rule.mode === 'ratchet' ? (baseline[rule.key]?.[file] ?? 0) : 0;
            return count > allowed
                ? [{ rule, file, baseline: allowed, current: count }]
                : [];
        })
    );
    const stale = Object.entries(baseline).flatMap(([key, files]) => {
        const rule = ruleByKey(key);
        if (rule === undefined || rule.mode !== 'ratchet') {
            return Object.entries(files).map(([file, count]) => ({
                rule: key,
                file,
                baseline: count,
                reason:
                    rule === undefined
                        ? 'unknown rule key'
                        : 'rule is zero-tolerance and takes no baseline entries',
            }));
        }
        return Object.entries(files).flatMap(([file, count]) => {
            return existingFiles.has(file)
                ? []
                : [
                      {
                          rule: key,
                          file,
                          baseline: count,
                          reason: 'the file is gone',
                      },
                  ];
        });
    });
    const tightenable = CODE_RULES.filter(rule => rule.mode === 'ratchet')
        .flatMap(rule =>
            entriesOf(baseline, rule.key).map(([file, allowed]) => ({
                rule: rule.key,
                file,
                baseline: allowed,
                current: current[rule.key]?.[file] ?? 0,
            }))
        )
        .filter(
            entry =>
                existingFiles.has(entry.file) && entry.current < entry.baseline
        );
    return { regressions, stale, tightenable };
}

export function describeComparison(comparison: Comparison): string[] {
    return [
        ...comparison.regressions.map(
            ({ rule, file, baseline, current }) =>
                `${file}: ${rule.key} ${baseline} -> ${current} (${rule.docRef}). ${rule.fix}` +
                (rule.mode === 'ratchet'
                    ? ' A new file starts at 0; the baseline only goes down.'
                    : ' This rule allows no violations.')
        ),
        ...comparison.stale.map(
            ({ rule, file, baseline, reason }) =>
                `${file}: stale baseline entry ${rule} = ${baseline} (${reason}). Run \`yarn rules:ratchet --tighten\`.`
        ),
    ];
}

// ------------------------------------------------------------------- file I/O

/** 규칙 키와 경로를 정렬하고 `JSON.stringify(_, null, 4) + '\n'`로 쓴다(i18n 기준선과 같은 형식). */
export function serializeBaseline(baseline: Baseline): string {
    const sorted = Object.fromEntries(
        Object.entries(baseline)
            .filter(([, files]) => Object.keys(files).length > 0)
            .toSorted(([a], [b]) => (a < b ? -1 : 1))
            .map(([key, files]) => [
                key,
                Object.fromEntries(
                    Object.entries(files).toSorted(([a], [b]) =>
                        a < b ? -1 : 1
                    )
                ),
            ])
    );
    return `${JSON.stringify(sorted, null, 4)}\n`;
}

function isCountMap(value: unknown): value is Record<string, number> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every(
            count => Number.isInteger(count) && Number(count) > 0
        )
    );
}

function isBaseline(value: unknown): value is Baseline {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every(isCountMap)
    );
}

export function parseBaseline(text: string): Baseline {
    const parsed: unknown = JSON.parse(text);
    if (!isBaseline(parsed)) {
        throw new Error(
            'codeRules baseline must be { rule: { path: positive integer } }'
        );
    }
    return parsed;
}

// ----------------------------------------------------------------- operations

/** 처음 만들 때만: ratchet 규칙의 현재 수를 그대로 기록한다. */
export function initialBaseline(current: RuleCounts): Baseline {
    return Object.fromEntries(
        CODE_RULES.filter(rule => rule.mode === 'ratchet')
            .map(rule => [rule.key, current[rule.key] ?? {}] as const)
            .filter(([, files]) => Object.keys(files).length > 0)
    );
}

/**
 * 기존 항목을 `min(현재, 기준선)`으로 줄이고 0이거나 사라진 항목을 지운다.
 * **항목을 더하거나 값을 올리지 않는다.** 현재 수가 기준선보다 커도 기준선을 그대로 둔다.
 */
export function tightenBaseline(
    current: RuleCounts,
    baseline: Baseline
): Baseline {
    return Object.fromEntries(
        Object.entries(baseline)
            .filter(([key]) => ruleByKey(key)?.mode === 'ratchet')
            .map(([key, files]) => [
                key,
                Object.fromEntries(
                    Object.entries(files)
                        .map(
                            ([file, allowed]) =>
                                [
                                    file,
                                    Math.min(
                                        allowed,
                                        current[key]?.[file] ?? 0
                                    ),
                                ] as const
                        )
                        .filter(([, count]) => count > 0)
                ),
            ])
            .filter(([, files]) => Object.keys(files).length > 0)
    );
}

export type MoveResult =
    | { readonly ok: true; readonly baseline: Baseline }
    | { readonly ok: false; readonly reason: string };

/**
 * 옮긴 파일의 항목을 새 경로로 옮긴다. 합계는 그대로다.
 * 옛 경로가 디스크에 아직 있거나, 새 경로의 현재 수가 옛 항목보다 크거나, 새 경로에 이미 항목이 있거나, 옛 경로에 항목이 없으면 거절한다.
 */
export function moveBaselineEntry(
    current: RuleCounts,
    baseline: Baseline,
    from: string,
    to: string,
    fromStillExists: boolean
): MoveResult {
    if (from === to) return { ok: false, reason: 'old and new path are equal' };
    // 옛 파일이 그대로 있으면 옮긴 게 아니라 고친 파일의 빚을 새 파일로 넘기는 것이다.
    if (fromStillExists) {
        return {
            ok: false,
            reason: `${from} still exists; a move needs the old path gone (a rename or delete). Use --tighten for a fixed file`,
        };
    }
    const moved = Object.entries(baseline).filter(
        ([, files]) => files[from] !== undefined
    );
    if (moved.length === 0) {
        return { ok: false, reason: `${from} has no baseline entry to move` };
    }
    const problem = moved.flatMap(([key, files]) => {
        const old = files[from] ?? 0;
        const now = current[key]?.[to] ?? 0;
        if (files[to] !== undefined) {
            return [`${to} already has a ${key} entry`];
        }
        return now > old
            ? [
                  `${to} has ${now} ${key} violations, more than the ${old} recorded for ${from}`,
              ]
            : [];
    })[0];
    if (problem !== undefined) return { ok: false, reason: problem };
    const next = Object.fromEntries(
        Object.entries(baseline)
            .map(([key, files]) => {
                const old = files[from];
                if (old === undefined) return [key, files] as const;
                const { [from]: _removed, ...rest } = files;
                const carried =
                    (current[key]?.[to] ?? 0) > 0 ? { [to]: old } : {};
                return [key, { ...rest, ...carried }] as const;
            })
            .filter(([, files]) => Object.keys(files).length > 0)
    );
    return { ok: true, baseline: next };
}

export interface RaisedEntry {
    readonly rule: string;
    readonly file: string;
    readonly from: number;
    readonly to: number;
}

export interface NewEntry {
    readonly rule: string;
    readonly file: string;
    readonly count: number;
}

/**
 * 기준 ref의 기준선 대비 올라간 값과, 이름 변경으로 설명되지 않는 새 키.
 * `renames`는 `git diff --name-status -M <ref>`의 R 항목(옛 경로 -> 새 경로)이다. 새 항목은
 * git이 바로 그 두 경로를 짝지었고 옛 경로가 ref 기준선에 있으며 값이 옛 값 이하일 때만 설명된다.
 * 사라진 항목의 값이 크다는 이유만으로는 짝지우지 않는다.
 */
export function compareAgainst(
    ref: Baseline,
    working: Baseline,
    renames: ReadonlyMap<string, string>
): { raised: readonly RaisedEntry[]; added: readonly NewEntry[] } {
    const raised = Object.entries(working).flatMap(([rule, files]) =>
        Object.entries(files).flatMap(([file, to]) => {
            const from = ref[rule]?.[file];
            return from !== undefined && to > from
                ? [{ rule, file, from, to }]
                : [];
        })
    );
    const oldPathOf = new Map(
        [...renames].map(([oldPath, newPath]) => [newPath, oldPath])
    );
    const added = Object.entries(working).flatMap(([rule, files]) =>
        Object.entries(files)
            .filter(([file]) => ref[rule]?.[file] === undefined)
            .filter(([file, count]) => {
                const oldPath = oldPathOf.get(file);
                const recorded =
                    oldPath === undefined ? undefined : ref[rule]?.[oldPath];
                return recorded === undefined || count > recorded;
            })
            .map(([file, count]) => ({ rule, file, count }))
    );
    return { raised, added };
}
