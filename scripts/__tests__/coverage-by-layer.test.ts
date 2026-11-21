import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
    COVERAGE_METRICS,
    LAYER_DEFINITIONS,
    buildCoverageReport,
    classifyPath,
    parseCoverageSummary,
    renderCoverageMarkdown,
    runCoverageByLayer,
    toRepoRelativePath,
} from '../coverage-by-layer';

const ROOT = '/repo';
const BASE_DIR = mkdtempSync(join(tmpdir(), 'coverage-by-layer-'));

afterAll(() => {
    rmSync(BASE_DIR, { recursive: true, force: true });
});

const metric = (total: number, covered: number) => ({
    total,
    covered,
    skipped: 0,
    pct: total === 0 ? 100 : (covered / total) * 100,
});

/** 모든 지표가 같은 total/covered를 갖는 파일 항목. */
const entry = (total: number, covered: number) => ({
    lines: metric(total, covered),
    statements: metric(total, covered),
    functions: metric(total, covered),
    branches: metric(total, covered),
});

const summaryJson = (files: Record<string, ReturnType<typeof entry>>) =>
    JSON.stringify({ total: entry(999, 999), ...files });

const ALL_LAYER_FILES = {
    '/repo/src/entities/a/lib/x.ts': entry(10, 9),
    '/repo/src/features/b/y.tsx': entry(10, 10),
    '/repo/src/shared/lib/z.ts': entry(10, 10),
    '/repo/src/widgets/c/w.tsx': entry(10, 10),
    '/repo/src/views/d/v.tsx': entry(10, 10),
    '/repo/src/app/api/r/route.ts': entry(10, 10),
    '/repo/src/proxy.ts': entry(4, 4),
    '/repo/src/instrumentation.node.ts': entry(4, 4),
    '/repo/cache-handler/config.mjs': entry(4, 4),
};

const makeWorkDir = () => mkdtempSync(join(BASE_DIR, 't-'));

const writeSummary = (dir: string, content: string) => {
    const path = join(dir, 'coverage-summary.json');
    writeFileSync(path, content);
    return path;
};

describe('classifyPath', () => {
    it.each([
        ['src/entities/a/b.ts', 'entities'],
        ['src/features/a/b.ts', 'features'],
        ['src/shared/a/b.ts', 'shared'],
        ['src/widgets/a/b.tsx', 'widgets'],
        ['src/views/a/b.tsx', 'views'],
        ['src/app/api/route.ts', 'app'],
        ['src/proxy.ts', 'proxy'],
        ['src/instrumentation.ts', 'instrumentation'],
        ['src/instrumentation.node.ts', 'instrumentation'],
        ['cache-handler/config.mjs', 'cache-handler'],
    ])('%s -> %s', (path, layer) => {
        expect(classifyPath(path)).toBe(layer);
    });

    it('returns null for files outside every layer', () => {
        expect(classifyPath('src/other/a.ts')).toBeNull();
        expect(classifyPath('src/proxy.tsx')).toBeNull();
        expect(classifyPath('src/instrumentation/x.ts')).toBeNull();
        expect(classifyPath('/elsewhere/src/shared/a.ts')).toBeNull();
    });
});

describe('toRepoRelativePath', () => {
    it('strips the repo root', () => {
        expect(toRepoRelativePath('/repo/src/shared/a.ts', ROOT)).toBe(
            'src/shared/a.ts'
        );
    });

    it('treats a top-level folder whose name starts with two dots as inside the root', () => {
        expect(toRepoRelativePath('/repo/..cache/a.ts', ROOT)).toBe(
            '..cache/a.ts'
        );
    });

    it('keeps a path outside the root as is', () => {
        expect(toRepoRelativePath('/other/src/shared/a.ts', ROOT)).toBe(
            '/other/src/shared/a.ts'
        );
    });
});

