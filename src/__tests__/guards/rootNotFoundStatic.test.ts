import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 루트 404(`src/app/not-found.tsx`)의 **import 그래프 전체**가 요청 API를 쓰지 않는다.
 *
 * 이 경계는 모든 라우트 트리의 일부로 함께 렌더된다. 그래프 어디서든 `headers()`·`cookies()`·
 * `connection()`을 부르면 ISR/정적 페이지 전부가 런타임에 "static에서 dynamic으로 바뀌었다"며
 * 500이 된다(`Page changed from static to dynamic at runtime /ko/AAPL, reason: headers` —
 * e2e 실측). 루트 404는 로케일·호스트를 서버에서 읽는 대신 클라이언트 섬이 주소로 알아낸다
 * (`NotFoundView`). jsdom 단위 테스트로는 이 500을 재현할 수 없어서 소스를 직접 고정한다.
 *
 * 파일 몇 개만 보면 새 import 한 줄이 끌어오는 요청 API를 놓친다. 그래서 진입점에서 정적·동적
 * import를 모두 따라간다.
 */

const SRC = path.resolve(__dirname, '../..');
const ENTRY = path.join(SRC, 'app/not-found.tsx');

const IMPORT_RE =
    /(?:import|export)\s+(?:type\s+)?[^'";]*?\s*from\s*'([^']+)'|import\s*'([^']+)'|import\(\s*'([^']+)'\s*\)/g;

function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(?<![:/])\/\/.*$/gm, '');
}

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

function specifierBase(spec: string, from: string): string | null {
    if (spec.startsWith('@/')) return path.join(SRC, spec.slice(2));
    return spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
}

function resolveSpecifier(spec: string, from: string): string | null {
    const base = specifierBase(spec, from);
    if (base === null) return null;
    return (
        RESOLVE_SUFFIXES.map(suffix => base + suffix).find(
            file => existsSync(file) && /\.(ts|tsx)$/.test(file)
        ) ?? null
    );
}

interface ImportEdge {
    readonly spec: string;
    readonly from: string;
    readonly resolved: string | null;
}

function importsOf(file: string): readonly ImportEdge[] {
    const code = stripComments(readFileSync(file, 'utf8'));
    return [...code.matchAll(IMPORT_RE)]
        .map(match => match[1] ?? match[2] ?? match[3])
        .filter((spec): spec is string => spec !== undefined)
        .map(spec => ({
            spec,
            from: file,
            resolved: resolveSpecifier(spec, file),
        }));
}

interface Graph {
    readonly files: readonly string[];
    readonly externalSpecifiers: ReadonlyMap<string, readonly string[]>;
}

interface Walk {
    readonly seen: ReadonlySet<string>;
    readonly edges: readonly ImportEdge[];
}

/** 깊이 우선으로 저장소 내부 import를 따라간다 — 이미 본 파일은 다시 열지 않는다. */
function walk(file: string, acc: Walk): Walk {
    if (acc.seen.has(file)) return acc;
    const edges = importsOf(file);
    const visited: Walk = {
        seen: new Set([...acc.seen, file]),
        edges: [...acc.edges, ...edges],
    };
    return edges
        .flatMap(edge => (edge.resolved === null ? [] : [edge.resolved]))
        .reduce((next, child) => walk(child, next), visited);
}

function collectGraph(entry: string): Graph {
    const { seen, edges } = walk(entry, { seen: new Set(), edges: [] });
    const external = edges
        .filter(edge => edge.resolved === null)
        .reduce<ReadonlyMap<string, readonly string[]>>(
            (map, edge) =>
                new Map(map).set(edge.spec, [
                    ...(map.get(edge.spec) ?? []),
                    edge.from,
                ]),
            new Map()
        );
    return { files: [...seen].toSorted(), externalSpecifiers: external };
}

const graph = collectGraph(ENTRY);
const rel = (file: string): string => path.relative(SRC, file);

describe('루트 404 import 그래프는 정적이다 — 요청 API 금지', () => {
    it('그래프가 비어 있지 않다(탐색이 깨지면 가드가 공회전한다)', () => {
        const files = graph.files.map(rel);
        expect(files).toContain('app/not-found.tsx');
        expect(files).toContain('app/_components/NotFoundView.tsx');
        expect(files).toContain('app/_components/NotFoundLayout.tsx');
        expect(files).toContain('app/_components/notFoundOverrides.ts');
        expect(files).toContain('shared/i18n/locationSurface.ts');
    });

    it('next/headers를 import하는 파일이 없다', () => {
        const importers = (graph.externalSpecifiers.get('next/headers') ?? [])
            .map(rel)
            .toSorted();
        expect(importers).toEqual([]);
    });

    it('next-intl/server의 요청 로케일 API를 쓰지 않는다 — getTranslations는 locale을 넘긴다', () => {
        // `getTranslations()`·`getLocale()` 등은 로케일을 인자로 받지 않으면 내부에서
        // `headers()`로 요청 로케일을 읽는다 — 위 `headers(` 검사로는 보이지 않는 경로다.
        const importers =
            graph.externalSpecifiers.get('next-intl/server') ?? [];
        const offenders = importers.flatMap(file => {
            const code = stripComments(readFileSync(file, 'utf8'));
            const banned = [
                ...code.matchAll(
                    /\b(getLocale|getMessages|getNow|getTimeZone|getFormatter|getRequestConfig)\b/g
                ),
            ].map(m => `${rel(file)}: ${m[1]}`);
            const calls = [...code.matchAll(/\bgetTranslations\(([^)]*)\)/g)];
            const missingLocale = calls
                .filter(m => !/\{[^}]*\blocale\b/.test(m[1]))
                .map(m => `${rel(file)}: getTranslations(${m[1]})`);
            return [...banned, ...missingLocale];
        });
        expect(importers.length).toBeGreaterThan(0);
        expect(offenders).toEqual([]);
    });

    it('headers()·cookies()·connection() 호출이 없다', () => {
        const offenders = graph.files
            .filter(file =>
                /\b(?:headers|cookies|connection)\(/.test(
                    stripComments(readFileSync(file, 'utf8'))
                )
            )
            .map(rel);
        expect(offenders).toEqual([]);
    });
});
