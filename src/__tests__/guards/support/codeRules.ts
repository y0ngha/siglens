import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

/**
 * **코드 규칙 엔진.** AST로 판정하는 코드 규칙을 한 곳에서 돌린다.
 *
 * 파일마다 babel로 한 번만 파싱하고 한 번만 순회하며 모든 규칙의 방문자를 부른다. 규칙마다
 * 가드를 따로 만들면 같은 파일을 규칙 수만큼 다시 파싱한다.
 *
 * 규칙에는 두 모드가 있다.
 * - `zero`: 위반이 하나라도 있으면 실패한다.
 * - `ratchet`: 파일별 위반 수를 `codeRules.baseline.json`에 얼려 두고, 그보다 늘면 실패한다.
 *   새 파일은 기준선에 없으므로 0에서 시작한다. 줄이는 쪽은 자유롭다.
 *
 * 규칙 키(`non-null-assertion` 등)는 문서 ID와 무관하다. 문서 규칙이 폐기돼 ID가 바뀌어도
 * 기준선 키는 그대로다. 문서 위치는 `docRef`에만 적는다.
 */

export type RuleMode = 'zero' | 'ratchet';

/** babel 노드를 구조적으로만 본다(`@babel/types`는 직접 의존이 아니다). */
export interface AstNode {
    readonly type: string;
    readonly start?: number | null;
    readonly end?: number | null;
    readonly [key: string]: unknown;
}

export interface CodeRule {
    /** 기준선 JSON의 키. 문서 ID와 독립이다. */
    readonly key: string;
    /** 이 규칙의 문서 위치(`FILE#ID`). 실패 메시지에 붙는다. */
    readonly docRef: string;
    readonly mode: RuleMode;
    /** 실패 메시지에 붙는 한 줄 고치는 법. */
    readonly fix: string;
    /** 이 파일을 검사하는가(저장소 루트 기준 경로). */
    appliesTo(file: string): boolean;
    /** 노드 하나에서 찾은 위반 수. 형제 문장 묶음을 보는 규칙은 묶음 노드에서 센다. */
    countAt(node: AstNode): number;
}

/** `{ [ruleKey]: { [repoPath]: count } }`. 0인 항목은 담지 않는다. */
export type RuleCounts = Readonly<
    Record<string, Readonly<Record<string, number>>>
>;

export interface SourceFile {
    readonly path: string;
    readonly text: string;
}

export interface ScanResult {
    readonly counts: RuleCounts;
    readonly scanned: number;
    /** 스캔한 파일 경로. 기준선 항목의 파일이 아직 있는지 판단하는 데 쓴다. */
    readonly paths: readonly string[];
    /** 파싱 실패와 판정 자체가 의심되는 경우. 비어 있어야 한다. */
    readonly problems: readonly string[];
}

const CODE_FILE = /\.(?:ts|tsx|mts|mjs|cjs|js)$/;
const SCAN_ROOTS = ['src', 'e2e', 'scripts', 'cache-handler', 'db'];

/** 엔진이 이보다 적게 스캔했다면 파일 열거가 깨진 것이다(공허한 통과 방지). */
export const MIN_SCANNED_FILES = 5000;

export function isCodeFile(file: string): boolean {
    return CODE_FILE.test(file) && !file.endsWith('.d.ts');
}

/** 테스트 파일: `*.test.*`·`*.spec.*`, `__tests__/`, `__integration__/`, 테스트 유틸, e2e. */
export function isTestFile(file: string): boolean {
    const segments = file.split('/');
    return (
        /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
        segments.includes('__tests__') ||
        segments.includes('__integration__') ||
        file.startsWith('src/shared/test-utils/') ||
        file.startsWith('e2e/')
    );
}

// ---------------------------------------------------------------- AST helpers

function isNode(value: unknown): value is AstNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof Reflect.get(value, 'type') === 'string'
    );
}

function child(node: AstNode, key: string): AstNode | null {
    const value = node[key];
    return isNode(value) ? value : null;
}

function children(node: AstNode, key: string): readonly AstNode[] {
    const value = node[key];
    return Array.isArray(value) ? value.filter(isNode) : [];
}

function nameOf(node: AstNode | null): string | null {
    return node !== null &&
        node.type === 'Identifier' &&
        typeof node.name === 'string'
        ? node.name
        : null;
}

const WRAPPERS = new Set([
    'TSNonNullExpression',
    'TSAsExpression',
    'TSSatisfiesExpression',
    'ParenthesizedExpression',
]);

/** `x!`·`x as T` 같은 래퍼를 벗겨 안쪽 식을 돌려준다. */
function unwrap(node: AstNode | null): AstNode | null {
    return node !== null && WRAPPERS.has(node.type)
        ? unwrap(child(node, 'expression'))
        : node;
}

