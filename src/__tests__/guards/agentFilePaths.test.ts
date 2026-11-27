import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 에이전트 정의와 CLAUDE.md가 백틱으로 인용한 저장소 경로는 실재해야 한다.
 *
 * 리뷰어 지침이 옛 디렉터리(`src/domain/`, `components/`)를 가리킨 채 방치돼도
 * 아무 검사도 실패하지 않았다. 규칙 ID 참조는 `ruleReferences.test.ts`가 지키고,
 * 이 가드는 경로를 지킨다.
 *
 * 후보는 `src/`, `scripts/`, `infra/`, `.github/`, `docs/conventions/`,
 * `docs/product/`로 시작하는 백틱 구간이다. 자리표시자(`<x>`, `{x}`, `*`, `...`)가
 * 들어간 경로는 하나의 실재 경로가 아니라 패턴이라 건너뛴다. 후보인데 경로로
 * 분류할 수 없는 구간(공백 포함 등)은 조용히 넘기지 않고 실패시켜 파서를 고치게
 * 한다(TESTING.md#TE-63).
 */

const ROOT = path.resolve(__dirname, '../../..');

const AGENT_DIRS: readonly { readonly dir: string; readonly ext: string }[] = [
    { dir: '.claude/agents', ext: '.md' },
    // 수동 미러. 한쪽만 고쳐 경로가 갈라지는 일을 막는다.
    { dir: '.codex/agents', ext: '.toml' },
];
const CLAUDE_MD_DIRS = [
    '',
    'skills',
    ...['app', 'entities', 'features', 'shared', 'widgets', 'views'].map(
        l => `src/${l}`
    ),
];

const CANDIDATE_PREFIXES = [
    'src/',
    'scripts/',
    'infra/',
    '.github/',
    'docs/conventions/',
    'docs/product/',
];
const PLACEHOLDER_PATTERN = /[<>{}*]|\.\.\./;
const BACKTICK_SPAN = /`([^`\n]+)`/g;

type Classified =
    | { readonly kind: 'skip' }
    | { readonly kind: 'path'; readonly path: string }
    | { readonly kind: 'unparsed'; readonly raw: string };

function classify(span: string): Classified {
    if (!CANDIDATE_PREFIXES.some(prefix => span.startsWith(prefix))) {
        return { kind: 'skip' };
    }
    if (PLACEHOLDER_PATTERN.test(span)) return { kind: 'skip' };
    // `file.ts:12`, `file.md#ID` — 줄 번호와 앵커는 경로가 아니다.
    const bare = span.replace(/(?::\d+(?:-\d+)?|#[\w-]+)$/, '');
    if (!/^[\w./@()[\]-]+$/.test(bare)) return { kind: 'unparsed', raw: span };
    return { kind: 'path', path: bare };
}

function agentFiles(): string[] {
    return [
        ...AGENT_DIRS.flatMap(({ dir, ext }) =>
            readdirSync(path.join(ROOT, dir))
                .filter(name => name.endsWith(ext))
                .map(name => path.join(ROOT, dir, name))
        ),
        ...CLAUDE_MD_DIRS.map(dir => path.join(ROOT, dir, 'CLAUDE.md')).filter(
            existsSync
        ),
    ];
}

const FENCE_BLOCK = /```[^\n]*\n([\s\S]*?)```/g;
const FENCE_TOKEN_SPLIT = /[\s"'=,;()]+/;

/**
 * 인용 후보 문자열. 펜스 코드 블록은 공백·따옴표로 쪼갠 토큰을, 그 밖의 본문은
 * 백틱 구간을 후보로 삼는다. 블록 안 셸 명령(`git add src/a.ts`)의 경로도 잡힌다.
 */
function spansOf(text: string): string[] {
    const fenced = [...text.matchAll(FENCE_BLOCK)].flatMap(match =>
        (match[1] ?? '').split(FENCE_TOKEN_SPLIT).filter(Boolean)
    );
    const inline = [
        ...text.replace(FENCE_BLOCK, '\n').matchAll(BACKTICK_SPAN),
    ].flatMap(match => (match[1] === undefined ? [] : [match[1]]));
    return [...fenced, ...inline];
}

/**
 * 추적 파일 집합(`git ls-files`, 추적 + 무시되지 않은 미추적). 로컬에서만 존재하는
 * 무시된 파일을 인용하면 CI에서만 깨지므로, 디스크가 아니라 이 집합으로 판정한다.
 * 한 번만 읽는다.
 */
function trackedFiles(): string[] {
    return execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
        .split('\n')
        .filter(Boolean);
}

/** 파일이거나, 그 아래에 추적 파일이 하나라도 있는 디렉터리면 실재로 본다. */
function makeExists(files: readonly string[]): (relative: string) => boolean {
    const set = new Set(files);
    return relative => {
        const bare = relative.replace(/\/$/, '');
        return set.has(bare) || files.some(file => file.startsWith(`${bare}/`));
    };
}

function findProblems(
    inputs: readonly { readonly source: string; readonly text: string }[],
    exists: (relative: string) => boolean
): string[] {
    return inputs.flatMap(({ source, text }) =>
        spansOf(text).flatMap(span => {
            const result = classify(span);
            if (result.kind === 'skip') return [];
            if (result.kind === 'unparsed') {
                return [
                    `${source}: 경로로 분류할 수 없는 후보 \`${result.raw}\``,
                ];
            }
            return exists(result.path)
                ? []
                : [`${source}: 존재하지 않는 경로 \`${result.path}\``];
        })
    );
}

describe('agent file path guard', () => {
    const inputs = agentFiles().map(file => ({
        source: path.relative(ROOT, file),
        text: readFileSync(file, 'utf8'),
    }));
    const existsOnDisk = makeExists(trackedFiles());

    it('스캔 범위가 비어 있지 않다', () => {
        const pathCount = inputs
            .flatMap(({ text }) => spansOf(text).map(classify))
            .filter(result => result.kind === 'path').length;
        expect(inputs.length).toBeGreaterThanOrEqual(12);
        expect(inputs.some(({ source }) => source.endsWith('.toml'))).toBe(
            true
        );
        expect(pathCount).toBeGreaterThan(20);
    });

    it('인용된 모든 저장소 경로가 실재하고 분류 못 한 후보가 없다', () => {
        expect(findProblems(inputs, existsOnDisk)).toEqual([]);
    });

    it('실제 입력에서 인용 경로를 하나씩 지우면 전부 보고된다(TE-62)', () => {
        const cited = inputs.flatMap(({ source, text }) =>
            [...new Set(spansOf(text).map(classify))].flatMap(result =>
                result.kind === 'path' ? [{ source, path: result.path }] : []
            )
        );
        const survivors = cited.filter(({ source, path: citedPath }) => {
            const input = inputs.find(item => item.source === source);
            if (input === undefined) {
                throw new Error(`입력을 찾을 수 없다: ${source}`);
            }
            const mutated = [
                {
                    source,
                    text: input.text.replaceAll(
                        citedPath,
                        `${citedPath}.removed-in-memory`
                    ),
                },
            ];
            const problems = findProblems(mutated, relative =>
                relative === `${citedPath}.removed-in-memory`
                    ? false
                    : existsOnDisk(relative)
            );
            return problems.length === 0;
        });
        expect(survivors).toEqual([]);
    });

    it('분류할 수 없는 후보를 조용히 넘기지 않는다(TE-63)', () => {
        const problems = findProblems(
            [{ source: 'x.md', text: 'see `src/a b.ts` and `src/ok.ts`' }],
            () => true
        );
        expect(problems).toEqual([
            'x.md: 경로로 분류할 수 없는 후보 `src/a b.ts`',
        ]);
    });

    it('펜스 코드 블록 안 경로도 후보로 잡는다', () => {
        const text = 'x\n```bash\ngit add src/gone/a.ts src/ok/b.ts\n```\n';
        const problems = findProblems(
            [{ source: 'x.md', text }],
            relative => relative !== 'src/gone/a.ts'
        );
        expect(problems).toEqual(['x.md: 존재하지 않는 경로 `src/gone/a.ts`']);
    });

    it('디렉터리는 아래에 추적 파일이 있을 때만 실재한다', () => {
        const exists = makeExists(['src/a/b.ts']);
        expect(exists('src/a')).toBe(true);
        expect(exists('src/a/')).toBe(true);
        expect(exists('src/ab')).toBe(false);
    });

    it('자리표시자 경로는 건너뛴다', () => {
        const problems = findProblems(
            [
                {
                    source: 'x.md',
                    text: '`src/<layer>/CLAUDE.md` `src/**/x.ts` `src/{a}/b`',
                },
            ],
            () => false
        );
        expect(problems).toEqual([]);
    });
});
