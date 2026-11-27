vi.mock('next-intl/middleware', () => ({ default: () => vi.fn() }));

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import nextConfig from '../../../../../../next.config';
import { config } from '@/proxy';
import { buildLlmsDocument } from '@/app/api/llms/_lib/buildLlmsDocument';
import { testInputs } from '@/app/api/llms/_lib/__tests__/llmsTestInputs';
import type {
    LlmsDocument,
    LlmsHost,
    LlmsLink,
    LlmsLinkTarget,
} from '@/app/api/llms/_lib/model';
import { renderLlmsTxt } from '@/app/api/llms/_lib/renderLlmsTxt';
import { BACKTEST_DATA_PUBLIC_PATH } from '@/entities/backtest-case/lib/fetchBacktestRunData';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import {
    GUIDE_CATEGORIES,
    type GuideEntrySummary,
} from '@/entities/guide/types';
import { buildPrewarmUniverse } from '@/entities/seo-snapshot/lib/applicability';
import { buildGuideSitemapEntries } from '@/entities/sitemap-entry/lib/buildGuideSitemapEntries';
import { buildStaticEntries } from '@/entities/sitemap-entry/lib/buildStaticEntries';
import { AI_INDEXABLE_PATHS } from '@/shared/config/aiHost';
import { LLMS_TXT_PATH } from '@/shared/config/llmsTxt';

/**
 * llms.txt의 모든 링크가 실제로 풀리는지 라우트 표에 대조하는 가드. 링크는 `target`의 종류로만 만들어지므로
 * 종류마다 "이 종류의 주소가 존재한다"는 증거를 다른 정본(sitemap, rewrite 표, public 폴더, 레포 파일)에서 읽는다.
 * 네트워크는 쓰지 않는다.
 */

const ROOT = process.cwd();
const FIXED_NOW = new Date('2026-11-21T00:00:00Z');
const HOSTS: readonly LlmsHost[] = ['main', 'ai'];
const GATES = [false, true] as const;

function guideSummary(
    category: GuideEntrySummary['category']
): GuideEntrySummary {
    return {
        slug: `${category}-sample`,
        category,
        order: 0,
        title: category,
        aliases: [],
        summary: category,
        updatedAt: '2026-11-01T00:00:00Z',
        about: [],
        signals: [],
        demoFrom: null,
    };
}

function declaredPaths(): ReadonlySet<string> {
    const entries = [
        ...buildStaticEntries(FIXED_NOW),
        ...buildGuideSitemapEntries(
            GUIDE_CATEGORIES.map(guideSummary),
            FIXED_NOW
        ),
    ];
    return new Set(entries.map(entry => new URL(entry.url).pathname));
}

function walkFiles(dir: string): string[] {
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .map(name => join(dir, name))
        .filter(
            file =>
                (file.endsWith('.tsx') || file.endsWith('.ts')) &&
                !file.includes('__tests__')
        );
}

function methodologySources(): string {
    return walkFiles(join(ROOT, 'src/views/methodology'))
        .map(file => readFileSync(file, 'utf8'))
        .join('\n');
}

/** `/api/a/b` 같은 목적지가 `route.ts`를 가진 디렉터리로 이어지는지. `[param]` 폴더는 한 세그먼트로 본다. */
function routeFileExists(segments: readonly string[], dir: string): boolean {
    const [head, ...rest] = segments;
    if (head === undefined) return existsSync(join(dir, 'route.ts'));
    if (!existsSync(dir)) return false;
    const dynamicDirs = readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\[[^\]./]+\]$/.test(d.name))
        .map(d => d.name);
    return [head, ...dynamicDirs].some(name =>
        routeFileExists(rest, join(dir, name))
    );
}

function matchesProxy(pathname: string): boolean {
    return config.matcher.some(pattern =>
        new RegExp(`^${pattern}$`).test(pathname)
    );
}

function linksOf(doc: LlmsDocument): LlmsLink[] {
    return doc.sections.flatMap(section => section.links);
}

function targetsOfKind<K extends LlmsLinkTarget['kind']>(
    doc: LlmsDocument,
    kind: K
): Extract<LlmsLinkTarget, { kind: K }>[] {
    return linksOf(doc).flatMap(l =>
        l.target.kind === kind
            ? [l.target as Extract<LlmsLinkTarget, { kind: K }>]
            : []
    );
}

const RELEASE = getPublishedBenchmarkRelease();

