import {
    childrenOf,
    isFunctionLike,
    listAt,
    nodeAt,
    parseSource,
    str,
    walk,
    type AstNode,
} from './alarmReachability';

/**
 * 함수 정의의 **AST 핀**. `alarmFilterReachability`가 `NEVER_REJECTS`의 각 함수가 아직 reject하지 않는
 * 모양인지, 그리고 그 근거가 되는 순수 헬퍼가 그대로인지 확인한다. 정규식 핀은 열린 꼬리(`.then(...)`),
 * 쉼표식, 새 인자 호출, 기본값 매개변수, `fn?.()`를 놓쳐서 파서로 바꿨다.
 *
 * 한 함수에 대해 확인하는 것:
 *  1. `async` 여부와 `export` 여부가 핀과 같다.
 *  2. 매개변수에 호출·`new`·`await`가 없다(기본값으로도 못 넣는다).
 *  3. 본문 모양(`PinShape`).
 *  4. 함수 안(매개변수·본문·콜백·인자 속 포함) **모든 호출 이름의 집합이 핀과 정확히 같다**.
 *     옵셔널 호출은 `?.이름`, `new`는 `new 이름`, `await`는 `await`로 센다.
 *
 * 콜백 안의 호출: `peekBriefingStatic`의 `marketBriefingSeedSurface(scope)`·`peekBriefingCache(...)`,
 * `peekMarketNewsDigestStatic`의 `computeDigestPeek(...)`는 `cacheNonNull`에 넘기는 **콜백 안**에서만 불린다.
 * `return` 모양 핀의 `eagerCalls`가 콜백 밖에서 즉시 평가되는 호출만 따로 고정하므로(그 밖의 호출이 콜백 밖으로
 * 나오면 실패한다) 이 호출들이 던져도 `cacheNonNull`의 try/catch가 삼킨다. 그래서 따로 핀을 걸지 않았다.
 *
 * **닫히지 않는 것(남은 목록, TE-63)**: 이 핀이 확인하는 것은 함수 안 호출 **이름 텍스트**의 집합, 멤버 접근
 * 텍스트의 집합, 그리고 구조 분해·비호출 `await`·`as any`·`!`·`for...of`·`for...in`·`yield`가 없다는 것뿐이다.
 * 새 호출이 없다거나 던질 수 있는 구문이 없다는 것을 증명하지 않는다. 다음은 보지 못한다.
 *  - 바인딩 해석: 호출 핀은 이름을 텍스트로 비교할 뿐 바인딩을 해석하지 않는다. 함수 안 지역 바인딩이 허용 목록의
 *    호출 이름을 가리는 경우(예: catch 안 `const markSsrMiss = fetcher;` 뒤 `await markSsrMiss()`)는 감지하지 못한다.
 *  - 타입 보장에 기대는 읽기: 허용 목록에 든 멤버 접근(`tags[0]`, `scope.id`, `env.url`, `summary.indices`)과
 *    `cacheNonNull`의 매개변수 구조 분해(`{ revalidate, tags }`)는 인자가 선언된 타입대로 `null`·`undefined`가
 *    아니라는 TypeScript 보장에 기댄다. 호출자가 타입을 어기면 던진다.
 *  - 호출·멤버 접근이 없는 식: 이항·단항 연산(`in`·`instanceof`의 우변이 객체·함수가 아닐 때, `+`의 강제 변환),
 *    전개(`[...x]`), 템플릿 리터럴의 문자열 변환, getter·`Symbol.toPrimitive` 부수 효과, 스택 오버플로·메모리 고갈.
 *
 * 한계(TE-63): 호출되는 함수 **안**은 `calls`에 적은 이름만 다음 핀이 따로 건다. 핀이 없는 이름
 * (`unstable_cache`, `staticSymbolCache`, `peekBriefingCache` 같은 외부·콜백 쪽 호출)은 이 목록의
 * 근거가 아니라 "안에서 던져도 감싸는 try/catch나 `cacheNonNull`이 삼킨다"는 구조에 기댄다.
 */

