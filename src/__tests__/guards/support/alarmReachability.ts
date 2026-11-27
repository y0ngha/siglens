import { parse } from '@babel/parser';

/**
 * 알람 필터 문구가 가리키는 로그가 **실제로 닿을 수 있는지** 정적으로 판정하는 매처
 * (`docs/conventions/TOOLCHAIN.md#TC-38`).
 *
 * 죽은 로그의 모양: `await peekBriefingStatic(...).catch(e => console.error('[X] failed', e))`에서
 * `peekBriefingStatic`은 `cacheNonNull`이 모든 오류를 삼켜 `null`로 resolve하므로 `.catch`는 영원히
 * 불리지 않는다. 문구는 소스에 있어서(`alarmFilterPhrases`) 통과하지만 알람은 발화할 수 없다.
 *
 * **검사하는 것은 이 하나뿐이다**: 로그(`console.*`)가 `.catch(onRejected)` 또는 `.then(_, onRejected)`의
 * `onRejected` 안에 있고, 그 `.catch`/`.then`이 `NEVER_REJECTS`에 든 함수의 호출에 **바로** 붙어 있을 때.
 *
 * **방향 원칙**: 닿을 수 있는 로그를 죽었다고 말하지 않는다. 대신 놓치는 것이 많다. 증명할 수 있는
 * 것만 잡으려고 함수의 reject 여부를 코드에서 추론하지 않고, 사람이 읽고 확인한 목록(`NEVER_REJECTS`)만
 * 믿는다. 목록의 각 항목은 이유를 적고, `alarmFilterReachability.test.ts`가 정의가 그 모양인지 핀한다.
 *
 * 목록의 함수는 `async`이거나(`cacheNonNull` 등) 본문이 `return cacheNonNull(...)` 하나라서 promise를 돌려준다.
 * 동기로 던지는 경우(목록의 non-async 함수가 인자 평가 중 던지는 것)는 `.catch`가 붙기 전에 호출 자리에서
 * 터지므로 `.catch`의 로그에 닿지 못한다 — 어느 쪽이든 그 `.catch` 안의 로그는 찍히지 않는다.
 * 호출 이름은 이렇게만 목록의 함수로 해석한다(그 밖은 모두 "모른다" = 안전하지 않다):
 *  - `@/…` 또는 상대 경로에서 가져온 이름 있는 import(별칭은 원래 이름으로 푼다). 패키지 import는
 *    로컬 이름과 같아도 해석하지 않는다.
 *  - 같은 파일의 `const f = () => …`/`const f = function …` 하나뿐인 바인딩(`let`·`var`·함수 선언·매개변수·
 *    재선언·재할당이 있으면 제외).
 *
 * **이 가드가 검사하지 않는 것**(TE-63 한계):
 *  - `try {} catch {}` 블록 안의 로그. 전혀 보지 않는다.
 *  - 간접 호출: 목록의 함수를 감싼 다른 함수, 변수에 담아 부르는 함수, 메서드 호출(`obj.load()`),
 *    `.then(cb).catch(log)` 같은 체인, `Promise.all([...])` 수신. 목록의 함수에 **바로** 붙은
 *    `.catch`/`.then`이 아니면 전부 검사하지 않는다.
 *  - 로그를 헬퍼가 찍는 경우(`logToolDegrade(...)`)·주입된 로거(`deps.log`). `console.*`가 아니면 위치를 못 잡는다.
 *  - 문구를 모르는 로그(첫 인자가 매개변수·다른 파일의 상수, 또는 `${tag}:`처럼 템플릿이 슬롯으로 시작)가
 *    위 모양의 `.catch` 안에 있으면 `findOpaqueDeadLogs`가 목록으로 낸다. 그 밖의 위치는 보지 않는다.
 *  - 문서의 "던지지 않는다" 계약. 목록은 코드와 핀 테스트로만 근거를 댄다.
 */