describe('parseCoverageSummary', () => {
    it('drops the total key and keeps per-file entries', () => {
        const summary = parseCoverageSummary(
            summaryJson({ '/repo/src/shared/a.ts': entry(2, 1) })
        );

        expect([...summary.files.keys()]).toEqual(['/repo/src/shared/a.ts']);
        expect(summary.files.get('/repo/src/shared/a.ts')?.lines).toEqual({
            total: 2,
            covered: 1,
            skipped: 0,
            pct: 50,
        });
    });

    it('throws on invalid JSON', () => {
        expect(() => parseCoverageSummary('{nope')).toThrow('not valid JSON');
    });

    it('throws when the root is not an object', () => {
        expect(() => parseCoverageSummary('[]')).toThrow('JSON object');
        expect(() => parseCoverageSummary('null')).toThrow('JSON object');
    });

    it('throws when an entry is not an object', () => {
        expect(() => parseCoverageSummary('{"/repo/src/a.ts": 5}')).toThrow(
            'not an object'
        );
    });

    it('throws when an entry lacks a metric', () => {
        const broken = JSON.stringify({
            '/repo/src/a.ts': { lines: { total: 1, covered: 1 } },
        });

        expect(() => parseCoverageSummary(broken)).toThrow(
            'has no usable statements counts'
        );
    });
});

describe('buildCoverageReport', () => {
    it('sums every metric per layer and in the overall row', () => {
        const report = buildCoverageReport(
            parseCoverageSummary(
                summaryJson({
                    '/repo/src/shared/a.ts': entry(10, 9),
                    '/repo/src/shared/b.ts': entry(30, 15),
                    '/repo/src/app/c.ts': entry(10, 10),
                })
            ),
            ROOT
        );
        const shared = report.layers.find(layer => layer.id === 'shared');

        expect(shared?.files).toBe(2);
        expect(shared?.metrics.lines).toEqual({
            total: 40,
            covered: 24,
            pct: 60,
            belowTarget: true,
        });
        expect(report.overall.files).toBe(3);
        expect(report.overall.metrics.statements.total).toBe(50);
        expect(report.overall.metrics.statements.covered).toBe(34);
        expect(report.unclassified).toEqual([]);
    });

    it('emits one row per layer in the doc order, empty layers included', () => {
        const report = buildCoverageReport(
            parseCoverageSummary(
                summaryJson({ '/repo/src/shared/a.ts': entry(2, 2) })
            ),
            ROOT
        );

        expect(report.layers.map(layer => layer.id)).toEqual(
            LAYER_DEFINITIONS.map(layer => layer.id)
        );
    });

    it('reports n/a, not NaN, for a layer with zero totals', () => {
        const report = buildCoverageReport(
            parseCoverageSummary(
                summaryJson({ '/repo/src/shared/a.ts': entry(2, 2) })
            ),
            ROOT
        );
        const views = report.layers.find(layer => layer.id === 'views');

        expect(views?.metrics.branches).toEqual({
            total: 0,
            covered: 0,
            pct: null,
            belowTarget: false,
        });
    });

    it('does not flag a layer at exactly the target', () => {
        const report = buildCoverageReport(
            parseCoverageSummary(
                summaryJson({ '/repo/src/shared/a.ts': entry(10, 9) })
            ),
            ROOT
        );
        const shared = report.layers.find(layer => layer.id === 'shared');

        expect(shared?.metrics.lines.belowTarget).toBe(false);
    });

    it('lists files that belong to no layer, sorted', () => {
        const report = buildCoverageReport(
            parseCoverageSummary(
                summaryJson({
                    '/repo/src/zeta/b.ts': entry(2, 2),
                    '/repo/src/alpha/a.ts': entry(2, 2),
                    '/outside/src/shared/c.ts': entry(2, 2),
                })
            ),
            ROOT
        );

        expect(report.unclassified).toEqual([
            '/outside/src/shared/c.ts',
            'src/alpha/a.ts',
            'src/zeta/b.ts',
        ]);
    });
});