export type PinShape =
    /** `[const 선언 prefixStatements개] return callee(...);` — 문장은 그뿐이고 `return`은 하나다. */
    | {
          kind: 'return';
          callee: string;
          prefixStatements?: number;
          /**
           * 콜백 **밖**에서 즉시 평가되는 호출 이름의 정확한 집합(콜백 본문 안 호출은 뺀다). 인자 평가 중
           * 던지는 호출이 콜백 안에서 밖으로 옮겨 가는 것을 막는다.
           */
          eagerCalls: readonly string[];
      }
    /** `return (await callee(...)) ?? [];` */
    | { kind: 'nullish-default'; callee: string }
    /**
     * `[if (guard() === null) return;] try {} catch {}` — catch는 던지지 않고 리터럴만 돌려주며
     * (async면 try의 `return`은 전부 `await`) finally가 없다. catch 매개변수는 평범한 식별자이거나 없다
     * (구조 분해는 `null`·`undefined`를 던진 경우 그 자리에서 던진다). catch 안 호출 이름은 `catchCalls`와
     * **정확히** 같다 — try에서 쓴 호출을 catch에서 다시 부를 수 없다.
     */
    | {
          kind: 'try';
          guard?: string;
          catchCalls: readonly string[];
          /** catch 안(매개변수 포함) 멤버 접근의 정확한 집합. */
          catchMembers: readonly string[];
      }
    /** 문장 `statements`개짜리 평범한 본문. `throw`가 없다. */
    | { kind: 'plain'; statements: number };

export interface FunctionPin {
    readonly async: boolean;
    readonly exported: boolean;
    readonly shape: PinShape;
    readonly calls: readonly string[];
    /**
     * 함수 전체(매개변수·본문·콜백)의 멤버 접근(`a.b`, `a[0]`, `a?.b`)을 정규화한 텍스트의 정확한 집합.
     * 호출 이름이 같아도 `(error as any).cause.x`처럼 새 속성 읽기는 던질 수 있어서 따로 막는다.
     */
    readonly members: readonly string[];
    /**
     * 매개변수 자리의 평평한 객체 구조 분해(`{ a, b }`)를 허용한다. 호출자가 넘기는 타입이 정해진 객체라
     * `null`·`undefined`가 오지 않는다는 **타입 보장**에 기댄다(그 밖의 구조 분해는 어디서도 허용하지 않는다).
     */
    readonly paramPattern?: boolean;
}

const CALL_LIKE = new Set([
    'CallExpression',
    'OptionalCallExpression',
    'NewExpression',
    'AwaitExpression',
    'TaggedTemplateExpression',
]);

function calleeLabel(node: AstNode | undefined): string {
    if (node === undefined) return '<none>';
    switch (node.type) {
        case 'Identifier':
            return str(node, 'name') ?? '<id>';
        case 'ThisExpression':
            return 'this';
        case 'MemberExpression':
        case 'OptionalMemberExpression': {
            const property = nodeAt(node, 'property');
            const name =
                node.computed === true
                    ? '<computed>'
                    : (str(property, 'name') ?? '<prop>');
            return `${calleeLabel(nodeAt(node, 'object'))}.${name}`;
        }
        default:
            return '(expr)';
    }
}

function callLabel(node: AstNode): string | undefined {
    switch (node.type) {
        case 'CallExpression':
            return calleeLabel(nodeAt(node, 'callee'));
        case 'OptionalCallExpression':
            return `?.${calleeLabel(nodeAt(node, 'callee'))}`;
        case 'NewExpression':
            return `new ${calleeLabel(nodeAt(node, 'callee'))}`;
        case 'AwaitExpression':
            return 'await';
        case 'TaggedTemplateExpression':
            return `tag ${calleeLabel(nodeAt(node, 'tag'))}`;
        default:
            return undefined;
    }
}

/** 함수 노드 전체(매개변수·본문·콜백)의 호출 이름 집합. */
export function callNamesIn(fn: AstNode): string[] {
    const names = new Set<string>();
    walk(fn, node => {
        const label = callLabel(node);
        if (label !== undefined) names.add(label);
    });
    return [...names].sort();
}

