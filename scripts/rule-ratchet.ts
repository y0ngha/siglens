/**
 * 코드 규칙 기준선 도구. `yarn rules:ratchet`.
 *
 * `src/__tests__/guards/codeRules.test.ts` 가드와 같은 엔진·같은 기준선
 * (`codeRules.baseline.json`)을 쓴다. 기준선은 줄이기만 하므로 이 도구에는 올리는 경로가 없다.
 *
 *   yarn rules:ratchet                       현황 보고. 늘었거나 낡은 항목이 있으면 종료 코드 1.
 *   yarn rules:ratchet --tighten             기존 항목만 min(현재, 기준선)으로 줄이고 0인 항목을 지운다(0 항목 정리를 위해 주기적으로 돌린다).
 *   yarn rules:ratchet --move <옛> <새>      이름을 바꾸거나 지운(옛 경로가 사라진) 파일의 항목을 새 경로로 옮긴다.
 *   yarn rules:ratchet --against <git ref>   ref의 기준선 대비 올라간 값과 git 이름 변경으로 설명되지 않는 새 키를 나열한다.
 *   yarn rules:ratchet --init                기준선 파일이 없을 때 한 번만 만든다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CODE_RULES,
    scanRepo,
    type ScanResult,
} from '../src/__tests__/guards/support/codeRules';
import {
    BASELINE_PATH,
    compareAgainst,
    compareToBaseline,
    describeComparison,
    initialBaseline,
    moveBaselineEntry,
    parseBaseline,
    serializeBaseline,
    tightenBaseline,
    type Baseline,
} from '../src/__tests__/guards/support/codeRulesBaseline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export type RatchetCommand =
    | { readonly kind: 'report' }
    | { readonly kind: 'tighten' }
    | { readonly kind: 'init' }
    | { readonly kind: 'move'; readonly from: string; readonly to: string }
    | { readonly kind: 'against'; readonly ref: string }
    | { readonly kind: 'usage'; readonly message: string };

const USAGE =
    'usage: yarn rules:ratchet [--tighten | --init | --move <old> <new> | --against <git ref>]';

export function parseRatchetArgs(args: readonly string[]): RatchetCommand {
    const [flag, first, second, ...rest] = args;
    if (flag === undefined) return { kind: 'report' };
    if (flag === '--tighten' && first === undefined) return { kind: 'tighten' };
    if (flag === '--init' && first === undefined) return { kind: 'init' };
    if (
        flag === '--move' &&
        first !== undefined &&
        second !== undefined &&
        rest.length === 0
    ) {
        return { kind: 'move', from: first, to: second };
    }
    if (flag === '--against' && first !== undefined && second === undefined) {
        return { kind: 'against', ref: first };
    }
    return { kind: 'usage', message: USAGE };
}

export interface RatchetDeps {
    /** 현재 소스의 스캔 결과. 필요한 명령에서만 호출한다(스캔은 몇 초 걸린다). */
    readonly scan: () => ScanResult;
    /** 작업 트리의 기준선 파일 텍스트. 없으면 `null`. */
    readonly readBaseline: () => string | null;
    /** `git show <ref>:<baseline>`. ref에 기준선이 없으면 `null`. */
    readonly readRefBaseline: (ref: string) => string | null;
    /** `git diff --name-status -M <ref>`의 이름 변경(옛 경로 -> 새 경로). */
    readonly readRenames: (ref: string) => ReadonlyMap<string, string>;
    /** 저장소 파일이 디스크에 있는가(`--move`가 옛 경로가 사라졌는지 확인한다). */
    readonly fileExists: (file: string) => boolean;
}

export interface RatchetOutcome {
    readonly output: string;
    readonly exitCode: 0 | 1;
    /** 기준선 파일에 쓸 새 내용. 없으면 쓰지 않는다. */
    readonly write?: string;
}

const fail = (output: string): RatchetOutcome => ({ output, exitCode: 1 });

function totals(counts: Baseline): string {
    return CODE_RULES.map(rule => {
        const sum = Object.values(counts[rule.key] ?? {}).reduce(
            (a, b) => a + b,
            0
        );
        return `  ${rule.key} [${rule.mode}] ${sum}`;
    }).join('\n');
}

function runAgainst(
    ref: string,
    baselineText: string | null,
    deps: RatchetDeps
): RatchetOutcome {
    if (baselineText === null) return fail(`${BASELINE_PATH} does not exist`);
    const refText = deps.readRefBaseline(ref);
    if (refText === null) {
        return {
            output: `${BASELINE_PATH} does not exist at ${ref}: nothing to compare (first introduction).`,
            exitCode: 0,
        };
    }
    const { raised, added } = compareAgainst(
        parseBaseline(refText),
        parseBaseline(baselineText),
        deps.readRenames(ref)
    );
    const lines = [
        ...raised.map(
            ({ rule, file, from, to }) =>
                `RAISED ${rule} ${file}: ${from} -> ${to}`
        ),
        ...added.map(
            ({ rule, file, count }) =>
                `NEW ${rule} ${file}: ${count} (not explained by a git rename)`
        ),
    ];
    return lines.length === 0
        ? { output: `no raised counts or new keys against ${ref}`, exitCode: 0 }
        : fail(
              `${lines.join('\n')}\nRaising a count or adding a key needs the user's approval stated in the PR body.`
          );
}

