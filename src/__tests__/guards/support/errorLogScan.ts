import { parse } from '@babel/parser';

/**
 * `console.*`가 **잡은 에러 값을 가공 없이** 찍는 호출을 찾는 스캐너(`dbErrorLogRedaction` 가드가 쓴다).
 *
 * 규칙은 `SERVER.md#SA-26`이다. drizzle은 실패한 쿼리의 바인딩 파라미터를 에러 메시지에 넣으므로
 * `console.error(tag, error)`가 세션 토큰·해시·이메일을 로그로 보낸다.
 *
 * 에러 값을 담는 식별자는 셋이다.
 *   1. `catch (name)`이 묶는 이름과 `.catch(fn)`·`.then(_, fn)` 콜백의 첫 매개변수. 이름은 자유다.
 *   2. 이름이 `ERROR_NAME`에 드는 식별자(`error`, `err`, `e`, `reason`…). 헬퍼 함수 매개변수로 넘어온 에러
 *      (`function report(error)`)를 잡는다.
 *   3. `x.reason`(`Promise.allSettled` 거절 사유).
 * 호출 인자 안의 그런 값이 아래에 해당하지 않으면 "새는" 사용이다.
 *   - 허용 헬퍼 호출의 인자(`redactDbErrorForLog(e)`, `describeDbErrorForLog`, `readErrorCode`, `safeErrorFields`)
 *   - `e.name` / `e.code` / `e.status` 읽기, `typeof e`, `e instanceof X`
 *
 * 한계(가드가 **못 보는 것**): `Promise.allSettled` 결과에서 사유를 다른 변수로 꺼낸 뒤 찍는 경우, 에러를
 * 다른 이름의 변수에 옮긴 뒤 찍는 경우, 에러를 로거 함수(`deps.log(msg, error)`, `warnWithDetail`)에 넘기는
 * 경우, 에러 메시지를 새 문자열로 옮겨 담아 다시 던진 에러, `'use client'` 파일(서버 액션 호출 결과로 DB 에러를
 * 받을 수 없다고 보고 건너뛴다). 콘솔 메서드를 값으로 쓰는 별칭(`.catch(console.error)`)은 인식 실패로 센다.
 */
export const SANITIZERS: ReadonlySet<string> = new Set([
    'redactDbErrorForLog',
    'describeDbErrorForLog',
    'readErrorCode',
    'safeErrorFields',
]);

/** 에러를 담는 흔한 이름. 이 이름의 식별자는 어디서 묶였든 에러로 본다. */
const ERROR_NAME = /^(?:e|err|error|reason|cause|rejection)$/;

/** 읽어도 메시지·파라미터가 새지 않는 속성. */
const SAFE_PROPERTIES: ReadonlySet<string> = new Set([
    'name',
    'code',
    'status',
]);

const CONSOLE_METHODS: ReadonlySet<string> = new Set([
    'error',
    'warn',
    'log',
    'info',
    'debug',
    'trace',
]);

type Node = {
    type: string;
    start: number;
    end: number;
    [key: string]: unknown;
};

const isNode = (value: unknown): value is Node =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string';

export interface ErrorLogSite {
    /** 1부터 센 `console` 호출의 줄. */
    line: number;
    /** 첫 인자의 원문(문자열이면 따옴표 포함). 허용 목록의 키다. */
    tag: string;
    /** 가공 없이 에러 값을 찍는다. */
    leaking: boolean;
    /** 호출 안의 에러 식별자 위치(소스 오프셋). 새는 것만. */
    leakingRanges: readonly {
        start: number;
        end: number;
        /** `{ error }` 줄임 속성. 값을 감싸려면 `error: helper(error)`로 풀어 써야 한다. */
        shorthand: boolean;
    }[];
    /** 호출 안의 허용 헬퍼 호출 위치. 시험이 이것을 벗겨 가드가 다시 잡는지 본다. */
    sanitizerCalls: readonly {
        start: number;
        end: number;
        argStart: number;
        argEnd: number;
    }[];
}

export interface ErrorLogScan {
    sites: readonly ErrorLogSite[];
    /** 인식하지 못한 형태(TE-63). 비어 있어야 한다. */
    unparsed: readonly string[];
    directive: 'use client' | 'use server' | null;
}

const children = (node: Node): Node[] =>
    Object.entries(node)
        .filter(([key]) => key !== 'loc')
        .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
        .filter(isNode);

const calleeName = (node: Node): string | null => {
    const callee = node.callee;
    return isNode(callee) && callee.type === 'Identifier'
        ? (callee.name as string)
        : null;
};