function keyLabel(node: AstNode | undefined): string {
    switch (node?.type) {
        case 'NumericLiteral':
            return String(node.value);
        case 'StringLiteral':
            return JSON.stringify(node.value);
        case 'Identifier':
            return str(node, 'name') ?? '<id>';
        default:
            return '<expr>';
    }
}

/** 멤버 접근 식을 `a.b`·`a[0]`·`a?.b`·`(call).b` 꼴 텍스트로 정규화한다. */
function memberLabel(node: AstNode | undefined): string {
    switch (node?.type) {
        case 'MemberExpression':
        case 'OptionalMemberExpression': {
            const optional =
                node.type === 'OptionalMemberExpression' &&
                node.optional === true;
            const property = nodeAt(node, 'property');
            const object = memberLabel(nodeAt(node, 'object'));
            return node.computed === true
                ? `${object}${optional ? '?.' : ''}[${keyLabel(property)}]`
                : `${object}${optional ? '?.' : '.'}${str(property, 'name') ?? '<prop>'}`;
        }
        case 'Identifier':
            return str(node, 'name') ?? '<id>';
        case 'ThisExpression':
            return 'this';
        case 'CallExpression':
        case 'OptionalCallExpression':
            return '(call)';
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
            return memberLabel(nodeAt(node, 'expression'));
        default:
            return '(expr)';
    }
}

/** `root` 아래 모든 멤버 접근(연쇄의 중간 단계 포함)의 정규화 텍스트 집합. */
export function memberTextsIn(root: AstNode): string[] {
    const found = new Set<string>();
    walk(root, node => {
        if (
            node.type === 'MemberExpression' ||
            node.type === 'OptionalMemberExpression'
        ) {
            found.add(memberLabel(node));
        }
    });
    return [...found].sort();
}

/** 중첩 함수(콜백) 본문을 제외한, 함수가 즉시 평가하는 호출 이름 집합. */
export function eagerCallNamesIn(fn: AstNode): string[] {
    const names = new Set<string>();
    const collect = (node: AstNode): void => {
        if (node !== fn && isFunctionLike(node)) return;
        const label = callLabel(node);
        if (label !== undefined) names.add(label);
        childrenOf(node).forEach(collect);
    };
    collect(fn);
    return [...names].sort();
}

/** 중첩 함수를 제외하고 `root` 아래의 노드를 모은다. */
function ownNodes(root: AstNode, type: string): AstNode[] {
    const found: AstNode[] = [];
    const collect = (node: AstNode): void => {
        if (node !== root && isFunctionLike(node)) return;
        if (node.type === type) found.push(node);
        childrenOf(node).forEach(collect);
    };
    collect(root);
    return found;
}

function contains(root: AstNode, type: string): boolean {
    let found = false;
    walk(root, node => {
        if (node.type === type) found = true;
    });
    return found;
}

function isInertReturn(arg: AstNode | undefined): boolean {
    if (arg === undefined) return true;
    if (
        [
            'NullLiteral',
            'BooleanLiteral',
            'StringLiteral',
            'Identifier',
        ].includes(arg.type)
    ) {
        return true;
    }
    return (
        arg.type === 'ArrayExpression' && listAt(arg, 'elements').length === 0
    );
}

interface FoundFunction {
    readonly fn: AstNode;
    readonly exported: boolean;
}

function findFunctions(program: AstNode, name: string): FoundFunction[] {
    const found: FoundFunction[] = [];
    walk(program, (node, ancestors) => {
        if (
            node.type === 'FunctionDeclaration' &&
            str(nodeAt(node, 'id'), 'name') === name
        ) {
            found.push({
                fn: node,
                exported:
                    ancestors[ancestors.length - 1]?.type ===
                    'ExportNamedDeclaration',
            });
        }
    });
    return found;
}