/** 명령 하나를 실행해 출력·종료 코드·(있으면) 새 기준선 내용을 돌려준다. 파일 쓰기는 호출자가 한다. */
export function runRatchet(
    command: RatchetCommand,
    deps: RatchetDeps
): RatchetOutcome {
    if (command.kind === 'usage') return fail(command.message);
    const baselineText = deps.readBaseline();
    if (command.kind === 'against') {
        return runAgainst(command.ref, baselineText, deps);
    }
    if (command.kind === 'init' && baselineText !== null) {
        return fail(
            `${BASELINE_PATH} already exists. --init only creates it; use --tighten to lower entries. Raising a count is a hand edit that needs the user's approval.`
        );
    }
    if (command.kind !== 'init' && baselineText === null) {
        return fail(`${BASELINE_PATH} does not exist (run --init once).`);
    }
    const result = deps.scan();
    if (result.problems.length > 0) {
        return fail(`engine problems:\n${result.problems.join('\n')}`);
    }
    if (command.kind === 'init') {
        const created = initialBaseline(result.counts);
        return {
            output: `created ${BASELINE_PATH}\n${totals(created)}`,
            exitCode: 0,
            write: serializeBaseline(created),
        };
    }
    const baseline = parseBaseline(baselineText ?? '{}');
    if (command.kind === 'move') {
        const moved = moveBaselineEntry(
            result.counts,
            baseline,
            command.from,
            command.to,
            deps.fileExists(command.from)
        );
        return moved.ok
            ? {
                  output: `moved ${command.from} -> ${command.to}`,
                  exitCode: 0,
                  write: serializeBaseline(moved.baseline),
              }
            : fail(`refused: ${moved.reason}`);
    }
    if (command.kind === 'tighten') {
        // 현재 수가 기준선보다 큰 항목이 있으면 줄이기 전에 먼저 고쳐야 한다.
        const { regressions } = compareToBaseline(
            result.counts,
            baseline,
            new Set(result.paths)
        );
        const next = serializeBaseline(
            tightenBaseline(result.counts, baseline)
        );
        return {
            output: `${next === serializeBaseline(baseline) ? 'baseline already tight' : 'baseline tightened'}${regressions.length > 0 ? `\n${regressions.length} regression(s) remain; --tighten never raises a count` : ''}\n${totals(parseBaseline(next))}`,
            exitCode: regressions.length > 0 ? 1 : 0,
            write: next,
        };
    }
    const comparison = compareToBaseline(
        result.counts,
        baseline,
        new Set(result.paths)
    );
    const problems = describeComparison(comparison);
    const tightenable = comparison.tightenable.map(
        ({ rule, file, baseline: was, current }) =>
            `  ${file}: ${rule} ${was} -> ${current}`
    );
    return {
        output: [
            `current totals:\n${totals(result.counts)}`,
            `baseline totals:\n${totals(baseline)}`,
            ...(problems.length > 0
                ? [`failures:\n${problems.join('\n')}`]
                : []),
            ...(tightenable.length > 0
                ? [`tightenable (run --tighten):\n${tightenable.join('\n')}`]
                : []),
        ].join('\n\n'),
        exitCode: problems.length > 0 ? 1 : 0,
    };
}

function readRefBaseline(ref: string): string | null {
    try {
        return execFileSync('git', ['show', `${ref}:${BASELINE_PATH}`], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return null;
    }
}

/**
 * `git diff --name-status -M <ref>`의 R 항목. 작업 트리와 ref를 비교하므로 추적되는 파일만 보인다:
 * 새 경로가 아직 git에 없으면(untracked) 이름 변경으로 잡히지 않는다. 리뷰는 커밋된 브랜치에서 돌린다.
 */
function readRenames(ref: string): ReadonlyMap<string, string> {
    try {
        const out = execFileSync('git', ['diff', '--name-status', '-M', ref], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        return new Map(
            out
                .split('\n')
                .map(line => line.split('\t'))
                .flatMap(([status, from, to]) =>
                    status?.startsWith('R') && from && to
                        ? [[from, to] as const]
                        : []
                )
        );
    } catch {
        return new Map();
    }
}

const executedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (executedDirectly) {
    const baselineFile = join(ROOT, BASELINE_PATH);
    const outcome = runRatchet(parseRatchetArgs(process.argv.slice(2)), {
        scan: () => scanRepo(ROOT),
        readBaseline: () =>
            existsSync(baselineFile)
                ? readFileSync(baselineFile, 'utf8')
                : null,
        readRefBaseline,
        readRenames,
        fileExists: file => existsSync(join(ROOT, file)),
    });
    if (outcome.write !== undefined) {
        writeFileSync(baselineFile, outcome.write);
    }
    console.log(outcome.output);
    process.exitCode = outcome.exitCode;
}