const isConsoleCall = (node: Node): boolean => {
    const callee = node.callee;
    return (
        node.type === 'CallExpression' &&
        isNode(callee) &&
        callee.type === 'MemberExpression' &&
        isNode(callee.object) &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'console'
    );
};

/** `.catch(fn)`·`.then(_, fn)`의 `fn`. */
const rejectionHandlers = (node: Node): Node[] => {
    const callee = node.callee;
    if (
        node.type !== 'CallExpression' ||
        !isNode(callee) ||
        callee.type !== 'MemberExpression' ||
        !isNode(callee.property)
    )
        return [];
    const args = (node.arguments as unknown[]).filter(isNode);
    const method = callee.property.name;
    if (method === 'catch') return args.slice(0, 1);
    if (method === 'then') return args.slice(1, 2);
    return [];
};

const firstParamName = (fn: Node): string[] => {
    const params = fn.params;
    const first = Array.isArray(params) ? params[0] : undefined;
    return isNode(first) && first.type === 'Identifier'
        ? [first.name as string]
        : [];
};

/** 첫 매개변수가 식별자가 아닌(구조분해·기본값) 거절 핸들러. 어떤 이름이 에러인지 알 수 없다(TE-63). */
const unparsedHandlerParam = (fn: Node): boolean => {
    const params = fn.params;
    const first = Array.isArray(params) ? params[0] : undefined;
    return isNode(first) && first.type !== 'Identifier';
};

const sliceTag = (source: string, call: Node): string => {
    const first = (call.arguments as unknown[]).find(isNode);
    return first ? source.slice(first.start, first.end) : '';
};

/**
 * `target`(호출 인자 하위 식별자)가 안전한 위치인지. `ancestors`는 호출 인자부터 식별자 부모까지다.
 */
const isSafeUse = (target: Node, ancestors: readonly Node[]): boolean =>
    ancestors.some((ancestor, index) => {
        const below = ancestors[index + 1] ?? target;
        if (ancestor.type === 'CallExpression') {
            const name = calleeName(ancestor);
            return (
                name !== null &&
                SANITIZERS.has(name) &&
                (ancestor.arguments as unknown[]).includes(below)
            );
        }
        if (ancestor.type === 'MemberExpression') {
            const property = ancestor.property;
            return (
                ancestor.object === below &&
                ancestor.computed !== true &&
                isNode(property) &&
                property.type === 'Identifier' &&
                SAFE_PROPERTIES.has(property.name as string)
            );
        }
        if (ancestor.type === 'UnaryExpression')
            return ancestor.operator === 'typeof';
        if (ancestor.type === 'BinaryExpression')
            return ancestor.operator === 'instanceof';
        return false;
    });

interface Use {
    node: Node;
    ancestors: Node[];
    shorthand: boolean;
}

const errorUses = (
    node: Node,
    bound: ReadonlySet<string>,
    ancestors: Node[] = []
): Use[] => {
    if (node.type === 'Identifier') {
        const name = node.name as string;
        return bound.has(name) || ERROR_NAME.test(name)
            ? [
                  {
                      node,
                      ancestors,
                      shorthand:
                          ancestors[ancestors.length - 1]?.shorthand === true,
                  },
              ]
            : [];
    }
    const next = [...ancestors, node];
    if (node.type === 'MemberExpression') {
        const object = node.object;
        const property = node.property;
        // `Promise.allSettled` 결과의 거절 사유(`outcome.reason`)도 에러 값이다.
        if (
            node.computed !== true &&
            isNode(property) &&
            property.name === 'reason'
        )
            return [{ node, ancestors, shorthand: false }];
        return [
            ...(isNode(object) ? errorUses(object, bound, next) : []),
            ...(node.computed === true && isNode(property)
                ? errorUses(property, bound, next)
                : []),
        ];
    }
    if (node.type === 'ObjectProperty') {
        const value = node.value;
        const key = node.key;
        return [
            ...(node.computed === true && isNode(key)
                ? errorUses(key, bound, next)
                : []),
            ...(isNode(value) ? errorUses(value, bound, next) : []),
        ];
    }
    return children(node).flatMap(child => errorUses(child, bound, next));
};

const sanitizerCallsIn = (node: Node): Node[] => [
    ...(node.type === 'CallExpression' &&
    calleeName(node) !== null &&
    SANITIZERS.has(calleeName(node) as string)
        ? [node]
        : []),
    ...children(node).flatMap(sanitizerCallsIn),
];

const lineOf = (source: string, offset: number): number =>
    source.slice(0, offset).split('\n').length;

