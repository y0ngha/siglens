import { parse } from '@babel/parser';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

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
    countAt?(node: AstNode): number;
    /**
     * 파일 전체를 보고 찾은 위반 수. 조상·범위·주석이 필요한 규칙이 쓴다. 코드가 아닌 텍스트 파일
     * (`.sh`·`.css`)에서는 `ctx.ast`가 `null`이고 `countFile`을 가진 규칙만 돈다.
     */
    countFile?(ctx: FileContext): number;
}

export interface CommentRange {
    readonly start: number;
    readonly end: number;
    /** `//`·`/*`를 뺀 본문. */
    readonly value: string;
}

export interface FileContext {
    readonly path: string;
    readonly text: string;
    /** 코드 파일의 babel `File` 노드. 텍스트 파일은 `null`. */
    readonly ast: AstNode | null;
    readonly commentRanges: readonly CommentRange[];
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
/** AST가 없는 텍스트 파일. 문서 인용 규칙만 전체 본문을 본다. */
const TEXT_FILE = /\.(?:sh|css|scss|ya?ml)$/;
const SCAN_ROOTS = ['src', 'e2e', 'scripts', 'cache-handler', 'db', 'infra'];

/**
 * 엔진이 이보다 적게 스캔했다면 파일 열거가 깨진 것이다(공허한 통과 방지).
 * 2026-11-22에 재 보니 스캔한 파일이 6,400여 개였다. 코드 파일 수가 5,000 아래로 내려가면
 * 열거가 아니라 이 숫자가 낡은 것이니 다시 재서 고친다.
 */
export const MIN_SCANNED_FILES = 5000;

export function isCodeFile(file: string): boolean {
    return CODE_FILE.test(file) && !file.endsWith('.d.ts');
}

export function isTextFile(file: string): boolean {
    return TEXT_FILE.test(file);
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
 * 순회: 모든 노드를 깊이 우선으로 돌려준다(뿌리부터, 마지막 자식 쪽을 먼저).
 *
 * 마지막으로 훑은 파일 뿌리(`File` 노드)의 결과 하나만 기억한다. 한 파일의 AST를 스캔 루프와 파일 단위
 * 규칙(문서 인용·SQL 단언·교차 검증)이 각자 다시 훑던 것을 한 번으로 줄인다. 파일은 하나씩 스캔하므로
 * 한 칸이면 충분하고, 노드마다 기억하는 `WeakMap`은 GC 부담이 순회 절약보다 크다. 하위 트리는 기억하지
 * 않는다. 돌려준 배열은 공유되므로 고치지 않는다.
 *
 * CONVENTIONS.md#CP-6 예외: 6천여 파일의 AST를 한 번씩 훑는 O(N) 핫 루프다. 노드마다 새 배열을
 * 만드는 재귀 flatMap이나 `Object.entries`의 키·값 쌍은 이 가드의 실행 시간을 몇 배로 늘려
 * pre-commit에 둘 수 없게 만든다.
 */
const lastFileWalk: { root: AstNode | null; nodes: readonly AstNode[] } = {
    root: null,
    nodes: [],
};

function walk(root: AstNode): readonly AstNode[] {
    if (lastFileWalk.root === root) return lastFileWalk.nodes;
    const out: AstNode[] = [];
    const stack: AstNode[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (node === undefined) break;
        out.push(node);
        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'extra' || key === 'comments') {
                continue;
            }
            const value = node[key];
            if (typeof value !== 'object' || value === null) continue;
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (isNode(item)) stack.push(item);
                }
            } else if (isNode(value)) {
                stack.push(value);
            }
        }
    }
    if (root.type === 'File') {
        lastFileWalk.root = root;
        lastFileWalk.nodes = out;
    }
    return out;
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
    return walk(block).some(inner => assignsTo(inner, name));
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

// ------------------------------------------------- scope-aware and text rules

const FUNCTION_TYPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ObjectMethod',
    'ClassMethod',
    'ClassPrivateMethod',
]);

const LOOP_TYPES = new Set([
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
    'WhileStatement',
    'DoWhileStatement',
]);

/** 문장·멤버 목록을 가진 노드. 이 노드의 직계 자식이 "문장 단위"다(주석이 붙는 자리). */
const MEMBER_CONTAINERS = new Set([
    'Program',
    'BlockStatement',
    'ClassBody',
    'ObjectExpression',
    'TSModuleBlock',
    'StaticBlock',
]);

/** 모든 자식 노드를 소스 순서로. `walk`와 달리 순서가 필요한 스코프 규칙이 쓴다. */
function childNodes(node: AstNode): readonly AstNode[] {
    return Object.entries(node)
        .filter(
            ([key]) => key !== 'loc' && key !== 'extra' && key !== 'comments'
        )
        .flatMap(([, value]) => [value].flat().filter(isNode))
        .toSorted((a, b) => (a.start ?? 0) - (b.start ?? 0));
}

function isCall(node: AstNode): boolean {
    return (
        node.type === 'CallExpression' || node.type === 'OptionalCallExpression'
    );
}

/** 멤버 체인의 뿌리 식별자 이름(`a.b.c` -> `a`). `this`·호출 결과 등이면 `null`. */
function rootName(node: AstNode | null): string | null {
    const target = unwrap(node);
    return isMember(target)
        ? rootName(child(target, 'object'))
        : nameOf(target);
}

interface Binding {
    readonly name: string;
    /** `new Map()`·`new Set()`으로 만든 값인가. */
    readonly collection: boolean;
    /** 선언이 함수 안의 몇 겹 반복문 안에 있는가. */
    readonly loopDepth: number;
    /** 선언을 담은 문장의 시작 위치. 그 문장 위 주석을 예외 표시로 인정한다. */
    readonly statementStart: number;
}

function isCollectionInit(init: AstNode | null): boolean {
    const target = unwrap(init);
    if (target === null || target.type !== 'NewExpression') return false;
    const name = nameOf(child(target, 'callee'));
    return name === 'Map' || name === 'Set';
}

/** 함수 본문에서 선언된 지역 이름. 안쪽 함수는 들어가지 않는다. */
function bindingsIn(
    node: AstNode,
    loopDepth: number,
    root: boolean,
    statementStart: number
): readonly Binding[] {
    if (!root && FUNCTION_TYPES.has(node.type)) return [];
    if (node.type === 'VariableDeclarator') {
        const name = nameOf(child(node, 'id'));
        return name === null
            ? []
            : [
                  {
                      name,
                      collection: isCollectionInit(child(node, 'init')),
                      loopDepth,
                      statementStart,
                  },
              ];
    }
    const depth = LOOP_TYPES.has(node.type) ? loopDepth + 1 : loopDepth;
    return childNodes(node).flatMap(inner =>
        bindingsIn(
            inner,
            depth,
            false,
            MEMBER_CONTAINERS.has(node.type)
                ? (inner.start ?? statementStart)
                : statementStart
        )
    );
}

interface Frame {
    readonly node: AstNode;
    readonly bindings: readonly Binding[];
    /** `items.forEach(cb)`의 `cb`인가: 본문 전체가 반복이다. */
    readonly callbackLoop: boolean;
    /** 이 함수가 만들어진 자리의 바깥 함수 안 반복 깊이. */
    readonly enteredLoopDepth: number;
}

function isForEachCallback(fn: AstNode, parent: AstNode | null): boolean {
    if (parent === null || !isCall(parent)) return false;
    return (
        dotName(unwrap(child(parent, 'callee'))) === 'forEach' &&
        children(parent, 'arguments').includes(fn)
    );
}

const COLLECTION_WRITES = new Set(['push', 'set', 'add']);

/**
 * 호출 `x.push(...)`·`m.set(...)`·`s.add(...)`가 선언 이후 반복 안에서 도는 지역 누적이면
 * 그 누적기의 선언 정보를, 아니면 `null`.
 */
function localAccumulator(
    call: AstNode,
    frames: readonly Frame[],
    loopDepth: number
): Binding | null {
    const callee = unwrap(child(call, 'callee'));
    const method = dotName(callee);
    if (callee === null || method === null || !COLLECTION_WRITES.has(method)) {
        return null;
    }
    const target = child(callee, 'object');
    const name = method === 'push' ? rootName(target) : nameOf(unwrap(target));
    if (name === null) return null;
    const declaredIn = frames.findLastIndex(frame =>
        frame.bindings.some(binding => binding.name === name)
    );
    const binding = frames[declaredIn]?.bindings.find(b => b.name === name);
    if (binding === undefined) return null;
    if (method !== 'push' && !binding.collection) return null;
    const accumulating =
        declaredIn === frames.length - 1
            ? loopDepth > binding.loopDepth
            : loopDepth > 0 ||
              frames
                  .slice(declaredIn + 1)
                  .some(
                      (frame, offset) =>
                          frame.callbackLoop ||
                          frame.enteredLoopDepth >
                              (offset === 0 ? binding.loopDepth : 0)
                  );
    return accumulating ? binding : null;
}

/** `start` 바로 위에 이어 붙은 주석들(사이에 공백만 있는 것). */
function leadingComments(
    ctx: FileContext,
    start: number
): readonly CommentRange[] {
    const previous = ctx.commentRanges.find(
        comment =>
            comment.end <= start &&
            ctx.text.slice(comment.end, start).trim() === ''
    );
    return previous === undefined
        ? []
        : [previous, ...leadingComments(ctx, previous.start)];
}

const CP6_MARKER = 'CONVENTIONS.md#CP-6';