describe.each(HOSTS.flatMap(host => GATES.map(api => [host, api] as const)))(
    'llms.txt 링크 가드 (%s 호스트, 공개 API %s)',
    (host, publicApiEnabled) => {
        const inputs = testInputs({ publicApiEnabled });
        const doc = buildLlmsDocument(host, inputs);

        beforeEach(() => {
            // sitemap의 /developers 항목과 같은 판정(`isPublicApiEnabled`)을 맞춘다.
            vi.stubEnv('PUBLIC_API_ENABLED', publicApiEnabled ? 'true' : '');
        });

        it('mainPage는 정적 sitemap이 선언한 경로다', () => {
            const declared = declaredPaths();

            const missing = targetsOfKind(doc, 'mainPage')
                .map(t => t.path)
                .filter(path => !declared.has(path));

            expect(missing).toEqual([]);
        });

        it('mainPageFragment는 선언된 페이지의 경로이고 방법론 소스에 같은 id가 있다', () => {
            const declared = declaredPaths();
            const source = methodologySources();

            const missing = targetsOfKind(doc, 'mainPageFragment').filter(
                t =>
                    !declared.has(t.path) ||
                    !source.includes(`id="${t.fragment}"`)
            );

            expect(missing).toEqual([]);
        });

        it('symbolPage는 프리웜 유니버스 안의 종목이다', () => {
            const prewarmed = new Set(
                buildPrewarmUniverse().map(p => p.symbol)
            );

            const missing = targetsOfKind(doc, 'symbolPage')
                .map(t => t.symbol)
                .filter(symbol => !prewarmed.has(symbol));

            expect(missing).toEqual([]);
        });

        it('rewrite는 next.config의 rewrite source이고 목적지가 라우트 파일로 이어진다', async () => {
            const rewrites = (await nextConfig.rewrites?.()) as ReadonlyArray<{
                source: string;
                destination: string;
            }>;

            const broken = targetsOfKind(doc, 'rewrite').filter(t => {
                const rule = rewrites.find(r => r.source === t.path);
                return (
                    rule === undefined ||
                    !routeFileExists(
                        rule.destination.split('/').filter(Boolean),
                        join(ROOT, 'src/app')
                    )
                );
            });

            expect(broken).toEqual([]);
        });

        it('ai 호스트의 rewrite 링크는 llms.txt뿐이다(다른 라우트는 ai 호스트를 404로 거른다)', () => {
            const aiRewritePaths = targetsOfKind(doc, 'rewrite')
                .filter(t => t.host === 'ai')
                .map(t => t.path);

            expect(
                aiRewritePaths.filter(path => path !== LLMS_TXT_PATH)
            ).toEqual([]);
        });

        it('publicFile은 public에 있거나 prebuild가 복사하는 백테스트 데이터이고, 프록시를 타지 않는다', () => {
            const scripts = (
                JSON.parse(
                    readFileSync(join(ROOT, 'package.json'), 'utf8')
                ) as {
                    scripts: Record<string, string>;
                }
            ).scripts;
            const copyScript = scripts['copy:backtesting'] ?? '';

            const unresolved = targetsOfKind(doc, 'publicFile').filter(t => {
                const tracked = existsSync(join(ROOT, 'public', t.path));
                const copied =
                    t.path === BACKTEST_DATA_PUBLIC_PATH &&
                    existsSync(
                        join(ROOT, 'src/entities/backtest-case/data/data.json')
                    ) &&
                    copyScript.includes(
                        'src/entities/backtest-case/data/data.json'
                    ) &&
                    copyScript.includes(`public${BACKTEST_DATA_PUBLIC_PATH}`);
                return !(tracked || copied) || matchesProxy(t.path);
            });

            expect(unresolved).toEqual([]);
        });

        it('aiPage는 ai 호스트의 색인 대상 경로다', () => {
            const missing = targetsOfKind(doc, 'aiPage')
                .map(t => t.path)
                .filter(path => !AI_INDEXABLE_PATHS.includes(path));

            expect(missing).toEqual([]);
        });

        it('repoFile은 저장소에 실제로 있는 파일이다', () => {
            const missing = targetsOfKind(doc, 'repoFile')
                .map(t => t.repoPath)
                .filter(repoPath => !existsSync(join(ROOT, repoPath)));

            expect(missing).toEqual([]);
        });

        it('external은 번들 데이터의 사전 등록 gist 하나뿐이다', () => {
            const other = targetsOfKind(doc, 'external').filter(
                t => t.url !== RELEASE?.prereg.gistUrl
            );

            expect(other).toEqual([]);
        });

        it('본문에 나오는 모든 URL은 모델의 링크이고 한 파일에서 두 번 나오지 않는다', () => {
            const text = renderLlmsTxt(doc);

            const found = [...text.matchAll(/https?:\/\/[^\s)]+/g)].map(
                m => m[0]
            );

            expect(found).toEqual(linksOf(doc).map(l => l.url));
            expect(new Set(found).size).toBe(found.length);
        });
    }
);

describe('llms.txt 위치', () => {
    it('public/llms.txt를 만들지 않는다 — public 파일이 rewrite를 가리고 호스트별 본문을 못 낸다', () => {
        expect(existsSync(join(ROOT, 'public', 'llms.txt'))).toBe(false);
    });
});