function checkShape(fn: AstNode, body: AstNode, pin: FunctionPin): string[] {
    const stmts = listAt(body, 'body');
    const { shape } = pin;
    const problems: string[] = [];
    const last = stmts[stmts.length - 1];
    const singleReturn = (): void => {
        if (ownNodes(fn, 'ReturnStatement').length !== 1) {
            problems.push('`return`이 정확히 하나가 아니다');
        }
        if (last?.type !== 'ReturnStatement') {
            problems.push('마지막 문장이 `return`이 아니다');
        }
        if (contains(fn, 'ThrowStatement')) problems.push('`throw`가 있다');
    };
    switch (shape.kind) {
        case 'return': {
            const prefix = shape.prefixStatements ?? 0;
            if (stmts.length !== prefix + 1) {
                problems.push(`문장 수가 ${prefix + 1}개가 아니다`);
            }
            const prefixOk = stmts
                .slice(0, -1)
                .every(
                    st =>
                        st.type === 'VariableDeclaration' &&
                        st.kind === 'const' &&
                        listAt(st, 'declarations').every(
                            d => nodeAt(d, 'id')?.type === 'Identifier'
                        )
                );
            if (!prefixOk)
                problems.push('`return` 앞에 const 선언이 아닌 문장이 있다');
            singleReturn();
            if (
                eagerCallNamesIn(fn).join('\n') !==
                [...shape.eagerCalls].sort().join('\n')
            ) {
                problems.push(
                    `즉시 평가되는 호출이 다르다: [${eagerCallNamesIn(fn).join(', ')}]`
                );
            }
            const arg = nodeAt(last, 'argument');
            const callee = nodeAt(arg, 'callee');
            if (
                arg?.type !== 'CallExpression' ||
                callee?.type !== 'Identifier' ||
                str(callee, 'name') !== shape.callee
            ) {
                problems.push(
                    `반환 값이 \`${shape.callee}(...)\` 호출 하나가 아니다(체인·쉼표식·다른 식)`
                );
            }
            break;
        }
        case 'nullish-default': {
            if (stmts.length !== 1) problems.push('문장이 하나가 아니다');
            singleReturn();
            const arg = nodeAt(last, 'argument');
            const left = nodeAt(arg, 'left');
            const call = nodeAt(left, 'argument');
            const right = nodeAt(arg, 'right');
            const ok =
                arg?.type === 'LogicalExpression' &&
                str(arg, 'operator') === '??' &&
                left?.type === 'AwaitExpression' &&
                call?.type === 'CallExpression' &&
                str(nodeAt(call, 'callee'), 'name') === shape.callee &&
                right?.type === 'ArrayExpression' &&
                listAt(right, 'elements').length === 0;
            if (!ok) {
                problems.push(
                    `반환 값이 \`(await ${shape.callee}(...)) ?? []\`가 아니다`
                );
            }
            break;
        }
        case 'try': {
            const guard = shape.guard === undefined ? [] : stmts.slice(0, 1);
            const rest = stmts.slice(guard.length);
            if (rest.length !== 1 || rest[0].type !== 'TryStatement') {
                problems.push('본문이 (가드 +) `try` 하나가 아니다');
                break;
            }
            if (shape.guard !== undefined) {
                const test = nodeAt(guard[0], 'test');
                const consequent = nodeAt(guard[0], 'consequent');
                const guardCall = nodeAt(test, 'left');
                const guardOk =
                    guard[0].type === 'IfStatement' &&
                    nodeAt(guard[0], 'alternate') === undefined &&
                    str(test, 'operator') === '===' &&
                    guardCall?.type === 'CallExpression' &&
                    str(nodeAt(guardCall, 'callee'), 'name') === shape.guard &&
                    listAt(guardCall, 'arguments').length === 0 &&
                    nodeAt(test, 'right')?.type === 'NullLiteral' &&
                    consequent?.type === 'ReturnStatement' &&
                    nodeAt(consequent, 'argument') === undefined;
                if (!guardOk) {
                    problems.push(
                        `가드가 \`if (${shape.guard}() === null) return;\`가 아니다`
                    );
                }
            }
            const tryStmt = rest[0];
            const handler = nodeAt(tryStmt, 'handler');
            const block = nodeAt(tryStmt, 'block');
            if (handler === undefined || block === undefined) {
                problems.push('`catch`가 없다');
                break;
            }
            if (nodeAt(tryStmt, 'finalizer') !== undefined) {
                problems.push('`finally`가 있다');
            }
            const param = nodeAt(handler, 'param');
            if (param !== undefined && param.type !== 'Identifier') {
                problems.push('`catch` 매개변수가 평범한 식별자가 아니다');
            }
            const catchNames = callNamesIn(nodeAt(handler, 'body') ?? handler);
            if (
                catchNames.join('\n') !==
                [...shape.catchCalls].sort().join('\n')
            ) {
                problems.push(
                    `\`catch\` 안 호출 이름이 다르다: [${catchNames.join(', ')}] ≠ [${[...shape.catchCalls].sort().join(', ')}]`
                );
            }
            const catchMembers = memberTextsIn(handler);
            const wantedMembers = [...shape.catchMembers].sort();
            if (catchMembers.join('\n') !== wantedMembers.join('\n')) {
                problems.push(
                    `\`catch\` 안 멤버 접근이 다르다: [${catchMembers.join(', ')}] ≠ [${wantedMembers.join(', ')}]`
                );
            }
            if (contains(handler, 'ThrowStatement')) {
                problems.push('`catch` 안에 `throw`가 있다');
            }
            if (
                !ownNodes(handler, 'ReturnStatement').every(r =>
                    isInertReturn(nodeAt(r, 'argument'))
                )
            ) {
                problems.push('`catch`가 리터럴이 아닌 값을 돌려준다');
            }
            if (
                pin.async &&
                !ownNodes(block, 'ReturnStatement').every(r => {
                    const arg = nodeAt(r, 'argument');
                    return arg === undefined || arg.type === 'AwaitExpression';
                })
            ) {
                problems.push('`try`의 `return`이 `await`이 아니다');
            }
            // 가드·핸들러 밖의 `throw`(가드)도 없어야 한다.
            if (guard.length > 0 && contains(guard[0], 'ThrowStatement')) {
                problems.push('가드에 `throw`가 있다');
            }
            break;
        }
        case 'plain': {
            if (stmts.length !== shape.statements) {
                problems.push(`문장 수가 ${shape.statements}개가 아니다`);
            }
            if (contains(fn, 'ThrowStatement')) problems.push('`throw`가 있다');
            break;
        }
    }
    return problems;
}