/** 이유가 말하는 비용: `O(N²)`, "복사", "할당", copy, allocation, "per ..." 같은 토큰이 하나는 있어야 한다. */
const COST_TOKEN = /O\(|복사|할당|\bcop(?:y|ies)\b|\balloc|\bper\b/i;

/** 마커 뒤에 비용을 밝힌 이유가 붙어 있는가("예외:"만 쓰거나 비용 없는 변명이면 아니다). */
function hasCp6Reason(comment: CommentRange): boolean {
    const at = comment.value.indexOf(CP6_MARKER);
    if (at < 0) return false;
    const rest = comment.value.slice(at + CP6_MARKER.length);
    return (
        rest.replace(/예외|[\s*:()\-—.,]/g, '').length >= 8 &&
        COST_TOKEN.test(rest)
    );
}

/**
 * 이 호출을 감싼 문장·함수 위, 누적기 선언 문장 위, 또는 함수 본문 첫머리에 CP-6 예외 주석이
 * 있는가.
 */
function isCp6Annotated(
    ctx: FileContext,
    trail: readonly AstNode[],
    frames: readonly Frame[],
    binding: Binding
): boolean {
    const anchors = trail.flatMap((node, index) => {
        const parent = trail[index - 1];
        return parent !== undefined &&
            MEMBER_CONTAINERS.has(parent.type) &&
            typeof node.start === 'number'
            ? [node.start]
            : [];
    });
    const leading = [...anchors, binding.statementStart].flatMap(start =>
        leadingComments(ctx, start)
    );
    const opening = frames.flatMap(frame => {
        const body = child(frame.node, 'body');
        if (body === null || body.type !== 'BlockStatement') return [];
        const bodyStart = body.start ?? 0;
        const first = children(body, 'body')[0]?.start ?? body.end ?? bodyStart;
        return ctx.commentRanges.filter(
            comment => comment.start >= bodyStart && comment.end <= first
        );
    });
    return [...leading, ...opening].some(hasCp6Reason);
}

function collectAccumulations(
    ctx: FileContext,
    node: AstNode,
    parent: AstNode | null,
    trail: readonly AstNode[],
    frames: readonly Frame[],
    loopDepth: number
): readonly AstNode[] {
    const isFunction = FUNCTION_TYPES.has(node.type);
    const here = isFunction
        ? [
              ...frames,
              {
                  node,
                  bindings: bindingsIn(node, 0, true, node.start ?? 0),
                  callbackLoop: isForEachCallback(node, parent),
                  enteredLoopDepth: loopDepth,
              },
          ]
        : frames;
    const depth = nextLoopDepth(node, isFunction, loopDepth);
    const next = [...trail, node];
    const accumulator = isCall(node)
        ? localAccumulator(node, here, depth)
        : null;
    const own =
        accumulator !== null && !isCp6Annotated(ctx, next, here, accumulator)
            ? [node]
            : [];
    return [
        ...own,
        ...childNodes(node).flatMap(inner =>
            collectAccumulations(ctx, inner, node, next, here, depth)
        ),
    ];
}

/** 반복 안에서 지역 `push`·`Map#set`·`Set#add`로 쌓는 호출 중 CP-6 예외 주석이 없는 것. */
export function findAccumulatorsInLoop(ctx: FileContext): readonly AstNode[] {
    return ctx.ast === null || !/\.(?:push|set|add)\(/.test(ctx.text)
        ? []
        : collectAccumulations(ctx, ctx.ast, null, [], [], 0);
}

const PURE_LOGIC_DIR = /^src\/(?:shared\/lib\/|entities\/[^/]+\/lib\/)/;

const FUNCTIONAL_METHODS = new Set([
    'map',
    'filter',
    'reduce',
    'reduceRight',
    'flatMap',
]);

function isFunctionalCallback(fn: AstNode, parent: AstNode | null): boolean {
    if (parent === null || !isCall(parent)) return false;
    if (!children(parent, 'arguments').includes(fn)) return false;
    const callee = unwrap(child(parent, 'callee'));
    const method = dotName(callee) ?? nameOf(callee);
    return (
        method !== null &&
        (FUNCTIONAL_METHODS.has(method) || method === 'useMemo')
    );
}

function collectPushInCallback(
    node: AstNode,
    parent: AstNode | null,
    inCallback: boolean
): readonly AstNode[] {
    const inside =
        inCallback ||
        (FUNCTION_TYPES.has(node.type) && isFunctionalCallback(node, parent));
    const own =
        inside &&
        isCall(node) &&
        dotName(unwrap(child(node, 'callee'))) === 'push'
            ? [node]
            : [];
    return [
        ...own,
        ...childNodes(node).flatMap(inner =>
            collectPushInCallback(inner, node, inside)
        ),
    ];
}

/** `map`·`filter`·`reduce`·`flatMap` 콜백이나 `useMemo` 팩토리 안의 `push`. */
export function findPushInFunctionalCallback(
    ctx: FileContext
): readonly AstNode[] {
    return ctx.ast === null || !ctx.text.includes('.push(')
        ? []
        : collectPushInCallback(ctx.ast, null, false);
}

const REACT_FILE = /(?:\.tsx|(?:^|\/)use[A-Z][^/]*\.ts)$/;

const LOGICAL_ASSIGNMENT = new Set(['??=', '||=', '&&=']);

/** 로컬 전용 문서를 가리키는 경로. 앞이 `/`·`.`·`-`·단어 문자면 URL·상대 경로라 제외한다. */
const LOCAL_DOC = /(?<![\w./-])docs\/(?!(?:product|conventions)\b)\w/g;

function countLocalDocs(text: string): number {
    // 정규식은 `docs/`를 그대로 담으므로 그 글자가 없으면 볼 것도 없다(문자열 노드 수천 개의 matchAll을 건너뛴다).
    return text.includes('docs/') ? [...text.matchAll(LOCAL_DOC)].length : 0;
}

function stringValueOf(node: AstNode): string | null {
    if (
        (node.type === 'StringLiteral' || node.type === 'JSXText') &&
        typeof node.value === 'string'
    ) {
        return node.value;
    }
    const raw =
        node.type === 'TemplateElement' && typeof node.value === 'object'
            ? Reflect.get(node.value ?? {}, 'raw')
            : null;
    return typeof raw === 'string' ? raw : null;
}

/**
 * 주석과(프로덕션 파일은) 문자열·템플릿에 적힌 로컬 문서 인용 수.
 * 테스트 파일의 문자열은 심은 소스·메시지 픽스처이므로 세지 않고 주석만 본다.
 * 텍스트 파일(`.sh`·`.css`)은 본문 전체를 본다.
 */
function countLocalDocCitations(ctx: FileContext): number {
    if (ctx.ast === null) return countLocalDocs(ctx.text);
    const comments = ctx.commentRanges.reduce(
        (sum, comment) => sum + countLocalDocs(comment.value),
        0
    );
    const literals = isTestFile(ctx.path)
        ? 0
        : walk(ctx.ast).reduce((sum, node) => {
              const value = stringValueOf(node);
              return value === null ? sum : sum + countLocalDocs(value);
          }, 0);
    return comments + literals;
}

/** 사유(`--`)를 달아 억제 주석을 허용하는 파일. 늘리려면 이 목록을 고치는 PR에서 사유를 설명한다. */
export const ALLOWED_LINT_DISABLE_FILES: readonly string[] = [
    'src/app/global-error.tsx',
    'src/app/not-found.tsx',
];

/** 주석 본문이 억제 지시어로 시작하는가(`eslint-` 또는 `oxlint-` 다음 `disable`). */
const LINT_DISABLE = /^\s*(?:eslint|oxlint)-disable/;

function countLintDisables(ctx: FileContext): number {
    const allowed = ALLOWED_LINT_DISABLE_FILES.includes(ctx.path);
    return ctx.commentRanges.filter(
        comment =>
            LINT_DISABLE.test(comment.value) &&
            // 허용 파일이어도 첫 줄에 `--` 사유가 있어야 한다.
            !(allowed && (comment.value.split('\n')[0] ?? '').includes('--'))
    ).length;
}

/**
 * 주석에 적힌 이슈·PR 번호(`#` 뒤 숫자) 판정(CONVENTIONS.md#CM-11).
 *
 * 주석(줄·블록·JSDoc)만 본다. 문자열·템플릿·JSX 텍스트는 AST 노드가 달라 처음부터 제외된다. 기준선 없이 위반 0을 요구한다(예외 없음, 외부 식별자도 서술로 바꾼다).
 * `#` 뒤 숫자가 3자리 이상이고 바로 뒤에 단어 문자가 없으면 참조다. 제외:
 * - URL 안(`.../pull/<번호>`, URL 끝 앵커): 판정 전에 URL을 공백으로 지운다.
 * - `&#123;` 같은 HTML 엔티티, `/#123`, `##123`: `#` 앞이 `&`·`/`·`#`인 경우.
 * - `#818cf8` 같은 16진 색: 숫자 뒤에 글자가 붙으므로 걸리지 않는다.
 * - `#000`·`#111111`처럼 한 숫자만 반복한 색(숫자만으로 된 색의 흔한 꼴).
 * - `#418`: React 하이드레이션 오류 코드이지 이슈 번호가 아니다. 같은 주석에 `React`·`hydration`·`하이드레이션`이
 *   있을 때만 건너뛴다(`REACT_ERROR_CODES`); 맥락 없는 `#418`은 참조로 센다.
 *
 * 한계: `#12`처럼 두 자리 이하와 `PR 1234`·`issue 1234`처럼 `#` 없는 서술은 보지 않는다.
 * 한 숫자 반복이 아닌 숫자만의 색(`#` 뒤 여섯 자리 등)은 참조로 잘못 센다(`fix` 문구가 대안을 안내한다).
 * 같은 숫자를 반복한 이슈 번호는 색과 구별할 수 없어 놓친다.
 */
const ISSUE_REF = /(?<![&/#])#(\d{3,})(?!\w)/g;
const URL_IN_COMMENT = /https?:\/\/\S+/g;
const REACT_ERROR_CODES: ReadonlySet<string> = new Set(['418']);

const REACT_CONTEXT = /React|hydration|하이드레이션/i;

function isIssueRefToken(digits: string, comment: string): boolean {
    if (/^(\d)\1+$/.test(digits)) return false;
    return !(REACT_ERROR_CODES.has(digits) && REACT_CONTEXT.test(comment));
}

/** 주석에서 찾은 이슈·PR 번호 참조의 1부터 시작하는 줄 번호. */
export function findIssueRefLines(ctx: FileContext): readonly number[] {
    return ctx.commentRanges.flatMap(comment => {
        const body = comment.value.replace(URL_IN_COMMENT, url =>
            ' '.repeat(url.length)
        );
        return [...body.matchAll(ISSUE_REF)]
            .filter(match => isIssueRefToken(match[1] ?? '', comment.value))
            .map(match => {
                const offset = comment.start + 2 + (match.index ?? 0);
                return ctx.text.slice(0, offset).split('\n').length;
            });
    });
}

/** 심은 소스 하나의 이슈·PR 번호 참조 줄 번호. 가드 실패 메시지가 파일:줄을 붙이는 데 쓴다. */
export function issueRefLinesOf(file: string, text: string): readonly number[] {
    const parsed = tryParse({ path: file, text });
    return typeof parsed === 'string'
        ? []
        : findIssueRefLines({
              path: file,
              text,
              ast: parsed.ast,
              commentRanges: parsed.commentRanges,
          });
}

// ------------------------------------------------------------ imports-contiguous

/** `vi.mock(...)`·`vi.unmock(...)` 문장. 둘 다 Vitest가 import 위로 끌어올린다. */
function isHoistedViCall(statement: AstNode): boolean {
    const call =
        statement.type === 'ExpressionStatement'
            ? child(statement, 'expression')
            : null;
    const callee = call === null ? null : child(call, 'callee');
    const method = dotName(callee);
    return (
        call?.type === 'CallExpression' &&
        nameOf(child(callee ?? call, 'object')) === 'vi' &&
        (method === 'mock' || method === 'unmock')
    );
}

/** `const x = vi.hoisted(...)`·`vi.hoisted(...)` 선언. */
function isViHoisted(statement: AstNode): boolean {
    const declarator = children(statement, 'declarations')[0];
    const expression = child(statement, 'expression');
    const init =
        declarator === undefined ? expression : child(declarator, 'init');
    const callee =
        init?.type === 'CallExpression' ? child(init, 'callee') : null;
    return (
        dotName(callee) === 'hoisted' &&
        nameOf(child(callee ?? statement, 'object')) === 'vi'
    );
}

/**
 * 마지막 import보다 앞에 놓인 import 아닌 최상위 문장 수. 첫 import 위에 모은 `vi.mock`·`vi.unmock`·
 * `vi.hoisted`는 Vitest가 원래 거기서 실행하므로 허용한다. 지시어(`'use client'`)는 `directives`라 문장이 아니다.
 */
export function findStatementsBetweenImports(
    ctx: FileContext
): readonly AstNode[] {
    const program = ctx.ast === null ? null : child(ctx.ast, 'program');
    const body = program === null ? [] : children(program, 'body');
    const imports = body.flatMap((statement, index) =>
        statement.type === 'ImportDeclaration' ? [index] : []
    );
    const first = imports[0];
    const last = imports[imports.length - 1];
    if (first === undefined || last === undefined) return [];
    return body.filter(
        (statement, index) =>
            index < last &&
            statement.type !== 'ImportDeclaration' &&
            !(
                index < first &&
                (isHoistedViCall(statement) || isViHoisted(statement))
            )
    );
}

// ------------------------------------------------------- jsdoc-detached-by-comment

/**
 * 지시 주석(`oxlint-disable`·`eslint-disable`·`@ts-expect-error`·`@ts-ignore`·`react-doctor-disable`)은
 * 선언 바로 위줄에 붙어야 동작하므로 JSDoc과 선언 사이에 있어도 위반이 아니다.
 */
const DIRECTIVE_COMMENT =
    /^\s*(?:oxlint-disable|eslint-disable|@ts-expect-error|@ts-ignore|react-doctor-disable)/;

/**
 * JSDoc이 설명할 수 있는 선언의 시작. 파일 머리 JSDoc 뒤에 `vi.mock(...)`·`import` 같은 문장에
 * 붙는 주석이 이어지는 것은 JSDoc이 선언에서 떨어진 것이 아니라 파일 설명이므로 세지 않는다.
 * 키워드로 시작하는 선언만 본다: 키워드 없는 클래스 메서드(`foo() {}`)와 인터페이스·객체 속성은
 * 보이지 않는다. `get`·`set`은 뒤에 이름이 올 때만(호출 `get(x)`는 제외), `default`는 `export default`
 * 로만, `type`은 뒤에 이름이 올 때만(속성 `type: 'x'`는 제외) 선언이다.
 */
const DECLARATION_START =
    /^\s*(?:(?:export|declare|abstract|async|function|class|interface|enum|namespace|const|let|var|public|private|protected|static|readonly)\b|type\s+[\w$]|(?:get|set)\s+[\w#$[])/;

/** `from`번째 주석부터 공백만 사이에 둔 채 이어지는 주석 묶음의 마지막 인덱스. */
function lastOfCommentRun(ctx: FileContext, from: number): number {
    const current = ctx.commentRanges[from];
    const following = ctx.commentRanges[from + 1];
    return current !== undefined &&
        following !== undefined &&
        ctx.text.slice(current.end, following.start).trim() === ''
        ? lastOfCommentRun(ctx, from + 1)
        : from;
}

/**
 * **JSDoc 분리**(CONVENTIONS.md#CM-4). JSDoc 바로 뒤에(공백·줄바꿈만 건너뛰고) 지시가 아닌 `//` 줄
 * 주석이나 JSDoc이 아닌 블록 주석이 오고, 그 주석 묶음 다음 코드가 선언이면 그 JSDoc이 선언에서
 * 떨어진 것이다. 주석 범위는 파서가 주므로 문자열·템플릿 안의 JSDoc 모양 텍스트는 보이지 않는다.
 * 닫는 기호와 같은 줄에 붙은 후행 주석은 선언을 가르지 않으므로 건너뛴다. 묶음에 다른 JSDoc이
 * 있으면 그 JSDoc이 선언을 설명하는 것이라 세지 않는다. 키워드 없는 선언(클래스 메서드 `foo() {}`,
 * 인터페이스·객체 속성)은 선언으로 보지 않아 세지 않는다. JSDoc 하나당 최대 1건이다.
 */
export function findDetachedJsdocLines(ctx: FileContext): readonly number[] {
    const isJsdoc = (comment: CommentRange): boolean =>
        comment.value.startsWith('*') && comment.value !== '*';
    return ctx.commentRanges.flatMap((comment, index) => {
        const next = ctx.commentRanges[index + 1];
        if (!isJsdoc(comment) || next === undefined) return [];
        const gap = ctx.text.slice(comment.end, next.start);
        if (gap.trim() !== '' || !gap.includes('\n')) return [];
        if (next.value.startsWith('*') || DIRECTIVE_COMMENT.test(next.value))
            return [];
        const runEnd = lastOfCommentRun(ctx, index + 1);
        const run = ctx.commentRanges.slice(index + 1, runEnd + 1);
        const last = ctx.commentRanges[runEnd] ?? next;
        return run.some(isJsdoc) ||
            !DECLARATION_START.test(ctx.text.slice(last.end, last.end + 80))
            ? []
            : [ctx.text.slice(0, next.start).split('\n').length];
    });
}

/** 심은 소스 하나의 JSDoc 분리 줄 번호(분리한 주석의 줄). */
export function detachedJsdocLinesOf(
    file: string,
    text: string
): readonly number[] {
    const parsed = tryParse({ path: file, text });
    return typeof parsed === 'string'
        ? []
        : findDetachedJsdocLines({
              path: file,
              text,
              ast: parsed.ast,
              commentRanges: parsed.commentRanges,
          });
}

// ---------------------------------------------------- sql-substring-assertion

/**
 * **렌더된 SQL 부분 문자열 단언**(TESTING.md#TE-53). 렌더된 SQL 텍스트에 `toContain`·`toMatch`·
 * `toHaveLength`·`toBeTruthy`·`not.toBe('')`·`expect.stringContaining`을 쓰거나, `.includes()`·
 * `.match()`·`/re/.test()`로 일부만 확인한 결과를 단언하면 위반이다. 조건을 뒤집어도
 * (`is null`↔`is not null`, `or`↔`and`, 인자 순서) 통과하기 때문이다. 전체 문자열 `toBe`·`toEqual`만 허용한다.
 *
 * SQL 텍스트로 보는 식:
 * - `renderSql(...)`(또는 그것을 부르는 같은 파일의 도우미)가 돌려준 값의 `.sql`·`.text`
 * - 임의 객체의 `.sql`(`captured[0].sql`, `toSQL().sql`)
 * - 위 식으로 묶인 변수, 구조 분해(`{ sql }`·`{ sql: s }`·`{ text }`)로 꺼낸 변수
 * - 그 식에 `replace`·`toLowerCase`·`trim`·`split`·`match` 같은 문자열 메서드를 건 결과, `?? ''`, `String(...)`,
 *   템플릿 리터럴·`+` 이어 붙임, `split(..)[i]`
 * - SQL 텍스트의 목록(`[a.sql, b.sql]`, `xs.map(x => renderSql(x).sql)`)을 `.join(..)`한 결과와 그 요소(`find`·`at`·`[i]`)
 * - 길이·개수(`sql.length`, `sql.split(..).length`), `toSatisfy`, 속성으로 숨긴 부분 확인
 *   (`toMatchObject({ sql: /re/ })`, `objectContaining({ sql: expect.stringContaining(..) })`), 목록 콜백 검사
 *   (`list.some(s => s.includes(..))`, `.every`·`.filter`·`.findIndex`)도 부분 확인이다.
 * - `toMatchInlineSnapshot`·`toMatchSnapshot`은 전체 문자열을 못 박는 단언이므로 허용한다.
 *
 * 예외: 부재 확인(`.not.toContain`·`.not.toMatch`, `.includes()`를 `toBe(false)`로)만, 같은 문장이나 바로
 * 윗줄에 `// sql-absence: <사유>`를 달면 허용한다. 사유가 비어 있거나 글자·숫자가 없으면 예외가 아니다.
 * 예외는 그 문장 하나에만 적용되고 `sqlAbsenceExemptionsOf`가 목록을 내보내 가드가 출력한다.
 *
 * 한계: 파일 경계를 넘는 도우미(다른 파일이 반환한 SQL 문자열), `readFileSync`로 읽은 마이그레이션
 * SQL 텍스트, `Array.from`·`Object.values`·`reduce`·`for..of`로 만든 목록, 배열 구조 분해(`const [a] = list`)는 SQL 텍스트로
 * 알아보지 못한다. 변수 추적은 파일 안에서 이름 기준이라 같은 이름을 다른
 * 뜻으로 재사용하면 과하게 잡을 수 있다(그때는 이름을 바꾼다).
 */
const SQL_PROPS = new Set(['sql', 'text']);
const SQL_STRING_METHODS = new Set([
    'replace',
    'replaceAll',
    'toLowerCase',
    'toUpperCase',
    'trim',
    'trimStart',
    'trimEnd',
    'normalize',
    'slice',
    'substring',
    // 일치한 조각의 배열이라 개수(`toHaveLength`)만 보면 부분 확인이다.
    'match',
    'matchAll',
    'split',
]);
/** 목록에서 한 요소(또는 그 부분)를 꺼내는 메서드: 결과도 SQL 텍스트다. */
const SQL_LIST_PICKERS = new Set(['find', 'findLast', 'at', 'pop', 'shift']);
/** 목록의 요소마다 콜백을 부르는 메서드: 콜백 매개변수가 SQL 텍스트다. */
const SQL_LIST_CALLBACKS = new Set([
    'some',
    'every',
    'find',
    'findLast',
    'findIndex',
    'filter',
    'forEach',
    'map',
    'flatMap',
    'reduce',
]);
const SQL_LIST_KEEPERS = new Set([
    'filter',
    'slice',
    'toSorted',
    'toReversed',
    'concat',
    'flat',
]);
const SQL_PROBE_METHODS = new Set([
    'includes',
    'startsWith',
    'endsWith',
    'search',
    'indexOf',
]);
const SQL_PARTIAL_MATCHERS = new Set([
    'toContain',
    'toMatch',
    'toHaveLength',
    'toBeTruthy',
    'toSatisfy',
]);
const SQL_EQUALITY_MATCHERS = new Set(['toBe', 'toEqual', 'toStrictEqual']);
const SQL_ABSENCE_REASON = /^\s*sql-absence:\s*(\S[\s\S]*)$/;
const SQL_ABSENCE_WORD = /[\p{L}\p{N}]{2,}/u;

export interface SqlSubstringFinding {
    readonly line: number;
    /** 사유가 있는 `// sql-absence:` 예외로 덮인 부재 확인인가. 덮였으면 위반이 아니다. */
    readonly exempt: boolean;
    readonly reason: string | null;
}

/** 별칭·도우미 사슬 추적의 반복 상한. 실제 파일은 3겹 안에서 끝난다. */
const MAX_TRACKING_PASSES = 50;

function lineAt(text: string, offset: number): number {
    return text.slice(0, offset).split('\n').length;
}

function isFunctionNode(node: AstNode | null): node is AstNode {
    return (
        node !== null &&
        (node.type === 'ArrowFunctionExpression' ||
            node.type === 'FunctionExpression')
    );
}

function patternName(node: AstNode | null): string | null {
    return node?.type === 'AssignmentPattern'
        ? nameOf(child(node, 'left'))
        : nameOf(node);
}

function isStringLiteralOf(node: AstNode | null, value: string): boolean {
    return (
        node !== null &&
        ((node.type === 'StringLiteral' && node.value === value) ||
            (node.type === 'TemplateLiteral' &&
                children(node, 'expressions').length === 0 &&
                children(node, 'quasis').every(
                    quasi =>
                        typeof quasi.value === 'object' &&
                        Reflect.get(quasi.value ?? {}, 'cooked') === value
                )))
    );
}

/** 이 파일의 SQL 렌더·SQL 텍스트 식을 알아보는 판정기. */
function createSqlTextModel(ast: AstNode) {
    const nodes = walk(ast);
    const renderFns = new Set(['renderSql']);
    const renderedNames = new Set<string>();
    const sqlNames = new Set<string>();
    const sqlListNames = new Set<string>();
    const localFunctions = new Set<string>();

    // 도우미 본문은 추적 패스마다 다시 보므로 본문의 노드 목록을 이 모델 안에서만 기억한다.
    const bodyNodes = new Map<AstNode, readonly AstNode[]>();
    const nodesOfBody = (root: AstNode): readonly AstNode[] => {
        const cached = bodyNodes.get(root);
        if (cached !== undefined) return cached;
        const listed = walk(root);
        bodyNodes.set(root, listed);
        return listed;
    };
    const callsRender = (root: AstNode): boolean =>
        nodesOfBody(root).some(
            inner =>
                (inner.type === 'CallExpression' &&
                    renderFns.has(nameOf(child(inner, 'callee')) ?? '')) ||
                (isMember(inner) &&
                    ['sqlToQuery', 'toSQL'].includes(dotName(inner) ?? ''))
        );

    const isRendered = (expr: AstNode | null): boolean => {
        const node = unwrap(expr);
        if (node === null) return false;
        if (node.type === 'AwaitExpression') {
            return isRendered(child(node, 'argument'));
        }
        if (node.type === 'Identifier') {
            return renderedNames.has(nameOf(node) ?? '');
        }
        return (
            (node.type === 'CallExpression' ||
                node.type === 'OptionalCallExpression') &&
            renderFns.has(nameOf(child(node, 'callee')) ?? '')
        );
    };

    /** 콜백(화살표·함수식)이 돌려주는 식들. */
    const returnedExprs = (fn: AstNode | null): readonly AstNode[] => {
        const body = fn === null ? null : child(fn, 'body');
        if (body === null) return [];
        return body.type === 'BlockStatement'
            ? walk(body).flatMap(inner => {
                  const argument =
                      inner.type === 'ReturnStatement'
                          ? child(inner, 'argument')
                          : null;
                  return argument === null ? [] : [argument];
              })
            : [body];
    };

    /** SQL 텍스트의 목록: `[a.sql, b.sql]`, `xs.map(x => render(x).sql)`, 거기에 filter·slice 등을 건 결과. */
    const isSqlList = (expr: AstNode | null): boolean => {
        const node = unwrap(expr);
        if (node === null) return false;
        if (node.type === 'Identifier') {
            return sqlListNames.has(nameOf(node) ?? '');
        }
        if (node.type === 'ArrayExpression') {
            return children(node, 'elements').some(element =>
                element.type === 'SpreadElement'
                    ? isSqlList(child(element, 'argument'))
                    : isSqlText(element)
            );
        }
        if (
            node.type !== 'CallExpression' &&
            node.type !== 'OptionalCallExpression'
        ) {
            return false;
        }
        const callee = unwrap(child(node, 'callee'));
        const method = dotName(callee);
        if (callee === null || method === null) return false;
        if (method === 'map' || method === 'flatMap') {
            return children(node, 'arguments').some(argument =>
                returnedExprs(argument).some(
                    returned => isSqlText(returned) || isSqlList(returned)
                )
            );
        }
        return (
            SQL_LIST_KEEPERS.has(method) && isSqlList(child(callee, 'object'))
        );
    };

    const isSqlText = (expr: AstNode | null): boolean => {
        const node = unwrap(expr);
        if (node === null) return false;
        if (node.type === 'Identifier') return sqlNames.has(nameOf(node) ?? '');
        if (node.type === 'TemplateLiteral') {
            return children(node, 'expressions').some(isSqlText);
        }
        if (node.type === 'BinaryExpression' && node.operator === '+') {
            return (
                isSqlText(child(node, 'left')) ||
                isSqlText(child(node, 'right'))
            );
        }
        if (isMember(node) && node.computed === true) {
            return (
                isSqlText(child(node, 'object')) ||
                isSqlList(child(node, 'object'))
            );
        }
        const prop = dotName(node);
        if (prop !== null) {
            return (
                prop === 'sql' ||
                (SQL_PROPS.has(prop) && isRendered(child(node, 'object')))
            );
        }
        if (node.type === 'LogicalExpression') {
            return isSqlText(child(node, 'left'));
        }
        if (
            node.type !== 'CallExpression' &&
            node.type !== 'OptionalCallExpression'
        ) {
            return false;
        }
        const callee = unwrap(child(node, 'callee'));
        if (nameOf(callee) === 'String') {
            return isSqlText(children(node, 'arguments')[0] ?? null);
        }
        if (
            localFunctions.has(nameOf(callee) ?? '') &&
            children(node, 'arguments').some(isSqlText)
        ) {
            // 같은 파일의 도우미가 SQL 텍스트를 받아 돌려준 값(`whereOnly(sql)`)도 SQL 일부다.
            return true;
        }
        const method = dotName(callee);
        if (callee === null || method === null) return false;
        if (method === 'join') return isSqlList(child(callee, 'object'));
        if (SQL_LIST_PICKERS.has(method)) {
            return isSqlList(child(callee, 'object'));
        }
        return (
            SQL_STRING_METHODS.has(method) && isSqlText(child(callee, 'object'))
        );
    };

    const declarators = nodes.filter(
        node => node.type === 'VariableDeclarator'
    );
    const functions = nodes.flatMap(node => {
        if (node.type === 'FunctionDeclaration') {
            const name = nameOf(child(node, 'id'));
            return name === null ? [] : [{ name, body: node }];
        }
        const init = child(node, 'init');
        const name = nameOf(child(node, 'id'));
        return node.type === 'VariableDeclarator' &&
            name !== null &&
            isFunctionNode(init)
            ? [{ name, body: init }]
            : [];
    });

    functions.forEach(({ name }) => localFunctions.add(name));

    // 별칭·도우미 사슬을 고정점까지 따라간다(한 번에 한 겹씩 풀리므로 추적 집합이
    // 더 자라지 않을 때까지 돈다). 상한을 넘으면 조용히 놓치지 않고 실패한다(TE-63).
    const trackedSize = (): number =>
        renderFns.size + renderedNames.size + sqlNames.size + sqlListNames.size;
    const settle = (pass: number): void => {
        const before = trackedSize();
        growTrackedNames();
        if (trackedSize() === before) return;
        if (pass >= MAX_TRACKING_PASSES) {
            throw new Error(
                `sql-substring-assertion: alias chain did not settle in ${MAX_TRACKING_PASSES} passes`
            );
        }
        settle(pass + 1);
    };
    function growTrackedNames(): void {
        // `list.some(s => s.includes(..))`의 `s`도 SQL 텍스트다.
        nodes.forEach(node => {
            const callee = unwrap(child(node, 'callee'));
            const method = dotName(callee);
            if (
                node.type !== 'CallExpression' ||
                callee === null ||
                method === null ||
                !SQL_LIST_CALLBACKS.has(method) ||
                !isSqlList(child(callee, 'object'))
            ) {
                return;
            }
            children(node, 'arguments').forEach(argument => {
                const first = children(argument, 'params')[0];
                const param = patternName(first ?? null);
                if (param !== null) sqlNames.add(param);
            });
        });
        functions.forEach(({ name, body }) => {
            if (callsRender(body)) renderFns.add(name);
        });
        declarators.forEach(declarator => {
            const id = child(declarator, 'id');
            const init = child(declarator, 'init');
            const name = nameOf(id);
            if (name !== null) {
                if (
                    renderFns.has(nameOf(unwrap(init)) ?? '') &&
                    !isFunctionNode(init)
                ) {
                    renderFns.add(name);
                } else if (isRendered(init)) renderedNames.add(name);
                else if (isSqlText(init)) sqlNames.add(name);
                else if (isSqlList(init)) sqlListNames.add(name);
                return;
            }
            if (id?.type !== 'ObjectPattern') return;
            const rendered = isRendered(init);
            children(id, 'properties').forEach(property => {
                const key = nameOf(child(property, 'key'));
                const bound = patternName(child(property, 'value'));
                if (
                    key !== null &&
                    bound !== null &&
                    (key === 'sql' || (rendered && SQL_PROPS.has(key)))
                ) {
                    sqlNames.add(bound);
                }
            });
        });
    }
    settle(1);

    return { isSqlText, isSqlList, isRendered, returnedExprs };
}

/** `expect(<arg>)` 체인을 풀어 `{ arg, negated, matcher, matcherArgs }`로 돌려준다. */
function parseExpectChain(call: AstNode) {
    const callee = unwrap(child(call, 'callee'));
    const matcher = dotName(callee);
    if (callee === null || matcher === null) return null;
    const walkChain = (
        node: AstNode | null,
        negated: boolean
    ): { arg: AstNode | null; negated: boolean } | null => {
        const target = unwrap(node);
        if (target === null) return null;
        if (target.type === 'CallExpression') {
            return nameOf(child(target, 'callee')) === 'expect'
                ? { arg: children(target, 'arguments')[0] ?? null, negated }
                : null;
        }
        const name = dotName(target);
        return name === 'not' || name === 'resolves' || name === 'rejects'
            ? walkChain(child(target, 'object'), negated !== (name === 'not'))
            : null;
    };
    const root = walkChain(child(callee, 'object'), false);
    return root === null
        ? null
        : {
              ...root,
              matcher,
              matcherArgs: children(call, 'arguments'),
          };
}

function hasStringContaining(node: AstNode): boolean {
    return walk(node).some(inner => {
        if (inner.type !== 'CallExpression') return false;
        const callee = child(inner, 'callee');
        return (
            isMember(callee) &&
            nameOf(child(callee, 'object')) === 'expect' &&
            ['stringContaining', 'stringMatching'].includes(
                dotName(callee) ?? ''
            )
        );
    });
}

type SqlModel = ReturnType<typeof createSqlTextModel>;

/** 부분 확인 호출(`sql.includes(..)`, `/re/.test(sql)`, `list.some(s => s.includes(..))`)인가. */
function isSqlProbe(expr: AstNode | null, model: SqlModel): boolean {
    const node = unwrap(expr);
    // `list.filter(s => s.includes(..)).length`처럼 개수로 바꾼 것도 같은 부분 확인이다.
    if (node !== null && dotName(node) === 'length') {
        return isSqlProbe(child(node, 'object'), model);
    }
    if (
        node === null ||
        (node.type !== 'CallExpression' &&
            node.type !== 'OptionalCallExpression')
    ) {
        return false;
    }
    const callee = unwrap(child(node, 'callee'));
    if (callee === null) return false;
    const method = dotName(callee);
    if (method === 'test') {
        return model.isSqlText(children(node, 'arguments')[0] ?? null);
    }
    if (method === null) return false;
    if (SQL_PROBE_METHODS.has(method)) {
        return model.isSqlText(child(callee, 'object'));
    }
    // 목록을 훑는 검사: 콜백이 요소 SQL을 부분 확인하면 부분 확인이다.
    return (
        (method === 'some' ||
            method === 'every' ||
            method === 'findIndex' ||
            method === 'filter') &&
        model.isSqlList(child(callee, 'object')) &&
        children(node, 'arguments').some(argument =>
            walk(argument).some(
                inner => inner !== node && isSqlProbe(inner, model)
            )
        )
    );
}

type SqlJudgement = 'ok' | 'partial' | 'absence';

/** `{ sql: expect.stringContaining(..) }`·`{ sql: /re/ }`처럼 객체 속성으로 숨긴 부분 확인인가. */
function hasPartialSqlProperty(node: AstNode, rendered: boolean): boolean {
    return walk(node).some(inner => {
        if (inner.type !== 'ObjectProperty') return false;
        const key = nameOf(child(inner, 'key'));
        const value = child(inner, 'value');
        if (key === null || value === null) return false;
        if (key !== 'sql' && !(rendered && key === 'text')) return false;
        return value.type === 'RegExpLiteral' || hasStringContaining(value);
    });
}

function judgeSqlExpect(
    chain: NonNullable<ReturnType<typeof parseExpectChain>>,
    model: SqlModel
): SqlJudgement {
    const { arg, negated, matcher, matcherArgs } = chain;
    const rendered = model.isRendered(arg);
    const text = model.isSqlText(arg);
    const list = model.isSqlList(arg);
    // `toMatchInlineSnapshot`·`toMatchSnapshot`은 전체 문자열을 못 박는 단언이라 허용한다.
    const hidden = matcherArgs.some(
        argument =>
            hasPartialSqlProperty(argument, rendered) ||
            ((rendered || text || list) && hasStringContaining(argument))
    );
    if (hidden) return 'partial';
    const probe = isSqlProbe(arg, model);
    // `sql.length`·`sql.split(..).length`는 길이나 개수만 보는 부분 확인이다.
    const argNode = unwrap(arg);
    const lengthOfSql =
        argNode !== null &&
        dotName(argNode) === 'length' &&
        model.isSqlText(child(argNode, 'object'));
    if (lengthOfSql) return 'partial';
    if (!probe && !text) return 'ok';
    const first = matcherArgs[0] ?? null;
    if (probe) {
        // `includes(..)`처럼 일부만 본 불리언: `false`를 기대하는 쪽이 부재 확인이다.
        const expectsFalse =
            (matcher === 'toBe' &&
                first?.type === 'BooleanLiteral' &&
                first.value === negated) ||
            (matcher === 'toBeFalsy' && !negated);
        return expectsFalse ? 'absence' : 'partial';
    }
    if (negated && (matcher === 'toContain' || matcher === 'toMatch')) {
        return 'absence';
    }
    if (SQL_PARTIAL_MATCHERS.has(matcher)) {
        // `not.toBeTruthy()`는 빈 문자열 확인이라 전체 단언이다.
        return negated && matcher === 'toBeTruthy' ? 'ok' : 'partial';
    }
    if (negated && matcher === 'toBeFalsy') return 'partial';
    if (SQL_EQUALITY_MATCHERS.has(matcher)) {
        // `toEqual(/re/)`는 정규식이 전체를 대신하지 못한다.
        return first?.type === 'RegExpLiteral' ||
            (negated && isStringLiteralOf(first, ''))
            ? 'partial'
            : 'ok';
    }
    return 'ok';
}

function absenceReasons(ctx: FileContext) {
    return ctx.commentRanges.flatMap(comment => {
        const reason = SQL_ABSENCE_REASON.exec(comment.value.trim())?.[1];
        if (reason === undefined || !SQL_ABSENCE_WORD.test(reason)) return [];
        const line = lineAt(ctx.text, comment.start);
        const lineStart = ctx.text.lastIndexOf('\n', comment.start - 1) + 1;
        return [
            {
                line,
                reason: reason.trim(),
                alone: ctx.text.slice(lineStart, comment.start).trim() === '',
            },
        ];
    });
}

/** 렌더된 SQL 부분 문자열 단언과 부재 확인 예외를 줄 번호와 함께 돌려준다. */
export function findSqlSubstringAssertions(
    ctx: FileContext
): readonly SqlSubstringFinding[] {
    if (ctx.ast === null || !/sql|toSQL/i.test(ctx.text)) return [];
    const model = createSqlTextModel(ctx.ast);
    const statements = walk(ctx.ast).filter(
        node =>
            node.type === 'ExpressionStatement' ||
            node.type === 'ReturnStatement'
    );
    const reasons = absenceReasons(ctx);
    const findings = walk(ctx.ast)
        .filter(node => node.type === 'CallExpression')
        .flatMap(call => {
            const chain = parseExpectChain(call);
            const judgement =
                chain === null ? 'ok' : judgeSqlExpect(chain, model);
            if (judgement === 'ok') return [];
            const start = call.start ?? 0;
            const statement = statements
                .filter(
                    s =>
                        (s.start ?? 0) <= start &&
                        (s.end ?? 0) >= (call.end ?? 0)
                )
                .toSorted((a, b) => (b.start ?? 0) - (a.start ?? 0))[0];
            const first = lineAt(ctx.text, statement?.start ?? start);
            const last = lineAt(ctx.text, statement?.end ?? start);
            const covering =
                judgement === 'absence'
                    ? reasons.find(
                          r =>
                              (r.alone && r.line === first - 1) ||
                              (r.line >= first && r.line <= last)
                      )
                    : undefined;
            return [
                {
                    line: lineAt(ctx.text, start),
                    exempt: covering !== undefined,
                    reason: covering?.reason ?? null,
                },
            ];
        });
    return findings.toSorted((a, b) => a.line - b.line);
}

function parsedContext(file: string, text: string): FileContext | null {
    const parsed = tryParse({ path: file, text });
    return typeof parsed === 'string'
        ? null
        : {
              path: file,
              text,
              ast: parsed.ast,
              commentRanges: parsed.commentRanges,
          };
}

/** 위반 줄 번호. 가드 실패 메시지가 파일:줄을 붙이는 데 쓴다. */
export function sqlSubstringLinesOf(
    file: string,
    text: string
): readonly number[] {
    const ctx = parsedContext(file, text);
    return ctx === null
        ? []
        : findSqlSubstringAssertions(ctx)
              .filter(finding => !finding.exempt)
              .map(finding => finding.line);
}

/** `// sql-absence: <사유>`로 허용된 부재 확인 목록. 가드가 출력해 눈에 보이게 한다. */
export function sqlAbsenceExemptionsOf(
    file: string,
    text: string
): readonly { readonly line: number; readonly reason: string }[] {
    const ctx = parsedContext(file, text);
    return ctx === null
        ? []
        : findSqlSubstringAssertions(ctx).flatMap(finding =>
              finding.exempt && finding.reason !== null
                  ? [{ line: finding.line, reason: finding.reason }]
                  : []
          );
}

// ------------------------------------------------------------- NC-1 time units

/** 시간 단위 상수의 단일 출처(CONVENTIONS.md#NC-1). 이 파일만 단위를 숫자로 정의한다. */
export const TIME_CONSTANTS_FILE = 'src/shared/config/time.ts';

/** `TIME_CONSTANTS_FILE`이 내보내는 단위 상수. 다른 파일이 같은 이름을 다시 선언하면 두 값이 갈린다. */
export const TIME_UNIT_CONSTANTS: ReadonlySet<string> = new Set([
    'SECONDS_PER_MINUTE',
    'MINUTES_PER_HOUR',
    'SECONDS_PER_HOUR',
    'HOURS_PER_DAY',
    'SECONDS_PER_DAY',
    'SECONDS_PER_YEAR',
    'MS_PER_SECOND',
    'MS_PER_MINUTE',
    'MS_PER_HOUR',
    'MS_PER_DAY',
    'SECONDS_PER_HALF_DAY',
    'SECONDS_PER_QUARTER_DAY',
]);

/**
 * 시간 단위 환산 인수. 곱셈 사슬에 이 중 둘 이상이 숫자로 있으면(`24 * 60 * 60 * 1000`, `60 * 1000`) 단위를
 * 손으로 환산한 것이다. `1000`만 둘(`1000 * 1000`)이면 시간이 아닐 수 있어 세지 않는다. 인수가 하나뿐인
 * `5 * 60`(5분인지 5시간의 분인지 모른다)과 미리 곱한 `86_400_000`은 판정할 수 없어 보지 않는다.
 */
const TIME_UNIT_FACTORS: ReadonlySet<number> = new Set([
    60, 24, 1000, 3600, 86400,
]);
const MS_FACTOR = 1000;

/**
 * Next.js route segment config. `src/app/CLAUDE.md#AP-1`이 정적 리터럴(`// 1h` 주석)을 강제하므로 상수로 바꾸면
 * 설정이 조용히 무시된다. 그 값 안의 곱셈은 이 규칙이 세지 않는다(식 자체는 AP-1 위반이다).
 */
const ROUTE_SEGMENT_CONFIG: ReadonlySet<string> = new Set([
    'revalidate',
    'dynamic',
    'dynamicParams',
    'fetchCache',
    'runtime',
    'preferredRegion',
    'maxDuration',
]);

function isProduct(node: AstNode | null): node is AstNode {
    return (
        node !== null &&
        node.type === 'BinaryExpression' &&
        node.operator === '*'
    );
}

/** 곱셈 사슬(`a * b * c`)의 인수들. 안쪽 곱셈 노드는 `inner`에 적어 사슬 뿌리만 세게 한다. */
function productFactors(root: AstNode, inner: Set<AstNode>): AstNode[] {
    return [child(root, 'left'), child(root, 'right')].flatMap(side => {
        if (side === null) return [];
        if (!isProduct(side)) return [side];
        inner.add(side);
        return productFactors(side, inner);
    });
}

function timeUnitFactorCount(factors: readonly AstNode[]): number {
    const units = factors.flatMap(factor =>
        factor.type === 'NumericLiteral' &&
        typeof factor.value === 'number' &&
        TIME_UNIT_FACTORS.has(factor.value)
            ? [factor.value]
            : []
    );
    return units.length >= 2 && units.some(value => value !== MS_FACTOR)
        ? 1
        : 0;
}

/** `export const revalidate = …` 같은 segment config 값 안의 노드. */
function segmentConfigNodes(program: AstNode | null): readonly AstNode[] {
    if (program === null) return [];
    return children(program, 'body')
        .filter(statement => statement.type === 'ExportNamedDeclaration')
        .flatMap(statement => {
            const declaration = child(statement, 'declaration');
            return declaration?.type === 'VariableDeclaration'
                ? children(declaration, 'declarations')
                : [];
        })
        .flatMap(declarator => {
            const name = nameOf(child(declarator, 'id'));
            const init = child(declarator, 'init');
            return name !== null &&
                ROUTE_SEGMENT_CONFIG.has(name) &&
                init !== null
                ? walk(init)
                : [];
        });
}

/** NC-1 위반 줄: 단위 상수의 재선언과 숫자로 환산한 곱셈 사슬(사슬마다 한 번). */
export function findTimeUnitLiteralLines(ctx: FileContext): readonly number[] {
    if (ctx.ast === null) return [];
    // segment config 값의 곱셈은 처음부터 "안쪽"으로 적어 세지 않는다. `walk`보다 먼저 불러야 파일 순회 캐시가 유지된다.
    const inner = new Set<AstNode>(
        segmentConfigNodes(child(ctx.ast, 'program'))
    );
    const nodes = walk(ctx.ast);
    // 뿌리부터 돌므로(`walk`) 바깥 사슬이 안쪽 곱셈을 `inner`에 먼저 적는다.
    const products = nodes.filter(isProduct).flatMap(node => {
        if (inner.has(node)) return [];
        return timeUnitFactorCount(productFactors(node, inner)) > 0
            ? [node]
            : [];
    });
    const redeclared = nodes.filter(node => {
        const name =
            node.type === 'VariableDeclarator'
                ? nameOf(child(node, 'id'))
                : null;
        return name !== null && TIME_UNIT_CONSTANTS.has(name);
    });
    return [...products, ...redeclared]
        .map(node => lineAt(ctx.text, node.start ?? 0))
        .toSorted((a, b) => a - b);
}

export function timeUnitLiteralLinesOf(
    file: string,
    text: string
): readonly number[] {
    const ctx = parsedContext(file, text);
    return ctx === null ? [] : findTimeUnitLiteralLines(ctx);
}

// ------------------------------------------------- side-effect import markers

const BOUNDARY_MARKERS: ReadonlySet<string> = new Set([
    'server-only',
    'client-only',
]);

function importSource(node: AstNode): string | null {
    const source = child(node, 'source');
    return source !== null && typeof source.value === 'string'
        ? source.value
        : null;
}

/** 가져오는 이름 없이 모듈만 실행하는 `import 'x'`. */
function isSideEffectImport(node: AstNode, source: string): boolean {
    return (
        node.type === 'ImportDeclaration' &&
        importSource(node) === source &&
        children(node, 'specifiers').length === 0
    );
}

/**
 * `import 'server-only'`/`'client-only'`가 첫 import가 아니면 1. oxfmt는 부수효과 import를 제자리에 두고 나머지만
 * 정렬하므로, 표식이 다른 import 아래로 밀리면 그대로 남는다. 표식은 파일이 어느 쪽 번들에 속하는지 선언하는
 * 첫 줄이라 맨 위에 둔다.
 */
function countMisplacedBoundaryMarker(ctx: FileContext): number {
    const program = ctx.ast === null ? null : child(ctx.ast, 'program');
    if (program === null) return 0;
    const imports = children(program, 'body').filter(
        statement => statement.type === 'ImportDeclaration'
    );
    return imports.filter(
        (statement, index) =>
            index > 0 &&
            [...BOUNDARY_MARKERS].some(marker =>
                isSideEffectImport(statement, marker)
            )
    ).length;
}

const ENTITY_LIB_DIR = /^src\/entities\/[^/]+\/lib\//;

/**
 * `src/entities/CLAUDE.md#EN-1`의 "허용된 예외": 저장소를 인자로 받는 파이프라인 단계라 `lib/`에 있어도 서버 전용이다.
 * 문서가 이 파일들을 이름으로 적고, 가드 테스트가 문서와 이 목록이 같은지 본다.
 */
export const EN1_INJECTED_PIPELINE_FILES: readonly string[] = [
    'src/entities/news-article/lib/analyzeNewsCards.ts',
    'src/entities/news-article/lib/ingestNewsForSymbol.ts',
];

/**
 * `lib/`에 있어도 `server-only`를 다는 파일. EN-1 파이프라인 단계 외에 `auth/lib/tokenUtils.ts`가 있다:
 * `node:crypto` 난수로 토큰을 만들어 순수하지 않고, 표식이 클라이언트 번들에 `node:crypto` 폴리필이 조용히
 * 섞이는 것을 막는다. EN-1의 순수 원칙에서 벗어난 기존 예외이고, CONVENTIONS.md "Enforced rules" 표가 이름으로 적는다.
 */
export const SERVER_ONLY_LIB_EXCEPTIONS: readonly string[] = [
    ...EN1_INJECTED_PIPELINE_FILES,
    'src/entities/auth/lib/tokenUtils.ts',
];

function countServerOnlyImports(ctx: FileContext): number {
    const program = ctx.ast === null ? null : child(ctx.ast, 'program');
    if (program === null) return 0;
    return children(program, 'body').filter(statement =>
        isSideEffectImport(statement, 'server-only')
    ).length;
}

// ------------------------------------------------ deprecated core exports

const CORE_PACKAGE = '@y0ngha/siglens-core';
const CORE_DIST = path.resolve(
    __dirname,
    '../../../../node_modules/@y0ngha/siglens-core/dist'
);
const DEPRECATED_TAG = /(?:^|\s)@deprecated\b/;
const BACKTICK_SPAN = /`[^`]*`/g;

function declaredNames(declaration: AstNode): readonly string[] {
    if (declaration.type === 'VariableDeclaration') {
        return children(declaration, 'declarations').flatMap(declarator => {
            const name = nameOf(child(declarator, 'id'));
            return name === null ? [] : [name];
        });
    }
    const name = nameOf(child(declaration, 'id'));
    return name === null ? [] : [name];
}

/** JSDoc 본문에 `@deprecated` 태그가 있는가. 백틱 안의 `` `@deprecated` ``(다른 필드를 설명하는 문장)는 태그가 아니다. */
export function hasDeprecatedTag(jsdoc: string): boolean {
    return DEPRECATED_TAG.test(jsdoc.replace(BACKTICK_SPAN, ''));
}

/**
 * `.d.ts` 본문에서 JSDoc에 `@deprecated` 태그가 붙은 최상위 export 이름. 인터페이스 필드의 `@deprecated`는
 * import로 걸리지 않으니 보지 않는다.
 */
export function deprecatedExportsOf(dtsText: string): readonly string[] {
    const result = parse(dtsText, {
        sourceType: 'module',
        plugins: [['typescript', { dts: true }]],
    });
    return result.program.body.flatMap(statement => {
        if (
            statement.type !== 'ExportNamedDeclaration' ||
            statement.declaration === null ||
            statement.declaration === undefined
        ) {
            return [];
        }
        const jsdoc = (statement.leadingComments ?? []).at(-1);
        const deprecated =
            jsdoc !== undefined &&
            jsdoc.type === 'CommentBlock' &&
            hasDeprecatedTag(jsdoc.value);
        // babel 선언 노드는 구조적으로 AstNode와 같다.
        return deprecated
            ? declaredNames(statement.declaration as unknown as AstNode)
            : [];
    });
}

function listDts(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listDts(full);
        return entry.name.endsWith('.d.ts') ? [full] : [];
    });
}

export interface DeprecatedCoreExports {
    /** 읽은 `.d.ts` 경로. 비면 설치 경로가 깨진 것이다. */
    readonly files: readonly string[];
    readonly names: ReadonlySet<string>;
}

const deprecatedCache: { value?: DeprecatedCoreExports } = {};

/** 설치된 core의 `dist/**\/*.d.ts`에서 `@deprecated` export를 모은다(한 번만 읽는다). */
export function loadDeprecatedCoreExports(): DeprecatedCoreExports {
    if (deprecatedCache.value !== undefined) return deprecatedCache.value;
    const files = existsSync(CORE_DIST) ? listDts(CORE_DIST) : [];
    const value = {
        files,
        names: new Set(
            files.flatMap(file =>
                deprecatedExportsOf(readFileSync(file, 'utf8'))
            )
        ),
    };
    deprecatedCache.value = value;
    return value;
}

const SPECIFIER_SOURCE_KEY: Readonly<Record<string, string>> = {
    ImportSpecifier: 'imported',
    ExportSpecifier: 'local',
};

/** 지정자가 core에서 가리키는 이름: `import { X as Y }`·`export { X as Y } from`의 `X`. */
function coreNameOf(specifier: AstNode): string | null {
    const key = SPECIFIER_SOURCE_KEY[specifier.type];
    const node = key === undefined ? null : child(specifier, key);
    return node === null ? null : (nameOf(node) ?? stringValueOf(node));
}

/** core에서 가져오거나 다시 내보내는 이름 중 `deprecated`에 든 것의 수. */
export function countDeprecatedCoreImports(
    ctx: FileContext,
    deprecated: ReadonlySet<string>
): number {
    const program = ctx.ast === null ? null : child(ctx.ast, 'program');
    if (program === null) return 0;
    return children(program, 'body')
        .filter(
            statement =>
                (statement.type === 'ImportDeclaration' ||
                    statement.type === 'ExportNamedDeclaration') &&
                importSource(statement) === CORE_PACKAGE
        )
        .flatMap(statement => children(statement, 'specifiers'))
        .filter(specifier => {
            const name = coreNameOf(specifier);
            return name !== null && deprecated.has(name);
        }).length;
}

function nextLoopDepth(
    node: AstNode,
    isFunction: boolean,
    loopDepth: number
): number {
    if (isFunction) return 0;
    return LOOP_TYPES.has(node.type) ? loopDepth + 1 : loopDepth;
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
    {
        key: 'accumulator-in-loop',
        docRef: 'CONVENTIONS.md#CP-6',
        mode: 'zero',
        fix: 'Build it with map/filter/reduce/flatMap, or, if a loop is the cheaper O(N) form, put `CONVENTIONS.md#CP-6 예외: <cost>` in a comment above the function or loop.',
        appliesTo: file => PURE_LOGIC_DIR.test(file) && !isTestFile(file),
        countFile: ctx => findAccumulatorsInLoop(ctx).length,
    },
    {
        key: 'push-in-functional-callback',
        docRef: 'CONVENTIONS.md#CP-6',
        mode: 'zero',
        fix: 'Return the values from the callback (flatMap/map/reduce) instead of pushing into an outer array.',
        appliesTo: file => !isTestFile(file),
        countFile: ctx => findPushInFunctionalCallback(ctx).length,
    },
    {
        key: 'logical-assignment-in-react',
        docRef: 'REACT.md#EF-4',
        mode: 'zero',
        fix: 'Write the condition out (`if (ref.current === null) ref.current = value`) or use a ternary.',
        appliesTo: file => REACT_FILE.test(file) && !isTestFile(file),
        countAt: node =>
            node.type === 'AssignmentExpression' &&
            typeof node.operator === 'string' &&
            LOGICAL_ASSIGNMENT.has(node.operator)
                ? 1
                : 0,
    },
    {
        key: 'local-doc-citation',
        docRef: 'CONVENTIONS.md#CM-9',
        mode: 'zero',
        fix: 'State the fact inline instead of citing a local-only doc (only docs/product and docs/conventions are tracked).',
        appliesTo: () => true,
        countFile: countLocalDocCitations,
    },
    {
        key: 'issue-ref-in-comment',
        docRef: 'CONVENTIONS.md#CM-11',
        mode: 'zero',
        fix: 'Delete the issue/PR number and state the current constraint and its reason instead (a comment is not a changelog). A digit-only colour such as #123456 is not recognised as a colour: write it as rgb(), a token name or a hex with a letter.',
        appliesTo: file =>
            file.startsWith('src/') && /\.tsx?$/.test(file) && isCodeFile(file),
        countFile: ctx => findIssueRefLines(ctx).length,
    },
    {
        key: 'sql-substring-assertion',
        docRef: 'TESTING.md#TE-53',
        mode: 'zero',
        fix: 'Pin the full rendered SQL with toBe/toEqual. A pure absence check may carry `// sql-absence: <reason>` on the same or previous line.',
        appliesTo: isTestFile,
        countFile: ctx =>
            findSqlSubstringAssertions(ctx).filter(finding => !finding.exempt)
                .length,
    },
    {
        key: 'jsdoc-detached-by-comment',
        docRef: 'CONVENTIONS.md#CM-4',
        mode: 'zero',
        fix: 'Move the `//` or block comment above the `/**`, or fold it into the JSDoc, so the JSDoc sits directly above its declaration.',
        appliesTo: file => isCodeFile(file),
        countFile: ctx => findDetachedJsdocLines(ctx).length,
    },
    {
        key: 'imports-contiguous',
        docRef: 'TESTING.md#TE-1',
        mode: 'zero',
        fix: 'Keep the imports contiguous: move vi.mock/vi.unmock/vi.hoisted above the first import, and any other statement (vi.doMock, const x = vi.fn()) below the last import.',
        appliesTo: file => isTestFile(file) && isCodeFile(file),
        countFile: ctx => findStatementsBetweenImports(ctx).length,
    },
    {
        key: 'lint-disable-directive',
        docRef: 'CONVENTIONS.md (Lint and guard rules)',
        mode: 'zero',
        fix: 'Fix the reported problem instead of suppressing it. Only the files in ALLOWED_LINT_DISABLE_FILES may disable, with a "--" reason.',
        appliesTo: file => isCodeFile(file),
        countFile: countLintDisables,
    },
    {
        key: 'time-unit-literal',
        docRef: 'CONVENTIONS.md#NC-1',
        mode: 'zero',
        fix: 'Import the unit from src/shared/config/time.ts (`10 * MS_PER_MINUTE`, `7 * MS_PER_DAY`) instead of re-declaring it or multiplying 60/24/1000 by hand; add a missing unit there. Route segment config (`export const revalidate`, …) stays a plain literal with a `// 1h` comment (src/app/CLAUDE.md#AP-1) and is not counted.',
        appliesTo: file =>
            /\.tsx?$/.test(file) &&
            isCodeFile(file) &&
            file !== TIME_CONSTANTS_FILE,
        countFile: ctx => findTimeUnitLiteralLines(ctx).length,
    },
    {
        key: 'boundary-marker-first',
        docRef: 'CONVENTIONS.md (Lint and guard rules)',
        mode: 'zero',
        fix: "Move `import 'server-only'` / `import 'client-only'` above every other import; the formatter keeps a side-effect import where it is.",
        appliesTo: file => isCodeFile(file),
        countFile: countMisplacedBoundaryMarker,
    },
    {
        key: 'server-only-in-entity-lib',
        docRef: 'src/entities/CLAUDE.md#EN-1',
        mode: 'zero',
        fix: "entities/*/lib holds pure functions: drop `import 'server-only'` from a pure module, or move the server code to the slice's server/ or api.ts.",
        appliesTo: file =>
            ENTITY_LIB_DIR.test(file) &&
            !isTestFile(file) &&
            !SERVER_ONLY_LIB_EXCEPTIONS.includes(file),
        countFile: countServerOnlyImports,
    },
    {
        key: 'deprecated-core-import',
        docRef: 'CONVENTIONS.md (Lint and guard rules)',
        mode: 'zero',
        fix: 'Import the replacement named in the @deprecated JSDoc of the installed @y0ngha/siglens-core instead.',
        appliesTo: file => isCodeFile(file),
        countFile: ctx =>
            countDeprecatedCoreImports(ctx, loadDeprecatedCoreExports().names),
    },
];

// ------------------------------------------------------------------- scanning

interface Parsed {
    readonly ast: AstNode;
    readonly errors: number;
    readonly commentRanges: readonly CommentRange[];
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
    const ranges = (result.comments ?? []).flatMap(({ start, end, value }) =>
        start === undefined || end === undefined ? [] : [{ start, end, value }]
    );
    return {
        // babel은 `File` 노드를 돌려주는데 구조적으로 AstNode와 같다.
        ast: result as unknown as AstNode,
        errors: (result.errors ?? []).length,
        commentRanges: ranges,
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
    const strings = walk(parsed.ast)
        .filter(
            node =>
                node.type === 'StringLiteral' || node.type === 'TemplateElement'
        )
        .flatMap(node =>
            typeof node.start === 'number' && typeof node.end === 'number'
                ? [{ start: node.start, end: node.end }]
                : []
        );
    // 범위마다 `앞 + 공백 + 뒤`로 새 문자열을 만들면 복사량이 파일 길이 x 범위 수가 된다(주석·문자열이
    // 수백 개인 테스트 파일에서 스캔 비용을 지배한다). 지울 위치를 표시한 뒤 한 번에 이어 붙인다.
    const blank = new Uint8Array(text.length);
    [...parsed.commentRanges, ...strings].forEach(({ start, end }) =>
        blank.fill(1, start, end)
    );
    const pieces: string[] = [];
    // CONVENTIONS.md#CP-6 예외: 파일 길이만큼 한 번 훑는 O(N) 루프다(같은 표시가 이어진 구간 단위로 자른다).
    for (let from = 0; from < text.length;) {
        const mark = blank[from];
        let to = from + 1;
        while (to < text.length && blank[to] === mark) to += 1;
        const piece = text.slice(from, to);
        pieces.push(mark === 1 ? piece.replace(/[^\n]/g, ' ') : piece);
        from = to;
    }
    return pieces.join('');
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
    if (!isCodeFile(source.path) && !isTextFile(source.path)) {
        return { counts: new Map(), problems: [] };
    }
    if (!isCodeFile(source.path)) {
        // 텍스트 파일(.sh·.css 등): AST 없이 파일 전체를 보는 규칙만 돈다.
        const ctx: FileContext = {
            path: source.path,
            text: source.text,
            ast: null,
            commentRanges: [],
        };
        return {
            counts: new Map(
                rules.flatMap(rule => {
                    const found = rule.countFile?.(ctx) ?? 0;
                    return found > 0 ? [[rule.key, found] as const] : [];
                })
            ),
            problems: [],
        };
    }
    const parsed = tryParse(source);
    if (typeof parsed === 'string') {
        return { counts: new Map(), problems: [`${source.path}: ${parsed}`] };
    }
    // 노드마다 `countAt`이 없는 규칙까지 도는 비용을 덜려고 방문자를 가진 규칙만 미리 고른다.
    const visitors = rules.flatMap(({ key, countAt }) =>
        countAt === undefined ? [] : [{ key, countAt }]
    );
    // CONVENTIONS.md#CP-6 예외: 규칙 수 x 노드 수의 O(N) 합산이라 Map에 누적한다.
    const counts = new Map<string, number>();
    for (const node of walk(parsed.ast)) {
        for (const { key, countAt } of visitors) {
            const found = countAt(node);
            if (found > 0) {
                counts.set(key, (counts.get(key) ?? 0) + found);
            }
        }
    }
    const ctx: FileContext = {
        path: source.path,
        text: source.text,
        ast: parsed.ast,
        commentRanges: parsed.commentRanges,
    };
    rules.forEach(rule => {
        const found = rule.countFile?.(ctx) ?? 0;
        if (found > 0)
            counts.set(rule.key, (counts.get(rule.key) ?? 0) + found);
    });
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

/**
 * 검사 대상 파일 경로(코드 파일과 `.sh`·`.css` 같은 텍스트 파일). 추적 파일과 아직 추가 안 된 새
 * 파일을 보고, 무시된 스크래치는 뺀다. 스캔 루트 아래와 저장소 루트의 설정 파일을 본다.
 */
export function listScanFiles(root: string): string[] {
    const listed = execFileSync(
        'git',
        [
            'ls-files',
            '--cached',
            '--others',
            '--exclude-standard',
            '--',
            ...SCAN_ROOTS,
            ':(glob)*',
        ],
        { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
        .split('\n')
        .filter(Boolean);
    return [...new Set(listed)]
        .filter(file => isCodeFile(file) || isTextFile(file))
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
            listScanFiles(root).map(file => ({
                path: file,
                text: readFileSync(path.join(root, file), 'utf8'),
            }))
        )
    );
}