interface Walk {
    sites: ErrorLogSite[];
    unparsed: string[];
}

const walk = (source: string, node: Node, bound: ReadonlySet<string>): Walk => {
    const empty: Walk = { sites: [], unparsed: [] };
    const merge = (parts: Walk[]): Walk => ({
        sites: parts.flatMap(part => part.sites),
        unparsed: parts.flatMap(part => part.unparsed),
    });

    if (node.type === 'CatchClause') {
        const param = node.param;
        const body = node.body;
        const names =
            isNode(param) && param.type === 'Identifier'
                ? [param.name as string]
                : [];
        const unparsed =
            isNode(param) && param.type !== 'Identifier'
                ? [
                      `줄 ${lineOf(source, node.start)}: catch 매개변수가 식별자가 아니다(${param.type})`,
                  ]
                : [];
        const inner = isNode(body)
            ? walk(source, body, new Set([...bound, ...names]))
            : empty;
        return {
            sites: inner.sites,
            unparsed: [...unparsed, ...inner.unparsed],
        };
    }

    const handlerNames = rejectionHandlers(node).flatMap(firstParamName);
    const scoped =
        handlerNames.length > 0 ? new Set([...bound, ...handlerNames]) : bound;
    const handlerUnparsed = rejectionHandlers(node)
        .filter(unparsedHandlerParam)
        .map(
            fn =>
                `줄 ${lineOf(source, fn.start)}: 거절 핸들러의 첫 매개변수가 식별자가 아니다`
        );

    if (isConsoleCall(node)) {
        const callee = node.callee as Node;
        const property = callee.property;
        const method =
            isNode(property) && property.type === 'Identifier'
                ? (property.name as string)
                : null;
        if (callee.computed === true || method === null) {
            return {
                sites: [],
                unparsed: [
                    `줄 ${lineOf(source, node.start)}: 계산된 console 접근`,
                ],
            };
        }
        const args = (node.arguments as unknown[]).filter(isNode);
        const uses = args.flatMap(arg => errorUses(arg, scoped));
        const leaking = uses.filter(use => !isSafeUse(use.node, use.ancestors));
        const nested = args.map(arg => walk(source, arg, scoped));
        const site: ErrorLogSite[] =
            CONSOLE_METHODS.has(method) && uses.length > 0
                ? [
                      {
                          line: lineOf(source, node.start),
                          tag: sliceTag(source, node),
                          leaking: leaking.length > 0,
                          leakingRanges: leaking.map(use => ({
                              start: use.node.start,
                              end: use.node.end,
                              shorthand: use.shorthand,
                          })),
                          sanitizerCalls: args
                              .flatMap(sanitizerCallsIn)
                              .map(call => {
                                  const arg = (
                                      call.arguments as unknown[]
                                  ).find(isNode);
                                  return {
                                      start: call.start,
                                      end: call.end,
                                      argStart: arg?.start ?? call.start,
                                      argEnd: arg?.end ?? call.end,
                                  };
                              }),
                      },
                  ]
                : [];
        const inner = merge(nested);
        return {
            sites: [...site, ...inner.sites],
            unparsed: inner.unparsed,
        };
    }

    // `.catch(console.error)`처럼 console 메서드를 값으로 넘기거나 변수에 담는 형태.
    const valueUse = children(node).filter(
        child =>
            child.type === 'MemberExpression' &&
            isNode(child.object) &&
            child.object.type === 'Identifier' &&
            child.object.name === 'console' &&
            !(node.type === 'CallExpression' && node.callee === child)
    );
    const aliasUnparsed = valueUse.map(
        child =>
            `줄 ${lineOf(source, child.start)}: console 메서드를 값으로 쓴다`
    );

    const inner = merge(
        children(node).map(child => walk(source, child, scoped))
    );
    return {
        sites: inner.sites,
        unparsed: [...handlerUnparsed, ...aliasUnparsed, ...inner.unparsed],
    };
};

export function scanErrorLogs(source: string, rel: string): ErrorLogScan {
    const ast = parse(source, {
        sourceType: 'module',
        errorRecovery: true,
        attachComment: false,
        plugins: rel.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
    });
    const directives = ast.program.directives.map(d => d.value.value);
    const result = walk(source, ast.program as unknown as Node, new Set());
    return {
        sites: result.sites,
        unparsed: [
            ...(ast.errors ?? []).map(error => `파싱 오류: ${error.message}`),
            ...result.unparsed,
        ],
        directive: directives.includes('use client')
            ? 'use client'
            : directives.includes('use server')
              ? 'use server'
              : null,
    };
}