/**
 * 읽고 확인한 "절대 reject하지 않는 함수". 항목마다 이유를 적는다. `alarmFilterReachability.test.ts`가
 * 각 정의를 읽어 이유가 되는 모양이 그대로인지 핀한다. 모양이 바뀌면 그 핀이 실패하니 목록을 다시 확인하라.
 *
 *  - `cacheNonNull`·`cacheNonEmptyOrNull`: 본문 전체가 `try {} catch {}` 하나고 catch가 던지지 않는다.
 *    `cacheNonNull`의 catch 안 `markSsrMiss`는 자기 안에서 오류를 삼킨다.
 *  - `cacheNonEmpty`: `cacheNonEmptyOrNull`을 `?? []`로 감쌀 뿐이다.
 *  - `peekBriefingStatic`·`peekMacroBriefingStatic`·`peekMarketNewsDigestStatic`: 본문이 `return cacheNonNull(...)`이다.
 *    그 앞의 호출·인자 평가(`marketBriefingContextOf`, 캐시 태그 함수)는 던질 일이 없는 순수 함수다.
 */
export const NEVER_REJECTS: ReadonlySet<string> = new Set([
    'cacheNonNull',
    'cacheNonEmpty',
    'cacheNonEmptyOrNull',
    'peekBriefingStatic',
    'peekMacroBriefingStatic',
    'peekMarketNewsDigestStatic',
]);

/** 로그를 남기는 `console` 메서드. */
const LOG_METHODS = new Set(['error', 'warn', 'log', 'info']);

export interface AstNode {
    readonly type: string;
    readonly [key: string]: unknown;
}

export function parseSource(text: string): AstNode {
    return parse(text, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: ['typescript', 'jsx'],
        attachComment: false,
    }).program as unknown as AstNode;
}

function isNode(value: unknown): value is AstNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { type?: unknown }).type === 'string'
    );
}

export function childrenOf(node: AstNode): AstNode[] {
    return Object.entries(node)
        .filter(([key]) => key !== 'loc' && key !== 'extra')
        .flatMap(([, value]) =>
            Array.isArray(value)
                ? value.filter(isNode)
                : isNode(value)
                  ? [value]
                  : []
        );
}

/** 노드와 모든 하위 노드를 깊이 우선으로 방문한다. 방문자는 조상 목록(가까운 쪽이 마지막)을 받는다. */
export function walk(
    node: AstNode,
    visit: (node: AstNode, ancestors: readonly AstNode[]) => void,
    ancestors: readonly AstNode[] = []
): void {
    visit(node, ancestors);
    const next = [...ancestors, node];
    childrenOf(node).forEach(child => walk(child, visit, next));
}

export function str(node: unknown, key: string): string | undefined {
    const value = isNode(node) ? node[key] : undefined;
    return typeof value === 'string' ? value : undefined;
}

export function nodeAt(node: unknown, key: string): AstNode | undefined {
    const value = isNode(node) ? node[key] : undefined;
    return isNode(value) ? value : undefined;
}

export function listAt(node: unknown, key: string): AstNode[] {
    const value = isNode(node) ? node[key] : undefined;
    return Array.isArray(value) ? value.filter(isNode) : [];
}

function numAt(node: AstNode, key: string): number {
    const value = node[key];
    return typeof value === 'number' ? value : 0;
}

export function isFunctionLike(node: AstNode): boolean {
    return /Function|Method/.test(node.type);
}

/**
 * `(x)`·`x!`·`x as T`를 벗긴다. `await x`는 벗기지 않는다: `(await p()).catch(...)`의 `.catch`는
 * `p`의 결과 값에 붙은 것이라 `p`의 reject와 무관하다.
 */
function unwrap(node: AstNode | undefined): AstNode | undefined {
    let cur = node;
    while (
        cur !== undefined &&
        [
            'ParenthesizedExpression',
            'TSNonNullExpression',
            'TSAsExpression',
            'TSSatisfiesExpression',
        ].includes(cur.type)
    ) {
        cur = nodeAt(cur, 'expression');
    }
    return cur;
}

