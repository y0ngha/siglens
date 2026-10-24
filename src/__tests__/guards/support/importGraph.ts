import { readFileSync } from 'node:fs';
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
 */

export const SRC = path.resolve(__dirname, '../../..');

export interface ImportEdge {
    /** `src/` 기준 상대경로. */
    from: string;
    to: string;
    /** `import type`, 또는 지정자 전부가 `type`인 import·재노출. 런타임에 사라진다. */
    typeOnly: boolean;
    /** `import('…')`. 모듈 평가 시점에 로드하지 않으므로 초기화 순환을 만들지 않는다. */
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

/**
 * 내부 지정자를 `src/` 기준 파일 경로로 바꾼다. 외부 패키지·비코드 자원이면
 * `undefined`, 내부 코드인데 파일을 찾지 못하면 `null`.
 */
function resolveSpecifier(
    specifier: string,
    fromRel: string,
    fileSet: ReadonlySet<string>
): string | null | undefined {
    if (NON_CODE_SPECIFIER.test(specifier)) return undefined;
    let base: string;
    if (specifier.startsWith('@/')) base = specifier.slice(2);
    else if (specifier.startsWith('.'))
        base = path.posix.normalize(
            path.posix.join(path.posix.dirname(fromRel), specifier)
        );
    else return undefined;
    // 쿼리 접미사(`?raw` 등)와 ESM식 `.js` 표기를 벗긴다.
    base = base.replace(/[?#].*$/, '').replace(/\.js$/, '');
    for (const suffix of RESOLVE_SUFFIXES)
        if (fileSet.has(base + suffix)) return base + suffix;
    return null;
}

interface SpecifierLike {
    type: string;
    importKind?: string | null;
    exportKind?: string | null;
}

/** 지정자가 하나 이상이고 전부 `type`이면 런타임에 사라진다(`import { type A }`). */
const allSpecifiersAreTypes = (specifiers: SpecifierLike[]): boolean =>
    specifiers.length > 0 &&
    specifiers.every(
        s =>
            (s.type === 'ImportSpecifier' || s.type === 'ExportSpecifier') &&
            (s.importKind === 'type' || s.exportKind === 'type')
    );

type AstNode = { type: string; [key: string]: unknown };

const isNode = (value: unknown): value is AstNode =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string';

function stringSource(node: unknown): string | null {
    return isNode(node) && node.type === 'StringLiteral'
        ? (node.value as string)
        : null;
}

/** 파일 하나의 import 지정자 목록. */
function extractImports(
    rel: string,
    source: string
): { specifier: string; typeOnly: boolean; dynamic: boolean }[] {
    const ast = parse(source, {
        sourceType: 'module',
        errorRecovery: true,
        attachComment: false,
        plugins: rel.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
    });
    const found: { specifier: string; typeOnly: boolean; dynamic: boolean }[] =
        [];
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (!isNode(node)) return;
        if (node.type === 'ImportDeclaration') {
            const specifier = stringSource(node.source);
            if (specifier)
                found.push({
                    specifier,
                    typeOnly:
                        node.importKind === 'type' ||
                        allSpecifiersAreTypes(
                            node.specifiers as SpecifierLike[]
                        ),
                    dynamic: false,
                });
        } else if (
            node.type === 'ExportNamedDeclaration' ||
            node.type === 'ExportAllDeclaration'
        ) {
            const specifier = stringSource(node.source);
            if (specifier)
                found.push({
                    specifier,
                    typeOnly:
                        node.exportKind === 'type' ||
                        allSpecifiersAreTypes(
                            (node.specifiers as SpecifierLike[] | undefined) ??
                                []
                        ),
                    dynamic: false,
                });
        } else if (node.type === 'ImportExpression') {
            const specifier = stringSource(node.source);
            if (specifier)
                found.push({ specifier, typeOnly: false, dynamic: true });
        } else if (
            node.type === 'CallExpression' &&
            isNode(node.callee) &&
            node.callee.type === 'Import'
        ) {
            const specifier = stringSource((node.arguments as unknown[])[0]);
            if (specifier)
                found.push({ specifier, typeOnly: false, dynamic: true });
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === 'loc' || key === 'start' || key === 'end') continue;
            if (typeof value === 'object' && value !== null) walk(value);
        }
    };
    walk(ast.program);
    return found;
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
    const edges: ImportEdge[] = [];
    const unresolved: string[] = [];
    for (const rel of files) {
        const source = readFileSync(path.join(SRC, rel), 'utf8');
        for (const { specifier, typeOnly, dynamic } of extractImports(
            rel,
            source
        )) {
            const to = resolveSpecifier(specifier, rel, fileSet);
            if (to === undefined) continue;
            if (to === null) {
                unresolved.push(`${rel} → ${specifier}`);
                continue;
            }
            if (to !== rel) edges.push({ from: rel, to, typeOnly, dynamic });
        }
    }
    cached = { files, edges, unresolved };
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
    const adjacency = new Map<string, string[]>();
    const seen = new Set<string>();
    for (const edge of edges) {
        const from = keyOf(edge.from);
        const to = keyOf(edge.to);
        if (from === null || to === null || from === to) continue;
        const key = `${from} -> ${to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const targets = adjacency.get(from) ?? [];
        targets.push(to);
        adjacency.set(from, targets);
    }
    const componentOf = new Map<string, number>();
    stronglyConnectedComponents(adjacency).forEach((component, index) =>
        component.forEach(node => componentOf.set(node, index))
    );
    return [...seen]
        .filter(key => {
            const [from, to] = key.split(' -> ') as [string, string];
            const component = componentOf.get(from);
            return component !== undefined && component === componentOf.get(to);
        })
        .sort();
}