/**
 * 호출 이름·멤버 접근 말고도 던질 수 있는 구문을 막는다:
 *  - 구조 분해(`ObjectPattern`·`ArrayPattern`): 매개변수 자리의 평평한 객체 패턴만, 핀이 허용할 때(`paramPattern`).
 *  - `await`의 인자가 호출이 아닌 경우(`await error;`, `await promise;`).
 *  - `as any`와 비널 단언(`!`): 타입 검사를 우회해 던질 수 있는 읽기를 숨긴다.
 */
function checkThrowingConstructs(fn: AstNode, pin: FunctionPin): string[] {
    const problems: string[] = [];
    const params = listAt(fn, 'params');
    walk(fn, node => {
        if (node.type === 'ObjectPattern' || node.type === 'ArrayPattern') {
            const flat =
                node.type === 'ObjectPattern' &&
                listAt(node, 'properties').every(
                    prop =>
                        prop.type === 'ObjectProperty' &&
                        nodeAt(prop, 'value')?.type === 'Identifier'
                );
            if (!(pin.paramPattern === true && params.includes(node) && flat)) {
                problems.push('허용되지 않은 구조 분해가 있다');
            }
        }
        if (
            node.type === 'AwaitExpression' &&
            nodeAt(node, 'argument')?.type !== 'CallExpression'
        ) {
            problems.push('호출이 아닌 것을 `await`한다');
        }
        if (
            node.type === 'TSAsExpression' &&
            nodeAt(node, 'typeAnnotation')?.type === 'TSAnyKeyword'
        ) {
            problems.push('`as any`가 있다');
        }
        if (
            node.type === 'ForOfStatement' ||
            node.type === 'ForInStatement' ||
            node.type === 'YieldExpression'
        ) {
            problems.push(
                '`for...of`·`for...in`·`yield`가 있다(이터레이터가 던질 수 있다)'
            );
        }
        if (node.type === 'TSNonNullExpression') {
            problems.push('비널 단언(`!`)이 있다');
        }
    });
    return problems;
}