function isMember(node: AstNode | null): node is AstNode {
    return (
        node !== null &&
        (node.type === 'MemberExpression' ||
            node.type === 'OptionalMemberExpression')
    );
}

/** `<member>.<name>`(점 접근)의 `name`. 계산 접근이면 `null`. */
function dotName(node: AstNode | null): string | null {
    return isMember(node) && node.computed !== true
        ? nameOf(child(node, 'property'))
        : null;
}

/** `<x>.mock.calls` 인가. */
function isMockCalls(node: AstNode | null): boolean {
    const target = unwrap(node);
    if (dotName(target) !== 'calls' || target === null) return false;
    const owner = unwrap(child(target, 'object'));
    return dotName(owner) === 'mock';
}

/**
 * 순회: 모든 노드를 깊이 우선으로 돌려준다.
 *
 * CONVENTIONS.md#CP-6 예외: 6천여 파일의 AST를 한 번씩 훑는 O(N) 핫 루프다. 노드마다 새 배열을
 * 만드는 재귀 flatMap은 이 가드의 실행 시간을 몇 배로 늘려 pre-commit에 둘 수 없게 만든다.
 */
function* walk(root: AstNode): Generator<AstNode> {
    const stack: AstNode[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (node === undefined) break;
        yield node;
        for (const [key, value] of Object.entries(node)) {
            if (key === 'loc' || key === 'extra' || key === 'comments') {
                continue;
            }
            if (Array.isArray(value)) {
                value.forEach(item => {
                    if (isNode(item)) stack.push(item);
                });
            } else if (isNode(value)) {
                stack.push(value);
            }
        }
    }
}

function assignsTo(node: AstNode, name: string): boolean {
    return (
        node.type === 'AssignmentExpression' &&
        nameOf(child(node, 'left')) === name
    );
}

/** 문장 목록을 가진 노드의 목록. 아니면 `null`. */
function statementList(node: AstNode): readonly AstNode[] | null {
    switch (node.type) {
        case 'Program':
        case 'BlockStatement':
        case 'StaticBlock':
        case 'TSModuleBlock':
            return children(node, 'body');
        case 'SwitchCase':
            return children(node, 'consequent');
        default:
            return null;
    }
}

/** 연속한 두 문장 `(first, second)` 중 조건에 맞는 쌍의 수. */
function countAdjacent(
    node: AstNode,
    matches: (first: AstNode, second: AstNode) => number
): number {
    const list = statementList(node);
    if (list === null) return 0;
    return list.reduce<number>((sum, first, index) => {
        const second = list[index + 1];
        return second === undefined ? sum : sum + matches(first, second);
    }, 0);
}

// ---------------------------------------------------------------------- rules

function countMockCallIndex(node: AstNode): number {
    // `fn.mock.calls[i]`: 어떤 인덱스든 호출 순서에 기댄다.
    if (isMember(node) && node.computed === true) {
        return isMockCalls(child(node, 'object')) ? 1 : 0;
    }
    if (
        node.type === 'CallExpression' ||
        node.type === 'OptionalCallExpression'
    ) {
        const callee = unwrap(child(node, 'callee'));
        const method = dotName(callee);
        if (method === 'at' && callee !== null) {
            return isMockCalls(child(callee, 'object')) ? 1 : 0;
        }
        return method === 'toHaveBeenNthCalledWith' ||
            method === 'toHaveBeenNthReturnedWith'
            ? 1
            : 0;
    }
    // `const [[a]] = fn.mock.calls`: 구조 분해도 위치로 꺼낸다.
    if (node.type === 'VariableDeclarator') {
        return child(node, 'id')?.type === 'ArrayPattern' &&
            isMockCalls(child(node, 'init'))
            ? 1
            : 0;
    }
    return 0;
}

/** `if` 체인의 모든 가지가 `name = …` 한 문장뿐인가. */
function branchesOnlyAssign(node: AstNode | null, name: string): boolean {
    if (node === null) return true;
    if (node.type === 'IfStatement') {
        return (
            branchesOnlyAssign(child(node, 'consequent'), name) &&
            branchesOnlyAssign(child(node, 'alternate'), name)
        );
    }
    if (node.type === 'BlockStatement') {
        const body = children(node, 'body');
        const only = body[0];
        return body.length === 1 && only !== undefined
            ? branchesOnlyAssign(only, name)
            : false;
    }
    // `x *= 2` 같은 복합 대입은 새 값을 정의하는 대입이 아니라 갱신이라 세지 않는다(`=`만).
    const expression = child(node, 'expression');
    return (
        node.type === 'ExpressionStatement' &&
        expression !== null &&
        expression.operator === '=' &&
        assignsTo(expression, name)
    );
}