function isLogCall(node: AstNode): boolean {
    const callee = nodeAt(node, 'callee');
    const object = nodeAt(callee, 'object');
    const property = nodeAt(callee, 'property');
    return (
        node.type === 'CallExpression' &&
        callee?.type === 'MemberExpression' &&
        str(object, 'name') === 'console' &&
        LOG_METHODS.has(str(property, 'name') ?? '')
    );
}

/* ------------------------------------------------------------------ */
/* 파일 범위: 호출 이름을 목록의 함수로 해석한다                           */
/* ------------------------------------------------------------------ */

interface FileScope {
    /** 로컬 경로(`@/…`·상대)의 이름 있는 import: local → imported. 패키지 import는 넣지 않는다. */
    readonly localImports: ReadonlyMap<string, string>;
    /** import가 아닌 바인딩(매개변수·변수·함수·클래스·catch 매개변수·기본/네임스페이스/패키지 import)의 선언 횟수. */
    readonly bindingCounts: ReadonlyMap<string, number>;
    /** `const f = () => …`/`const f = function …`로 선언된 이름. */
    readonly constFunctions: ReadonlySet<string>;
    /** 값이 다시 대입되는 이름. */
    readonly reassigned: ReadonlySet<string>;
    /** 같은 파일의 `const NAME = '문자열'`. */
    readonly consts: ReadonlyMap<string, string>;
}

function patternNames(node: AstNode | undefined): string[] {
    if (node === undefined) return [];
    switch (node.type) {
        case 'Identifier':
            return [str(node, 'name') ?? ''];
        case 'ObjectPattern':
            return listAt(node, 'properties').flatMap(p =>
                p.type === 'RestElement'
                    ? patternNames(nodeAt(p, 'argument'))
                    : patternNames(nodeAt(p, 'value'))
            );
        case 'ArrayPattern':
            return listAt(node, 'elements').flatMap(patternNames);
        case 'AssignmentPattern':
            return patternNames(nodeAt(node, 'left'));
        case 'RestElement':
            return patternNames(nodeAt(node, 'argument'));
        case 'TSParameterProperty':
            return patternNames(nodeAt(node, 'parameter'));
        default:
            return [];
    }
}

function isLocalSource(source: string): boolean {
    return source.startsWith('@/') || source.startsWith('.');
}

function fileScope(program: AstNode): FileScope {
    const localImports = new Map<string, string>();
    const bindingCounts = new Map<string, number>();
    const constFunctions = new Set<string>();
    const reassigned = new Set<string>();
    const consts = new Map<string, string>();
    const bind = (name: string | undefined): void => {
        if (name !== undefined && name !== '') {
            bindingCounts.set(name, (bindingCounts.get(name) ?? 0) + 1);
        }
    };
    walk(program, (node, ancestors) => {
        if (node.type === 'ImportDeclaration') {
            const local = isLocalSource(
                str(nodeAt(node, 'source'), 'value') ?? ''
            );
            listAt(node, 'specifiers').forEach(spec => {
                const name = str(nodeAt(spec, 'local'), 'name');
                const imported = nodeAt(spec, 'imported');
                const importedName =
                    str(imported, 'name') ?? str(imported, 'value');
                if (
                    local &&
                    spec.type === 'ImportSpecifier' &&
                    name !== undefined &&
                    importedName !== undefined
                ) {
                    localImports.set(name, importedName);
                } else {
                    bind(name);
                }
            });
        }
        if (node.type === 'VariableDeclarator') {
            const id = nodeAt(node, 'id');
            const names = patternNames(id);
            names.forEach(bind);
            const init = nodeAt(node, 'init');
            const parent = ancestors[ancestors.length - 1];
            if (
                id?.type === 'Identifier' &&
                parent?.type === 'VariableDeclaration' &&
                parent.kind === 'const' &&
                init !== undefined &&
                ['ArrowFunctionExpression', 'FunctionExpression'].includes(
                    init.type
                )
            ) {
                constFunctions.add(str(id, 'name') ?? '');
            }
            if (id?.type === 'Identifier' && init?.type === 'StringLiteral') {
                consts.set(str(id, 'name') ?? '', str(init, 'value') ?? '');
            }
        }
        if (node.type === 'AssignmentExpression') {
            patternNames(nodeAt(node, 'left')).forEach(n => reassigned.add(n));
        }
        if (node.type === 'UpdateExpression') {
            patternNames(nodeAt(node, 'argument')).forEach(n =>
                reassigned.add(n)
            );
        }
        if (
            node.type === 'ClassDeclaration' ||
            node.type === 'ClassExpression'
        ) {
            bind(str(nodeAt(node, 'id'), 'name'));
        }
        if (node.type === 'CatchClause') {
            patternNames(nodeAt(node, 'param')).forEach(bind);
        }
        if (isFunctionLike(node)) {
            bind(str(nodeAt(node, 'id'), 'name'));
            listAt(node, 'params').flatMap(patternNames).forEach(bind);
        }
    });
    return { localImports, bindingCounts, constFunctions, reassigned, consts };
}