/**
 * `text`(파일 전체이거나 함수 하나를 잘라 낸 것)에서 `name` 함수를 찾아 핀과 맞는지 확인한다.
 * 맞지 않는 이유를 목록으로 돌려준다(빈 목록이 통과).
 */
export function checkFunctionPin(
    text: string,
    name: string,
    pin: FunctionPin
): string[] {
    const found = findFunctions(parseSource(text), name);
    if (found.length !== 1) return [`\`${name}\` 정의가 ${found.length}개다`];
    const { fn, exported } = found[0];
    const problems: string[] = [];
    if ((fn.async === true) !== pin.async) {
        problems.push(`async 여부가 ${pin.async}이 아니다`);
    }
    if (exported !== pin.exported) {
        problems.push(`export 여부가 ${pin.exported}이 아니다`);
    }
    if (
        listAt(fn, 'params').some(param =>
            [...CALL_LIKE].some(type => contains(param, type))
        )
    ) {
        problems.push('매개변수에 호출·`new`·`await`가 있다');
    }
    const body = nodeAt(fn, 'body');
    if (body?.type !== 'BlockStatement') {
        return [...problems, '본문이 블록이 아니다'];
    }
    problems.push(...checkShape(fn, body, pin));
    problems.push(...checkThrowingConstructs(fn, pin));
    const members = memberTextsIn(fn);
    const wantedMembers = [...pin.members].sort();
    if (members.join('\n') !== wantedMembers.join('\n')) {
        problems.push(
            `멤버 접근이 다르다: [${members.join(', ')}] ≠ [${wantedMembers.join(', ')}]`
        );
    }
    const actual = callNamesIn(fn);
    const expected = [...pin.calls].sort();
    if (actual.join('\n') !== expected.join('\n')) {
        problems.push(
            `호출 이름 집합이 다르다: [${actual.join(', ')}] ≠ [${expected.join(', ')}]`
        );
    }
    return problems;
}

/** 함수 본문 안쪽 텍스트의 범위(`{` 다음 ~ `}` 앞)와 함수 전체 범위. 변형 테스트가 쓴다. */
export function functionRanges(
    text: string,
    name: string
): { start: number; end: number; bodyStart: number; bodyEnd: number } {
    const [{ fn }] = findFunctions(parseSource(text), name);
    const body = nodeAt(fn, 'body') as AstNode;
    const num = (node: AstNode, key: string): number =>
        typeof node[key] === 'number' ? (node[key] as number) : 0;
    return {
        start: num(fn, 'start'),
        end: num(fn, 'end'),
        bodyStart: num(body, 'start') + 1,
        bodyEnd: num(body, 'end') - 1,
    };
}

/**
 * `try` 모양 함수의 catch 본문 안쪽 범위와, try 블록이 처음 부르는 식별자 호출 이름. 변형 테스트가
 * "try에서 쓴 호출을 catch에서 다시 부른다"를 만들 때 쓴다. try가 없으면 `undefined`.
 */
export function catchInfo(
    text: string,
    name: string
): { bodyStart: number; bodyEnd: number; tryCallee: string } | undefined {
    const [{ fn }] = findFunctions(parseSource(text), name);
    const body = nodeAt(fn, 'body') as AstNode;
    const tryStmt = listAt(body, 'body').find(st => st.type === 'TryStatement');
    const handlerBody = nodeAt(nodeAt(tryStmt, 'handler'), 'body');
    const block = nodeAt(tryStmt, 'block');
    if (
        tryStmt === undefined ||
        handlerBody === undefined ||
        block === undefined
    ) {
        return undefined;
    }
    let tryCallee: string | undefined;
    walk(block, node => {
        const callee = nodeAt(node, 'callee');
        if (
            tryCallee === undefined &&
            node.type === 'CallExpression' &&
            callee?.type === 'Identifier'
        ) {
            tryCallee = str(callee, 'name');
        }
    });
    if (tryCallee === undefined) return undefined;
    const num = (node: AstNode, key: string): number =>
        typeof node[key] === 'number' ? (node[key] as number) : 0;
    return {
        bodyStart: num(handlerBody, 'start') + 1,
        bodyEnd: num(handlerBody, 'end') - 1,
        tryCallee,
    };
}