function countLetThenIf(node: AstNode): number {
    return countAdjacent(node, (first, second) => {
        if (first.type !== 'VariableDeclaration' || first.kind !== 'let') {
            return 0;
        }
        const declarators = children(first, 'declarations');
        const declarator = declarators[0];
        if (
            declarators.length !== 1 ||
            declarator === undefined ||
            child(declarator, 'init') === null
        ) {
            return 0;
        }
        const name = nameOf(child(declarator, 'id'));
        if (name === null || second.type !== 'IfStatement') return 0;
        // 가지가 하나도 `name`을 대입하지 않는 `if`(조건만 있고 빈 가지)는 걸리지 않는다.
        return branchesOnlyAssign(second, name) ? 1 : 0;
    });
}

function tryBlockAssigns(tryNode: AstNode, name: string): boolean {
    const block = child(tryNode, 'block');
    if (block === null) return false;
    return [...walk(block)].some(inner => assignsTo(inner, name));
}

function countLetThenTry(node: AstNode): number {
    return countAdjacent(node, (first, second) => {
        if (
            first.type !== 'VariableDeclaration' ||
            first.kind !== 'let' ||
            second.type !== 'TryStatement'
        ) {
            return 0;
        }
        return children(first, 'declarations').filter(declarator => {
            const name = nameOf(child(declarator, 'id'));
            return (
                name !== null &&
                child(declarator, 'init') === null &&
                tryBlockAssigns(second, name)
            );
        }).length;
    });
}

export const CODE_RULES: readonly CodeRule[] = [
    {
        key: 'non-null-assertion',
        docRef: 'CONVENTIONS.md#TS-1',
        mode: 'ratchet',
        fix: 'Bind the value and narrow it, or wrap it in defined() from src/shared/test-utils/defined.ts.',
        appliesTo: isTestFile,
        countAt: node => (node.type === 'TSNonNullExpression' ? 1 : 0),
    },
    {
        key: 'mock-call-index',
        docRef: 'TESTING.md#TE-27',
        mode: 'ratchet',
        fix: 'Find the call by a discriminating argument (mock.calls.find) or assert with toHaveBeenCalledWith.',
        appliesTo: isTestFile,
        countAt: countMockCallIndex,
    },
    {
        key: 'let-then-if',
        docRef: 'CONVENTIONS.md#CP-4',
        mode: 'zero',
        fix: 'Make it a const: a ternary or a small named function feeding the const.',
        appliesTo: () => true,
        countAt: countLetThenIf,
    },
    {
        key: 'let-then-try',
        docRef: 'CONVENTIONS.md#CP-4',
        mode: 'ratchet',
        fix: 'Make the guarded call a const (const x = await load().catch(() => null)).',
        appliesTo: () => true,
        countAt: countLetThenTry,
    },
];

// ------------------------------------------------------------------- scanning

interface Parsed {
    readonly ast: AstNode;
    readonly errors: number;
    readonly commentsAndStrings: readonly { start: number; end: number }[];
}

function pluginsFor(file: string): ('typescript' | 'jsx')[] {
    if (file.endsWith('.tsx')) return ['typescript', 'jsx'];
    return /\.[cm]?ts$/.test(file) ? ['typescript'] : ['jsx'];
}

function parseSource(file: string, text: string): Parsed {
    const result = parse(text, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: pluginsFor(file),
        attachComment: false,
    });
    const ranges = (result.comments ?? []).flatMap(({ start, end }) =>
        start === undefined || end === undefined ? [] : [{ start, end }]
    );
    return {
        // babel은 `File` 노드를 돌려주는데 구조적으로 AstNode와 같다.
        ast: result as unknown as AstNode,
        errors: (result.errors ?? []).length,
        commentsAndStrings: ranges,
    };
}

