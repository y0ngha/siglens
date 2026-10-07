import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 규칙 문서를 가리키는 `FILE#ID` 참조는 실재하는 앵커로 풀려야 한다.
 *
 * 규칙은 `docs/conventions/*.md`와 `CLAUDE.md` 파일들에 안정 ID로 산다. 각 규칙
 * 제목 바로 위에 `<a id="CS-5"></a>` 앵커 줄이 있고, 코드 주석·에이전트 정의·CI
 * 워크플로는 `CONVENTIONS.md#CS-5`처럼 그 ID를 인용한다. ID는 재번호·재사용하지
 * 않으므로 참조가 끊기는 경로는 둘뿐이다 — 규칙을 지우고 인용을 남겼거나, 앵커
 * 없이 인용만 적었거나. 둘 다 이 가드가 잡는다.
 *
 * 참조 형식: 파일명만(`CONVENTIONS.md`, `TESTING.md` …)은 `docs/conventions/` 또는
 * 저장소 루트에서, 경로가 붙은 것(`src/app/CLAUDE.md`)은 저장소 루트 기준으로 푼다.
 *
 * 이 파일은 옛 `MISTAKES` 문서가 다시 규칙의 출처로 되살아나는 것도 막는다. 그
 * 문서는 규칙 문서로 해체됐고, 남은 언급은 모두 죽은 링크다. `CHANGELOG.md`(릴리스
 * 이력)는 스캔 대상이 아니다.
 */

const ROOT = path.resolve(__dirname, '../../..');

const SCAN_DIRS = [
    'src',
    'cache-handler',
    'e2e',
    'scripts',
    '.claude/agents',
    '.codex/agents',
    '.gemini',
    '.github',
    'docs/conventions',
    'skills',
];
const SCAN_ROOT_FILES = ['CLAUDE.md'];
const SCAN_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.mts',
    '.mjs',
    '.js',
    '.cjs',
    '.md',
    '.yml',
    '.yaml',
    '.toml',
    '.sh',
]);
const SKIP_DIRS = new Set([
    'node_modules',
    '.next',
    'coverage',
    '.git',
    'dist',
    'agent-memory',
]);

/** 이 가드 자신은 예시 문자열을 품고 있어 스캔에서 뺀다. */
const SELF = path.join(ROOT, 'src/__tests__/guards/ruleReferences.test.ts');

/** `FILE#ID` — ID는 대문자 접두사 + 번호(`CS-5`, `TE-12`). */
const REFERENCE_PATTERN =
    /((?:[\w.-]+\/)*[A-Za-z_]+\.md)#([A-Z][A-Z0-9]*-\d+)/g;
/**
 * 앵커 줄 바로 아래(빈 줄 허용)에 같은 ID를 단 제목이 와야 규칙 정의로 센다.
 * 범례나 에이전트 지침 속 예시 문자열(`<a id="CP-2"></a>`)은 정의가 아니다.
 */
const ANCHOR_PATTERN =
    /<a id="([A-Z][A-Z0-9]*-\d+)"><\/a>[ \t]*\n+[ \t]*#{1,6} \1\b/g;
const LEGACY_DOC_PATTERN = /MISTAKES/;

interface Reference {
    readonly source: string;
    readonly file: string;
    readonly id: string;
}

function walk(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap(name => {
        if (SKIP_DIRS.has(name)) return [];
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return walk(full);
        return SCAN_EXTENSIONS.has(path.extname(name)) && full !== SELF
            ? [full]
            : [];
    });
}

function scannedFiles(): string[] {
    return [
        ...SCAN_ROOT_FILES.map(file => path.join(ROOT, file)).filter(
            existsSync
        ),
        ...SCAN_DIRS.flatMap(dir => walk(path.join(ROOT, dir))),
    ];
}

function extractReferences(source: string, text: string): Reference[] {
    return [...text.matchAll(REFERENCE_PATTERN)].map(match => ({
        source,
        file: match[1]!,
        id: match[2]!,
    }));
}

/** 파일명만 쓴 참조는 `docs/conventions/` → 저장소 루트 순으로 찾는다. */
function resolveDocPath(file: string): string | null {
    const candidates = file.includes('/')
        ? [path.join(ROOT, file)]
        : [path.join(ROOT, 'docs/conventions', file), path.join(ROOT, file)];
    return candidates.find(existsSync) ?? null;
}

function anchorsIn(docPath: string): string[] {
    return [...readFileSync(docPath, 'utf8').matchAll(ANCHOR_PATTERN)].map(
        match => match[1]!
    );
}

function findDanglingReferences(
    references: readonly Reference[],
    anchorsOf: (docPath: string) => readonly string[]
): string[] {
    return references.flatMap(({ source, file, id }) => {
        const docPath = resolveDocPath(file);
        if (docPath === null) return [`${source}: ${file}#${id} (파일 없음)`];
        return anchorsOf(docPath).includes(id)
            ? []
            : [`${source}: ${file}#${id} (앵커 없음)`];
    });
}

describe('rule reference guard', () => {
    const files = scannedFiles();
    const texts = files.map(file => ({
        relative: path.relative(ROOT, file),
        text: readFileSync(file, 'utf8'),
    }));

    it('스캔 범위가 비어 있지 않다(파서가 깨지면 모든 검사가 공허해진다)', () => {
        expect(texts.length).toBeGreaterThan(100);
        const references = texts.flatMap(({ relative, text }) =>
            extractReferences(relative, text)
        );
        expect(references.length).toBeGreaterThan(50);
    });

    it('모든 FILE#ID 참조가 실재하는 <a id> 앵커로 풀린다', () => {
        const references = texts.flatMap(({ relative, text }) =>
            extractReferences(relative, text)
        );
        expect(findDanglingReferences(references, anchorsIn)).toEqual([]);
    });

    it('규칙 ID는 문서 전체에서 한 번만 정의된다', () => {
        const owners = new Map<string, string[]>();
        texts
            .filter(({ relative }) => relative.endsWith('.md'))
            .forEach(({ relative, text }) => {
                [...text.matchAll(ANCHOR_PATTERN)].forEach(match => {
                    const id = match[1]!;
                    owners.set(id, [...(owners.get(id) ?? []), relative]);
                });
            });
        const duplicated = [...owners.entries()]
            .filter(([, where]) => where.length > 1)
            .map(([id, where]) => `${id}: ${where.join(', ')}`);
        expect(duplicated).toEqual([]);
    });

    it('해체된 MISTAKES 문서에 대한 언급이 남아 있지 않다', () => {
        const stale = texts
            .filter(({ text }) => LEGACY_DOC_PATTERN.test(text))
            .map(({ relative }) => relative);
        expect(stale).toEqual([]);
    });

    it('끊어진 참조를 실제로 찾아낸다(가드가 공허하지 않음)', () => {
        const references: Reference[] = [
            { source: 'a.ts', file: 'CONVENTIONS.md', id: 'ZZ-999' },
            { source: 'b.ts', file: 'NoSuchDoc.md', id: 'CS-1' },
            { source: 'c.ts', file: 'src/app/CLAUDE.md', id: 'AP-1' },
        ];
        const dangling = findDanglingReferences(references, docPath =>
            docPath.endsWith('src/app/CLAUDE.md') ? ['AP-1'] : []
        );
        expect(dangling).toEqual([
            'a.ts: CONVENTIONS.md#ZZ-999 (앵커 없음)',
            'b.ts: NoSuchDoc.md#CS-1 (파일 없음)',
        ]);
    });
});