describe('renderCoverageMarkdown', () => {
    const render = (files: Record<string, ReturnType<typeof entry>>) =>
        renderCoverageMarkdown(
            buildCoverageReport(parseCoverageSummary(summaryJson(files)), ROOT)
        );

    it('has a row per layer plus overall, with the metric header', () => {
        const markdown = render(ALL_LAYER_FILES);
        const rows = markdown
            .split('\n')
            .filter(line => line.startsWith('| ') && !line.includes('---'));

        expect(rows[0]).toBe(
            `| Layer | Files | ${COVERAGE_METRICS.join(' | ')} |`
        );
        expect(rows.slice(1).map(row => row.split(' | ')[0])).toEqual([
            ...LAYER_DEFINITIONS.map(layer => `| ${layer.id}`),
            '| overall',
        ]);
        expect(markdown).toContain('Unclassified files: none');
    });

    it('marks metrics under the target and only those', () => {
        const markdown = render(ALL_LAYER_FILES);
        const entities = markdown
            .split('\n')
            .find(line => line.startsWith('| entities |'));
        const features = markdown
            .split('\n')
            .find(line => line.startsWith('| features |'));

        expect(entities).toContain('90.00% (9/10)');
        expect(entities).not.toContain('below 90');
        expect(features).not.toContain('below 90');
        expect(render({ '/repo/src/shared/a.ts': entry(10, 5) })).toContain(
            '50.00% (5/10) below 90'
        );
    });

    it('prints n/a for an empty metric and never NaN', () => {
        const markdown = render({ '/repo/src/shared/a.ts': entry(2, 2) });

        expect(markdown).toContain('n/a (0/0)');
        expect(markdown).not.toContain('NaN');
    });

    it('lists unclassified files', () => {
        const markdown = render({
            '/repo/src/shared/a.ts': entry(2, 2),
            '/repo/src/stray/b.ts': entry(2, 2),
        });

        expect(markdown).toContain('Unclassified files (1)');
        expect(markdown).toContain('- src/stray/b.ts');
    });
});