/** `call`의 callee가 이 파일에서 `safe`에 든 함수로 해석되는가. */
function resolvesToSafe(
    call: AstNode,
    scope: FileScope,
    safe: ReadonlySet<string>
): boolean {
    const callee = nodeAt(call, 'callee');
    if (callee?.type === 'Identifier') {
        const name = str(callee, 'name') ?? '';
        const imported = scope.localImports.get(name);
        if (imported !== undefined) {
            return !scope.bindingCounts.has(name) && safe.has(imported);
        }
        return (
            scope.constFunctions.has(name) &&
            scope.bindingCounts.get(name) === 1 &&
            !scope.reassigned.has(name) &&
            safe.has(name)
        );
    }
    return false;
}

/* ------------------------------------------------------------------ */
/* 로그 문구                                                            */
/* ------------------------------------------------------------------ */

/** 정적 문구 조각. `null`은 `${}` 슬롯이나 문자열이 아닌 피연산자(값을 모른다). */
type Piece = string | null;

function piecesOf(
    node: AstNode | undefined,
    consts: ReadonlyMap<string, string>
): Piece[] {
    if (node === undefined) return [null];
    if (node.type === 'StringLiteral') return [str(node, 'value') ?? ''];
    if (node.type === 'Identifier') {
        return [consts.get(str(node, 'name') ?? '') ?? null];
    }
    if (node.type === 'TemplateLiteral') {
        const quasis = listAt(node, 'quasis').map(q => {
            // `value`는 `type`이 없는 평범한 객체라 `nodeAt`으로 읽을 수 없다.
            const value = q.value as { cooked?: string; raw?: string };
            return value.cooked ?? value.raw ?? '';
        });
        const slots = listAt(node, 'expressions');
        return quasis.flatMap((q, i) => [
            ...(i === 0 ? [] : piecesOf(slots[i - 1], consts)),
            q,
        ]);
    }
    if (node.type === 'BinaryExpression' && str(node, 'operator') === '+') {
        return [
            ...piecesOf(nodeAt(node, 'left'), consts),
            ...piecesOf(nodeAt(node, 'right'), consts),
        ];
    }
    return [null];
}

/** 로그 첫 인자의 고정 조각들. 조각 사이는 슬롯 하나씩이다(`[a, b]` = `a${}b`). */
function logParts(
    call: AstNode,
    consts: ReadonlyMap<string, string>
): string[] {
    return piecesOf(listAt(call, 'arguments')[0], consts).reduce<string[]>(
        (parts, piece) =>
            piece === null
                ? [...parts, '']
                : [...parts.slice(0, -1), `${parts[parts.length - 1]}${piece}`],
        ['']
    );
}

