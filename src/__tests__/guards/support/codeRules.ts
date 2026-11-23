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
        .flatMap(([, value]) =>
            Array.isArray(value)
                ? value.filter(isNode)
                : isNode(value)
                  ? [value]
                  : []
        )
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
    const depth = isFunction
        ? 0
        : LOOP_TYPES.has(node.type)
          ? loopDepth + 1
          : loopDepth;
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
    return [...text.matchAll(LOCAL_DOC)].length;
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
    const comments = ctx.commentRanges.map(c => countLocalDocs(c.value));
    const literals = isTestFile(ctx.path)
        ? []
        : [...walk(ctx.ast)]
              .map(stringValueOf)
              .map(value => (value === null ? 0 : countLocalDocs(value)));
    return [...comments, ...literals].reduce((sum, n) => sum + n, 0);
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
        key: 'lint-disable-directive',
        docRef: 'CONVENTIONS.md (Lint and guard rules)',
        mode: 'zero',
        fix: 'Fix the reported problem instead of suppressing it. Only the files in ALLOWED_LINT_DISABLE_FILES may disable, with a "--" reason.',
        appliesTo: file => isCodeFile(file),
        countFile: countLintDisables,
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
    return [...parsed.commentRanges, ...strings]
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
    // CONVENTIONS.md#CP-6 예외: 규칙 수 x 노드 수의 O(N) 합산이라 Map에 누적한다.
    const counts = new Map<string, number>();
    for (const node of walk(parsed.ast)) {
        for (const rule of rules) {
            const found = rule.countAt?.(node) ?? 0;
            if (found > 0) {
                counts.set(rule.key, (counts.get(rule.key) ?? 0) + found);
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