/** 파싱한 결과, 또는 파싱 실패 설명. babel은 복구 불가능한 오류를 던지고 복구 가능한 오류는 모아 둔다. */
function tryParse(source: SourceFile): Parsed | string {
    try {
        const parsed = parseSource(source.path, source.text);
        return parsed.errors > 0 ? `${parsed.errors} parse error(s)` : parsed;
    } catch (error) {
        return `parse error: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/** 주석과 문자열·템플릿 고정 부분을 같은 길이 공백으로 바꾼다(정규식 교차 검증용). */
function blankNonCode(text: string, parsed: Parsed): string {
    const strings = [...walk(parsed.ast)]
        .filter(
            node =>
                node.type === 'StringLiteral' || node.type === 'TemplateElement'
        )
        .flatMap(node =>
            typeof node.start === 'number' && typeof node.end === 'number'
                ? [{ start: node.start, end: node.end }]
                : []
        );
    return [...parsed.commentsAndStrings, ...strings]
        .toSorted((a, b) => b.start - a.start)
        .reduce(
            (out, { start, end }) =>
                out.slice(0, start) +
                out.slice(start, end).replace(/[^\n]/g, ' ') +
                out.slice(end),
            text
        );
}

const MOCK_INDEX_TEXT = /\.mock\.calls(?:\[|\.at\()/g;

function scanOne(
    source: SourceFile,
    allRules: readonly CodeRule[]
): {
    counts: ReadonlyMap<string, number>;
    problems: readonly string[];
} {
    const rules = allRules.filter(rule => rule.appliesTo(source.path));
    const parsed = tryParse(source);
    if (typeof parsed === 'string') {
        return { counts: new Map(), problems: [`${source.path}: ${parsed}`] };
    }
    // CONVENTIONS.md#CP-6 예외: 규칙 수 x 노드 수의 O(N) 합산이라 Map에 누적한다.
    const counts = new Map<string, number>();
    for (const node of walk(parsed.ast)) {
        for (const rule of rules) {
            const found = rule.countAt(node);
            if (found > 0) {
                counts.set(rule.key, (counts.get(rule.key) ?? 0) + found);
            }
        }
    }
    const mockRuleApplies = rules.some(rule => rule.key === 'mock-call-index');
    // 판정이 조용히 멈추는 것을 막는 교차 검증(TESTING.md#TE-63): 코드 텍스트에 `.mock.calls[`가
    // 보이는데 AST가 그만큼 못 셌다면 판정이 깨진 것이다.
    const textHits =
        mockRuleApplies && source.text.includes('.mock.calls')
            ? [...blankNonCode(source.text, parsed).matchAll(MOCK_INDEX_TEXT)]
                  .length
            : 0;
    const problems =
        textHits > (counts.get('mock-call-index') ?? 0)
            ? [
                  `${source.path}: mock-call-index counted ${counts.get('mock-call-index') ?? 0} but the source text has ${textHits} ".mock.calls[" / ".mock.calls.at(" occurrences`,
              ]
            : [];
    return { counts, problems };
}

/**
 * 주어진 소스들을 스캔한다. 디스크를 읽지 않으므로 심은 위반 테스트에 쓴다.
 * `rules`는 판정이 깨진 엔진을 흉내 내는 테스트에서만 바꾼다.
 */
export function scanSources(
    sources: readonly SourceFile[],
    rules: readonly CodeRule[] = CODE_RULES
): ScanResult {
    const scans = sources.map(source => ({
        path: source.path,
        ...scanOne(source, rules),
    }));
    const keys = rules.map(rule => rule.key);
    const counts = Object.fromEntries(
        keys.map(key => [
            key,
            Object.fromEntries(
                scans
                    .map(
                        scan => [scan.path, scan.counts.get(key) ?? 0] as const
                    )
                    .filter(([, count]) => count > 0)
            ),
        ])
    );
    return {
        counts,
        scanned: sources.length,
        paths: sources.map(source => source.path),
        problems: scans.flatMap(scan => scan.problems),
    };
}

/** 검사 대상 파일 경로. 추적 파일과 아직 추가 안 된 새 파일을 보고, 무시된 스크래치는 뺀다. */
export function listCodeFiles(root: string): string[] {
    const listed = execFileSync(
        'git',
        [
            'ls-files',
            '--cached',
            '--others',
            '--exclude-standard',
            '--',
            ...SCAN_ROOTS,
        ],
        { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
        .split('\n')
        .filter(Boolean);
    return [...new Set(listed)]
        .filter(isCodeFile)
        .filter(file => existsSync(path.join(root, file)))
        .toSorted();
}

/** 파일 열거가 깨져 거의 아무것도 스캔하지 못했다면 문제로 덧붙인다(공허한 통과 방지). */
export function checkScanFloor(result: ScanResult): ScanResult {
    return result.scanned >= MIN_SCANNED_FILES
        ? result
        : {
              ...result,
              problems: [
                  ...result.problems,
                  `only ${result.scanned} files were scanned (expected at least ${MIN_SCANNED_FILES}); the file listing is broken`,
              ],
          };
}

export function scanRepo(root: string): ScanResult {
    return checkScanFloor(
        scanSources(
            listCodeFiles(root).map(file => ({
                path: file,
                text: readFileSync(path.join(root, file), 'utf8'),
            }))
        )
    );
}