describe('runCoverageByLayer', () => {
    it('writes by-layer.md and by-layer.json next to the summary and exits 0', () => {
        const dir = makeWorkDir();
        const summaryPath = writeSummary(dir, summaryJson(ALL_LAYER_FILES));

        const result = runCoverageByLayer({ summaryPath, root: ROOT });

        expect(result.exitCode).toBe(0);
        expect(readFileSync(join(dir, 'by-layer.md'), 'utf-8')).toContain(
            '| overall |'
        );
        const json = JSON.parse(
            readFileSync(join(dir, 'by-layer.json'), 'utf-8')
        );
        expect(json.layers).toHaveLength(LAYER_DEFINITIONS.length);
        expect(json.unclassified).toEqual([]);
    });

    it('appends the table to the step summary when a path is given', () => {
        const dir = makeWorkDir();
        const summaryPath = writeSummary(dir, summaryJson(ALL_LAYER_FILES));
        const stepSummaryPath = join(dir, 'step-summary.md');
        writeFileSync(stepSummaryPath, 'existing\n');

        runCoverageByLayer({ summaryPath, root: ROOT, stepSummaryPath });

        const written = readFileSync(stepSummaryPath, 'utf-8');
        expect(written.startsWith('existing\n')).toBe(true);
        expect(written).toContain('## Coverage by layer');
        expect(written).toContain('| overall |');
    });

    it('treats an empty step summary path as not set', () => {
        const dir = makeWorkDir();
        const summaryPath = writeSummary(dir, summaryJson(ALL_LAYER_FILES));

        const result = runCoverageByLayer({
            summaryPath,
            root: ROOT,
            stepSummaryPath: '',
        });

        expect(result.exitCode).toBe(0);
    });

    it('exits 1 and writes a note to the step summary when the file is missing', () => {
        const dir = makeWorkDir();
        const stepSummaryPath = join(dir, 'step-summary.md');

        const result = runCoverageByLayer({
            summaryPath: join(dir, 'missing.json'),
            root: ROOT,
            stepSummaryPath,
        });

        expect(result.exitCode).toBe(1);
        expect(result.messages[0]).toContain('coverage summary not found');
        expect(readFileSync(stepSummaryPath, 'utf-8')).toContain(
            'Report failed: coverage summary not found'
        );
        expect(existsSync(join(dir, 'by-layer.md'))).toBe(false);
    });

    it('exits 1 on unparsable JSON', () => {
        const dir = makeWorkDir();

        const result = runCoverageByLayer({
            summaryPath: writeSummary(dir, '{broken'),
            root: ROOT,
        });

        expect(result.exitCode).toBe(1);
        expect(result.messages[0]).toContain('not valid JSON');
    });

    it('exits 1 when there are zero total statements', () => {
        const dir = makeWorkDir();

        const result = runCoverageByLayer({
            summaryPath: writeSummary(
                dir,
                summaryJson({ '/repo/src/shared/a.ts': entry(0, 0) })
            ),
            root: ROOT,
        });

        expect(result.exitCode).toBe(1);
        expect(result.messages[0]).toContain('zero total statements');
        expect(existsSync(join(dir, 'by-layer.md'))).toBe(false);
    });

    it('exits 1 for a summary with no file entries', () => {
        const dir = makeWorkDir();

        const result = runCoverageByLayer({
            summaryPath: writeSummary(dir, '{"total":{}}'),
            root: ROOT,
        });

        expect(result.exitCode).toBe(1);
        expect(result.messages[0]).toContain('zero total statements');
    });

    it('still writes the report but exits 1 when a file is unclassified', () => {
        const dir = makeWorkDir();
        const summaryPath = writeSummary(
            dir,
            summaryJson({
                ...ALL_LAYER_FILES,
                '/repo/src/stray/b.ts': entry(2, 2),
            })
        );

        const result = runCoverageByLayer({ summaryPath, root: ROOT });

        expect(result.exitCode).toBe(1);
        expect(result.messages.join('\n')).toContain(
            '1 file(s) belong to no known layer'
        );
        expect(readFileSync(join(dir, 'by-layer.md'), 'utf-8')).toContain(
            '- src/stray/b.ts'
        );
    });

    it('creates the output directory when it does not exist yet', () => {
        const dir = makeWorkDir();
        const nested = join(dir, 'nested');
        mkdirSync(nested);
        const summaryPath = join(nested, 'coverage-summary.json');
        writeFileSync(summaryPath, summaryJson(ALL_LAYER_FILES));

        const result = runCoverageByLayer({ summaryPath, root: ROOT });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(nested, 'by-layer.json'))).toBe(true);
    });
});

describe('layer list vs TESTING.md', () => {
    const doc = readFileSync(
        join(__dirname, '../../docs/conventions/TESTING.md'),
        'utf-8'
    );
    const block = /## Coverage Targets\s+```\n([\s\S]*?)```/.exec(doc)?.[1];

    it('finds the Coverage Targets block', () => {
        expect(block).toBeDefined();
    });

    it('matches the script layer labels in order', () => {
        const labels = (block ?? '')
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => line.trim().split(/\s+/)[0]);

        expect(labels).toEqual(LAYER_DEFINITIONS.map(layer => layer.docLabel));
    });
});

describe('workflow wiring', () => {
    const workflow = readFileSync(
        join(__dirname, '../../.github/workflows/coverage-weekly.yml'),
        'utf-8'
    );

    it('runs on a schedule and manual dispatch, never on pull requests', () => {
        expect(workflow).toContain('schedule:');
        expect(workflow).toContain('workflow_dispatch:');
        expect(workflow).not.toContain('pull_request');
    });

    it('zeroes every threshold so a failure means tests failed', () => {
        COVERAGE_METRICS.forEach(metricName => {
            expect(workflow).toContain(`--coverage.thresholds.${metricName}=0`);
        });
    });

    it('produces the json-summary the script reads', () => {
        expect(workflow).toContain('--coverage.reporter=json-summary');
        expect(workflow).toContain(
            'scripts/coverage-by-layer.ts coverage/coverage-summary.json'
        );
    });

    it('marks the coverage run so the scan guards use their longer timeout', () => {
        expect(workflow).toMatch(/COVERAGE_RUN: '1'/);
    });
});