function escapeRe(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SLOT = '[\\w:-]+';

/** 고정 글자 하나하나와 슬롯을 "여기서 끝나도 된다" 중첩 선택으로 이어 붙인 정규식 원문. */
function prefixTolerant(fragments: readonly string[]): string {
    return fragments.reduceRight((acc, f) => `(?:${f}${acc})?`, '');
}

/** 슬롯 문구로 인정하려면 고정 글자(단어 문자)가 이만큼은 있어야 한다(`alarmFilterPhrases`와 같은 기준). */
const MIN_FIXED_WORD_CHARS = 6;

interface Fragment {
    readonly source: string;
    /** 용어가 반드시 소비해야 하는 조각인가(아니면 "여기서 끝나도 된다"). */
    readonly mandatory: boolean;
}

/**
 * 첫 조각 뒤의 조각들을 정규식 조각으로 편다. 단어 문자가 든 마지막 조각 `L`의 첫 단어 문자까지는
 * 필수고(용어가 슬롯에서만 끝나거나 `L`의 구두점에서만 끝나면 문구를 만든다고 보지 않는다), 그 뒤와
 * `L` 뒤의 꼬리 데이터는 어디서 끝나도 된다. `L`이 없으면 전부 선택이다.
 */
function tailFragments(rest: readonly string[]): Fragment[] {
    const last = rest.reduce(
        (found, piece, i) => (/\w/.test(piece) ? i : found),
        -1
    );
    return rest.flatMap((piece, i) => {
        const firstWord = piece.search(/\w/);
        return [
            { source: SLOT, mandatory: i <= last },
            ...[...piece].map((c, j) => ({
                source: escapeRe(c),
                mandatory: i < last || (i === last && j <= firstWord),
            })),
        ];
    });
}

/**
 * 로그 문구(`parts`, 사이는 슬롯)가 필터 용어를 만들 수 있는가. 슬롯은 `[\w:-]+`로 본다.
 * 용어는 로그 문구의 **어느 글자에서 시작해도** 되고(첫 조각 안), 슬롯 뒤에서는 위 `tailFragments`
 * 규칙으로 끝난다. 첫 조각이 비면(슬롯으로 시작) 아무 문구에나 맞으므로 일치로 보지 않고, 고정 글자가
 * 너무 적은 템플릿(`[${x}] `)도 일치로 보지 않는다.
 */
export function logCanProduce(parts: readonly string[], term: string): boolean {
    const [first, ...rest] = parts;
    if (first === '' || term === '') return false;
    if (rest.length === 0) return first.includes(term);
    const tail = tailFragments(rest);
    const mandatory = tail.filter(f => f.mandatory).map(f => f.source);
    const optional = tail.filter(f => !f.mandatory).map(f => f.source);
    const pattern = new RegExp(
        `^${mandatory.join('')}${prefixTolerant(optional)}$`
    );
    return [...first].some((_, k) => {
        const head = first.slice(k);
        if (head.startsWith(term)) return true;
        if (!term.startsWith(head)) return false;
        if (parts.join('').replace(/\W/g, '').length < MIN_FIXED_WORD_CHARS) {
            return false;
        }
        return pattern.test(term.slice(head.length));
    });
}

/* ------------------------------------------------------------------ */
/* 로그 위치 찾기                                                        */
/* ------------------------------------------------------------------ */

export interface LogSite {
    readonly file: string;
    readonly line: number;
    /** 로그 호출 노드의 소스 범위(반증용 변형이 이 범위를 감싼다). */
    readonly start: number;
    readonly end: number;
    readonly term: string;
    /** 죽은 `.catch`/`.then` 안이면 그 이유, 아니면 `undefined`. */
    readonly deadReason: string | undefined;
}

export type DeadLogSite = LogSite & { readonly reason: string };

function lineOf(text: string, offset: number): number {
    return text.slice(0, offset).split('\n').length;
}

/** 소스 한 파일에서 `terms` 중 하나를 찍을 수 있는 `console.*` 호출을 전부 찾는다. */
export function findLogSites(
    file: string,
    text: string,
    program: AstNode,
    terms: readonly string[],
    safe: ReadonlySet<string>
): LogSite[] {
    const scope = fileScope(program);
    const sites: LogSite[] = [];
    walk(program, (node, ancestors) => {
        if (!isLogCall(node)) return;
        const parts = logParts(node, scope.consts);
        const matched = terms.filter(term => logCanProduce(parts, term));
        if (matched.length === 0) return;
        const deadReason = deadReasonOf(node, ancestors, scope, safe);
        const start = numAt(node, 'start');
        const end = numAt(node, 'end');
        matched.forEach(term =>
            sites.push({
                file,
                line: lineOf(text, start),
                start,
                end,
                term,
                deadReason,
            })
        );
    });
    return sites;
}

/** `findLogSites` 중 죽은 것(목록의 함수에 바로 붙은 `.catch`/`.then`의 `onRejected` 안). */
export function findDeadLogSites(
    file: string,
    text: string,
    program: AstNode,
    terms: readonly string[],
    safe: ReadonlySet<string>
): DeadLogSite[] {
    return findLogSites(file, text, program, terms, safe).flatMap(site =>
        site.deadReason === undefined
            ? []
            : [{ ...site, reason: site.deadReason }]
    );
}

/**
 * 문구를 모르는 로그(첫 조각이 비어 있다: 첫 인자가 알 수 없는 값이거나 템플릿이 슬롯으로 시작한다)가
 * 죽은 `.catch`/`.then` 안에 있는 곳. 어떤 용어를 찍는지 모르므로 알람 문구일 수 있다고 보고 `file:line`으로 낸다.
 */
export function findOpaqueDeadLogs(
    file: string,
    text: string,
    program: AstNode,
    safe: ReadonlySet<string>
): string[] {
    const scope = fileScope(program);
    const found: string[] = [];
    walk(program, (node, ancestors) => {
        if (!isLogCall(node) || listAt(node, 'arguments').length === 0) return;
        if (logParts(node, scope.consts)[0] !== '') return;
        if (deadReasonOf(node, ancestors, scope, safe) !== undefined) {
            found.push(`${file}:${lineOf(text, numAt(node, 'start'))}`);
        }
    });
    return found;
}

/** 로그가 목록의 함수에 바로 붙은 `.catch(cb)`/`.then(_, cb)`의 `cb` 안에 있으면 이유를, 아니면 `undefined`. */
function deadReasonOf(
    log: AstNode,
    ancestors: readonly AstNode[],
    scope: FileScope,
    safe: ReadonlySet<string>
): string | undefined {
    const chain = [...ancestors, log];
    for (let i = chain.length - 1; i > 0; i -= 1) {
        const fn = chain[i];
        const call = chain[i - 1];
        if (
            !isFunctionLike(fn) ||
            call.type !== 'CallExpression' ||
            !listAt(call, 'arguments').includes(fn)
        ) {
            continue;
        }
        const callee = nodeAt(call, 'callee');
        if (callee?.type !== 'MemberExpression') continue;
        const prop = str(nodeAt(callee, 'property'), 'name');
        const onRejected =
            prop === 'catch'
                ? listAt(call, 'arguments')[0]
                : prop === 'then'
                  ? listAt(call, 'arguments')[1]
                  : undefined;
        const receiver = unwrap(nodeAt(callee, 'object'));
        if (
            onRejected === fn &&
            receiver?.type === 'CallExpression' &&
            resolvesToSafe(receiver, scope, safe)
        ) {
            return `\`.${prop}(...)\`가 절대 reject하지 않는 함수의 호출에 바로 붙어 있다`;
        }
    }
    return undefined;
}
