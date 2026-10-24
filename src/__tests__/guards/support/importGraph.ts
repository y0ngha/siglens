import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

import { sourceFiles } from './controlUsage';

/**
 * 순환 import 가드가 쓰는 **파일 단위 import 그래프**.
 *
 * 정규식이 아니라 파서로 import를 뽑는다. 주석·문자열 안의 `import`를 의존으로
 * 세지 않고, `import type`/`export type`을 구조적으로 가려낼 수 있어서다
 * (`sourceScan.ts`가 같은 이유로 babel 파서를 쓴다). TypeScript 7 패키지는
 * 파서 JS API를 내보내지 않으므로 babel을 쓴다.
 *
 * 엣지 종류는 `TESTING.md#TE-41`을 따른다 —
 * `import … from`, `export … from` 재노출, 동적 `import()`를 모두 따라간다.
 * 각 엣지에 `typeOnly`·`dynamic`을 남겨 호출부가 그래프를 고른다.
 *
 * import 해석 규칙은 이 파일 한 곳에만 둔다. 순환 가드, 클라이언트 번들의 core 가드
 * (`coreClientGraph.ts`), 서버 전용 모듈 가드(`noServerOnlyInClientBundle`)가 모두
 * `fileImports`·`resolveImportPath`를 쓴다 — 가드마다 정규식 해석기를 두면 한 곳만
 * 고쳐져 판정이 갈린다.
 */

export const SRC = path.resolve(__dirname, '../../..');

export interface ImportEdge {
    /** `src/` 기준 상대경로. */
    from: string;
    to: string;
    /** `import type`, 또는 지정자 전부가 `type`인 import·재노출. 런타임에 사라진다. */
    typeOnly: boolean;
    /**
     * 모듈 평가 시점이 아니라 호출 시점에 로드된다: `import('…')` 또는 `require('…')`.
     * 이 저장소의 `require`는 프로바이더 선택처럼 함수 안에서만 쓰인다
     * (`shared/api/{market,economy,fmp}/get…Provider.ts`). 초기화 순환은 만들지 않지만
     * 슬라이스 결합에는 센다.
     */
    dynamic: boolean;
}

export interface ImportGraph {
    files: string[];
    edges: ImportEdge[];
    /**
     * `@/`·상대경로인데 파일로 해석하지 못한 지정자. 해석기가 깨지면 엣지가
     * 조용히 사라지고 순환도 함께 사라져 가드가 "통과"한다 — 그 상태를 이
     * 목록으로 드러낸다.
     */
    unresolved: string[];
    /**
     * babel이 오류를 복구하며 파싱한 파일. 복구된 AST에서는 노드가 빠질 수 있어 그
     * 파일의 import 엣지가 조용히 사라진다 — `unresolved`와 같은 이유로 드러낸다.
     */
    parseErrors: string[];
}

const isProductionSource = (rel: string): boolean =>
    /\.tsx?$/.test(rel) &&
    !rel.endsWith('.d.ts') &&
    !/(^|\/)__tests__\//.test(rel) &&
    !/(^|\/)__integration__\//.test(rel) &&
    !/\.(test|spec|stories)\.tsx?$/.test(rel);

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

/**
 * 코드가 아닌 자원(메시지 카탈로그 json, 전역 css 등). 다른 모듈을 import하지
 * 않으므로 순환을 만들 수 없다 — 그래프에 넣지 않는다.
 */
const NON_CODE_SPECIFIER = /\.(json|css|scss|svg|png|jpe?g|webp|md)([?#].*)?$/;

/** `@/`·상대경로를 절대 경로로 바꾼다(확장자 미정). 외부 패키지면 `undefined`. */
const internalBase = (
    specifier: string,
    fromFile: string
): string | undefined =>
    specifier.startsWith('@/')
        ? path.join(SRC, specifier.slice(2))
        : specifier.startsWith('.')
          ? path.resolve(path.dirname(fromFile), specifier)
          : undefined;

const directoryEntries = new Map<string, ReadonlySet<string> | null>();

/** 디렉터리의 실제 항목 이름(대소문자 그대로). 없는 디렉터리면 `null`. 실행 중 캐시한다. */
function entriesOf(directory: string): ReadonlySet<string> | null {
    const hit = directoryEntries.get(directory);
    if (hit !== undefined) return hit;
    let entries: ReadonlySet<string> | null;
    try {
        entries = new Set(readdirSync(directory));
    } catch {
        entries = null;
    }
    directoryEntries.set(directory, entries);
    return entries;
}

/**
 * 경로의 **모든 구간**이 대소문자까지 실제와 같은 소스 파일인가. `existsSync`는 macOS처럼
 * 대소문자를 가리지 않는 파일시스템에서 `./Foo`를 `foo.ts`로 통과시켜, 리눅스 CI에서야
 * 깨지는 import가 로컬에서 해석 성공으로 보였다. 디렉터리 목록은 캐시해 syscall도 줄인다.
 */
function isSourceFile(candidate: string): boolean {
    if (!/\.tsx?$/.test(candidate)) return false;
    const anchor = path.parse(candidate).root;
    const segments = path.relative(anchor, candidate).split(path.sep);
    return segments.every(
        (segment, index) =>
            entriesOf(path.join(anchor, ...segments.slice(0, index)))?.has(
                segment
            ) === true
    );
}

/**
 * `fromFile`(절대 경로)의 지정자가 가리키는 소스 파일의 절대 경로. 외부 패키지·비코드
 * 자원이면 `undefined`, 내부 코드인데 파일을 찾지 못하면 `null`.
 *
 * 파일 목록이 아니라 실제 파일 존재로 판정한다 — `src/` 밖의 임시 픽스처로 검출기를
 * 시험하는 가드(`aiChatCoreFree`)도 같은 규칙을 탄다.
 */
export function resolveImportPath(
    specifier: string,
    fromFile: string
): string | null | undefined {
    if (NON_CODE_SPECIFIER.test(specifier)) return undefined;
    const raw = internalBase(specifier, fromFile);
    if (raw === undefined) return undefined;
    // 쿼리 접미사(`?raw` 등)와 ESM식 `.js` 표기를 벗긴다.
    const base = raw.replace(/[?#].*$/, '').replace(/\.js$/, '');
    return (
        RESOLVE_SUFFIXES.map(suffix => base + suffix).find(isSourceFile) ?? null
    );
}

type AstNode = { type: string; [key: string]: unknown };

const isNode = (value: unknown): value is AstNode =>
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string';

const stringSource = (node: unknown): string | null =>
    isNode(node) &&
    node.type === 'StringLiteral' &&
    typeof node.value === 'string'
        ? node.value
        : null;

/** 지정자가 하나 이상이고 전부 `type`이면 런타임에 사라진다(`import { type A }`). */
const allSpecifiersAreTypes = (specifiers: unknown): boolean =>
    Array.isArray(specifiers) &&
    specifiers.length > 0 &&
    specifiers.every(
        s =>
            isNode(s) &&
            (s.type === 'ImportSpecifier' || s.type === 'ExportSpecifier') &&
            (s.importKind === 'type' || s.exportKind === 'type')
    );

/** 호출식이 모듈을 불러오는 형태면 그 종류, 아니면 `null`. */
const loadCallKind = (callee: unknown): 'import()' | 'require' | null =>
    !isNode(callee)
        ? null
        : callee.type === 'Import'
          ? 'import()'
          : callee.type === 'Identifier' && callee.name === 'require'
            ? 'require'
            : null;

export interface ImportRecord {
    specifier: string;
    typeOnly: boolean;
    /** 평가 시점이 늦다(`import()`·`require()`). {@link ImportEdge.dynamic}과 같다. */
    dynamic: boolean;
    /**
     * 번들러가 별도 청크로 떼어 내는가(`import()`만). 동기 `require()`는 평가는 늦어도
     * 같은 청크에 실린다 — 번들 구성을 보는 가드는 `dynamic`이 아니라 이것을 본다.
     */
    lazyChunk: boolean;
}

/** 노드 하나가 만드는 import 기록(없으면 빈 배열). */
function recordOf(node: AstNode): ImportRecord[] {
    const record = (
        specifier: string | null,
        typeOnly: boolean,
        kind: 'static' | 'import()' | 'require'
    ): ImportRecord[] =>
        specifier
            ? [
                  {
                      specifier,
                      typeOnly,
                      dynamic: kind !== 'static',
                      lazyChunk: kind === 'import()',
                  },
              ]
            : [];
    switch (node.type) {
        case 'ImportDeclaration':
            return record(
                stringSource(node.source),
                node.importKind === 'type' ||
                    allSpecifiersAreTypes(node.specifiers),
                'static'
            );
        case 'ExportNamedDeclaration':
        case 'ExportAllDeclaration':
            return record(
                stringSource(node.source),
                node.exportKind === 'type' ||
                    allSpecifiersAreTypes(node.specifiers),
                'static'
            );
        case 'ImportExpression':
            return record(stringSource(node.source), false, 'import()');
        case 'CallExpression': {
            const kind = loadCallKind(node.callee);
            return kind && Array.isArray(node.arguments)
                ? record(stringSource(node.arguments[0]), false, kind)
                : [];
        }
        default:
            return [];
    }
}

const POSITION_KEYS = new Set(['loc', 'start', 'end']);

const childrenOf = (node: AstNode): unknown[] =>
    Object.entries(node)
        .filter(
            ([key, value]) =>
                !POSITION_KEYS.has(key) &&
                typeof value === 'object' &&
                value !== null
        )
        .flatMap(([, value]) => (Array.isArray(value) ? value : [value]));

const collectRecords = (node: unknown): ImportRecord[] =>
    isNode(node)
        ? [...recordOf(node), ...childrenOf(node).flatMap(collectRecords)]
        : [];

/** 파일 첫머리의 지시문. 주석 뒤에 와도 파서가 정확히 읽는다. */
export type FileDirective = 'use client' | 'use server' | null;

const directiveOf = (values: readonly string[]): FileDirective =>
    values.includes('use client')
        ? 'use client'
        : values.includes('use server')
          ? 'use server'
          : null;

/** 파일 하나의 import 지정자 목록, 지시문, 파싱 오류. */
export function extractImports(
    rel: string,
    source: string
): { records: ImportRecord[]; directive: FileDirective; errors: string[] } {
    const ast = parse(source, {
        sourceType: 'module',
        errorRecovery: true,
        attachComment: false,
        plugins: rel.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
    });
    return {
        records: collectRecords(ast.program),
        directive: directiveOf(
            ast.program.directives.map(directive => directive.value.value)
        ),
        errors: (ast.errors ?? []).map(error => error.message),
    };
}

export interface ResolvedImport extends ImportRecord {
    /** `resolveImportPath` 결과: 절대 경로, 외부(`undefined`), 해석 실패(`null`). */
    resolved: string | null | undefined;
}

export interface FileImports {
    directive: FileDirective;
    imports: ResolvedImport[];
    errors: string[];
}

const fileImportsCache = new Map<string, FileImports>();

/**
 * 파일(절대 경로) 하나를 파싱해 해석까지 마친 import 목록. 테스트 실행 중 파일은
 * 바뀌지 않으므로 경로별로 캐시한다 — 여러 가드가 같은 파일을 걷는다.
 */
export function fileImports(file: string): FileImports {
    const hit = fileImportsCache.get(file);
    if (hit) return hit;
    const { records, directive, errors } = extractImports(
        file,
        readFileSync(file, 'utf8')
    );
    const result: FileImports = {
        directive,
        imports: records.map(record => ({
            ...record,
            resolved: resolveImportPath(record.specifier, file),
        })),
        errors,
    };
    fileImportsCache.set(file, result);
    return result;
}

let cached: ImportGraph | null = null;

/** `src/` 프로덕션 소스 전체의 import 그래프. 테스트 실행 중 트리는 바뀌지 않으므로 캐시한다. */
export function buildImportGraph(): ImportGraph {
    if (cached) return cached;
    const files = sourceFiles(SRC)
        .map(file => path.relative(SRC, file).split(path.sep).join('/'))
        .filter(isProductionSource)
        .sort();
    const fileSet = new Set(files);
    const parsed = files.map(rel => ({
        rel,
        ...fileImports(path.join(SRC, rel)),
    }));
    const toRel = (absolute: string): string =>
        path.relative(SRC, absolute).split(path.sep).join('/');
    cached = {
        files,
        edges: parsed.flatMap(({ rel, imports }) =>
            imports.flatMap(({ resolved, typeOnly, dynamic }) =>
                typeof resolved === 'string' &&
                fileSet.has(toRel(resolved)) &&
                toRel(resolved) !== rel
                    ? [{ from: rel, to: toRel(resolved), typeOnly, dynamic }]
                    : []
            )
        ),
        // 해석 실패와 함께, 프로덕션 코드가 테스트·스토리 같은 그래프 밖 파일을 import하는
        // 경우도 드러낸다 — 그 엣지는 그래프에서 빠지고 그 파일을 거치는 순환도 사라진다.
        unresolved: parsed.flatMap(({ rel, imports }) =>
            imports.flatMap(({ specifier, resolved }) =>
                resolved === null
                    ? [`${rel} → ${specifier}`]
                    : typeof resolved === 'string' &&
                        !fileSet.has(toRel(resolved))
                      ? [`${rel} → ${specifier} (프로덕션 밖 파일)`]
                      : []
            )
        ),
        parseErrors: parsed.flatMap(({ rel, errors }) =>
            errors.map(message => `${rel}: ${message}`)
        ),
    };
    return cached;
}

/**
 * Tarjan 알고리즘으로 크기 2 이상의 강결합 성분(SCC)을 찾는다. SCC는 그래프
 * 불변량이라 "DFS가 처음 찾은 순환 경로"와 달리 탐색 순서에 흔들리지 않는다.
 * 재귀 대신 명시적 스택을 쓴다(노드가 수천 개다).
 */
export function stronglyConnectedComponents(
    adjacency: ReadonlyMap<string, readonly string[]>
): string[][] {
    // CONVENTIONS.md#CP-6 예외: Tarjan은 탐색 상태(번호·low-link·스택)를 한 번의 순회로
    // 갱신하는 O(V+E) 상태 기계다. 불변 형태로 쓰면 단계마다 상태를 복사해 O(V·E)가 된다.
    const nodes = new Set<string>();
    for (const [from, targets] of adjacency) {
        nodes.add(from);
        targets.forEach(to => nodes.add(to));
    }
    const discovery = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const components: string[][] = [];
    let counter = 0;

    for (const root of nodes) {
        if (discovery.has(root)) continue;
        // frame = [노드, 다음에 볼 이웃 인덱스]
        const callStack: [string, number][] = [[root, 0]];
        while (callStack.length > 0) {
            const frame = callStack[callStack.length - 1]!;
            const node = frame[0];
            if (frame[1] === 0 && !discovery.has(node)) {
                discovery.set(node, counter);
                low.set(node, counter);
                counter += 1;
                stack.push(node);
                onStack.add(node);
            }
            const neighbours = adjacency.get(node) ?? [];
            let descended = false;
            while (frame[1] < neighbours.length) {
                const next = neighbours[frame[1]]!;
                frame[1] += 1;
                if (!discovery.has(next)) {
                    callStack.push([next, 0]);
                    descended = true;
                    break;
                }
                if (onStack.has(next))
                    low.set(
                        node,
                        Math.min(low.get(node)!, discovery.get(next)!)
                    );
            }
            if (descended) continue;
            if (low.get(node) === discovery.get(node)) {
                const component: string[] = [];
                let popped: string;
                do {
                    popped = stack.pop()!;
                    onStack.delete(popped);
                    component.push(popped);
                } while (popped !== node);
                if (component.length > 1) components.push(component.sort());
            }
            callStack.pop();
            const parent = callStack[callStack.length - 1];
            if (parent)
                low.set(
                    parent[0],
                    Math.min(low.get(parent[0])!, low.get(node)!)
                );
        }
    }
    return components;
}

/**
 * 순환에 참여하는 엣지(양 끝이 같은 SCC)를 `"a -> b"`로 돌려준다.
 *
 * 지문을 SCC 구성원이 아니라 엣지로 삼는다. 구성원 목록은 무관한 파일 하나가
 * 순환에 들고 나기만 해도 통째로 바뀌지만, 엣지는 import 한 줄과 정확히
 * 대응해 그대로 "이 import를 끊어라"는 지시가 된다.
 *
 * `keyOf`로 노드를 묶는다(파일 그대로, 또는 슬라이스 단위). `null`이면 그 끝점의
 * 엣지를 버린다.
 */
export function cycleEdges(
    edges: readonly ImportEdge[],
    keyOf: (file: string) => string | null
): string[] {
    const pairs = new Map(
        edges.flatMap((edge): [string, [string, string]][] => {
            const from = keyOf(edge.from);
            const to = keyOf(edge.to);
            return from === null || to === null || from === to
                ? []
                : [[`${from} -> ${to}`, [from, to]]];
        })
    );
    // CONVENTIONS.md#CP-6 예외: 출발 노드별로 묶는 일을 filter로 하면 노드마다 엣지 전체를
    // 다시 훑어 O(V·E)다. 한 번 훑으며 목록에 붙인다.
    const adjacency = new Map<string, string[]>();
    for (const [from, to] of pairs.values()) {
        const targets = adjacency.get(from);
        if (targets) targets.push(to);
        else adjacency.set(from, [to]);
    }
    const componentOf = new Map(
        stronglyConnectedComponents(adjacency).flatMap((component, index) =>
            component.map((node): [string, number] => [node, index])
        )
    );
    return [...pairs]
        .filter(([, [from, to]]) => {
            const component = componentOf.get(from);
            return component !== undefined && component === componentOf.get(to);
        })
        .map(([key]) => key)
        .sort();
}
