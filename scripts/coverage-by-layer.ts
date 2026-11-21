/**
 * 레이어별 커버리지 표 생성기.
 *
 * `coverage-weekly` 워크플로가 vitest의 `coverage/coverage-summary.json`(json-summary
 * 리포터)을 읽어 레이어별 표를 만든다. 결과는 `coverage/by-layer.md`·`by-layer.json`에
 * 쓰고, `GITHUB_STEP_SUMMARY`가 있으면 거기에도 덧붙인다.
 *
 * 리포트가 조용히 깨진 경우(파일 없음, 깨진 JSON, 구문 0개, 어떤 레이어에도 속하지 않는
 * 파일)는 종료 코드 1로 실패한다. 동시 커버리지 실행이 `coverage/.tmp`를 서로 지워 exit 0
 * 으로 빈 리포트를 남기는 사고가 있었으므로, "테스트가 통과했다"와 "리포트가 만들어졌다"를
 * 따로 확인해야 한다.
 *
 * 사용: `yarn tsx scripts/coverage-by-layer.ts [coverage/coverage-summary.json]`
 */
import {
    appendFileSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COVERAGE_METRICS = [
    'lines',
    'statements',
    'functions',
    'branches',
] as const;

export type CoverageMetric = (typeof COVERAGE_METRICS)[number];

/** `docs/conventions/TESTING.md` Coverage Targets 목표치. 표의 `below 90` 기준이다. */
export const COVERAGE_TARGET_PCT = 90;

export interface LayerDefinition {
    readonly id: string;
    /** TESTING.md Coverage Targets 블록의 항목 이름. 문서와 이 목록이 같아야 한다. */
    readonly docLabel: string;
    readonly matches: (relativePath: string) => boolean;
}

const underSrc = (layer: string) => (path: string) =>
    path.startsWith(`src/${layer}/`);

export const LAYER_DEFINITIONS: readonly LayerDefinition[] = [
    { id: 'entities', docLabel: 'entities/', matches: underSrc('entities') },
    { id: 'features', docLabel: 'features/', matches: underSrc('features') },
    { id: 'shared', docLabel: 'shared/', matches: underSrc('shared') },
    { id: 'widgets', docLabel: 'widgets/', matches: underSrc('widgets') },
    { id: 'views', docLabel: 'views/', matches: underSrc('views') },
    { id: 'app', docLabel: 'app/', matches: underSrc('app') },
    {
        id: 'proxy',
        docLabel: 'src/proxy.ts',
        matches: path => path === 'src/proxy.ts',
    },
    {
        id: 'instrumentation',
        docLabel: 'src/instrumentation*.ts',
        matches: path => /^src\/instrumentation[^/]*\.ts$/.test(path),
    },
    {
        id: 'cache-handler',
        docLabel: 'cache-handler/',
        matches: path => path.startsWith('cache-handler/'),
    },
];

export interface MetricCount {
    readonly total: number;
    readonly covered: number;
}

export type FileCoverage = Readonly<Record<CoverageMetric, MetricCount>>;

export interface CoverageSummary {
    readonly files: ReadonlyMap<string, FileCoverage>;
}

export interface MetricRow extends MetricCount {
    /** 총계가 0이면 null(표에는 `n/a`). NaN을 만들지 않는다. */
    readonly pct: number | null;
    readonly belowTarget: boolean;
}

export interface LayerRow {
    readonly id: string;
    readonly files: number;
    readonly metrics: Readonly<Record<CoverageMetric, MetricRow>>;
}

export interface CoverageReport {
    readonly layers: readonly LayerRow[];
    readonly overall: LayerRow;
    readonly unclassified: readonly string[];
}

const SUMMARY_TOTAL_KEY = 'total';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is MetricCount =>
    isRecord(value) &&
    typeof value.total === 'number' &&
    typeof value.covered === 'number';

const toFileCoverage = (path: string, value: unknown): FileCoverage => {
    if (!isRecord(value)) {
        throw new Error(`coverage summary entry is not an object: ${path}`);
    }
    const counts = COVERAGE_METRICS.map(metric => [metric, value[metric]]);
    const broken = counts.find(([, count]) => !isCount(count));
    if (broken !== undefined) {
        throw new Error(
            `coverage summary entry ${path} has no usable ${String(broken[0])} counts`
        );
    }
    return Object.fromEntries(counts) as FileCoverage;
};

export function parseCoverageSummary(raw: string): CoverageSummary {
    const parsed: unknown = (() => {
        try {
            return JSON.parse(raw);
        } catch {
            throw new Error('coverage summary is not valid JSON');
        }
    })();
    if (!isRecord(parsed)) {
        throw new Error('coverage summary must be a JSON object');
    }
    const files = new Map(
        Object.entries(parsed)
            .filter(([path]) => path !== SUMMARY_TOTAL_KEY)
            .map(([path, value]) => [path, toFileCoverage(path, value)])
    );
    return { files };
}

/** 절대 경로를 저장소 루트 기준 슬래시 경로로 바꾼다. 루트 밖이면 그대로 둔다. */
export function toRepoRelativePath(path: string, root: string): string {
    const rel = relative(root, path).replaceAll('\\', '/');
    return rel.startsWith('..') ? path.replaceAll('\\', '/') : rel;
}

export function classifyPath(relativePath: string): string | null {
    return (
        LAYER_DEFINITIONS.find(layer => layer.matches(relativePath))?.id ?? null
    );
}

const sumMetric = (
    files: readonly FileCoverage[],
    metric: CoverageMetric
): MetricRow => {
    const total = files.reduce((sum, file) => sum + file[metric].total, 0);
    const covered = files.reduce((sum, file) => sum + file[metric].covered, 0);
    const pct = total === 0 ? null : (covered / total) * 100;
    return {
        total,
        covered,
        pct,
        belowTarget: pct !== null && pct < COVERAGE_TARGET_PCT,
    };
};

const buildRow = (id: string, files: readonly FileCoverage[]): LayerRow => ({
    id,
    files: files.length,
    metrics: Object.fromEntries(
        COVERAGE_METRICS.map(metric => [metric, sumMetric(files, metric)])
    ) as LayerRow['metrics'],
});

export function buildCoverageReport(
    summary: CoverageSummary,
    root: string
): CoverageReport {
    const entries = [...summary.files].map(([path, coverage]) => {
        const relativePath = toRepoRelativePath(path, root);
        return { relativePath, coverage, layer: classifyPath(relativePath) };
    });
    return {
        layers: LAYER_DEFINITIONS.map(({ id }) =>
            buildRow(
                id,
                entries
                    .filter(entry => entry.layer === id)
                    .map(entry => entry.coverage)
            )
        ),
        overall: buildRow(
            'overall',
            entries.map(entry => entry.coverage)
        ),
        unclassified: entries
            .filter(entry => entry.layer === null)
            .map(entry => entry.relativePath)
            .toSorted(),
    };
}

const formatCell = (row: MetricRow): string => {
    const ratio = `${row.covered}/${row.total}`;
    if (row.pct === null) {
        return `n/a (${ratio})`;
    }
    const base = `${row.pct.toFixed(2)}% (${ratio})`;
    return row.belowTarget ? `${base} below ${COVERAGE_TARGET_PCT}` : base;
};

const formatRow = (row: LayerRow): string => {
    const cells = COVERAGE_METRICS.map(metric =>
        formatCell(row.metrics[metric])
    );
    return `| ${[row.id, String(row.files), ...cells].join(' | ')} |`;
};

export function renderCoverageMarkdown(report: CoverageReport): string {
    const header = [
        '## Coverage by layer',
        '',
        `Target ${COVERAGE_TARGET_PCT}% per metric. Thresholds are disabled in this run, so a red job means tests failed, not that coverage is low.`,
        '',
        `| Layer | Files | ${COVERAGE_METRICS.join(' | ')} |`,
        `| --- | ---: | ${COVERAGE_METRICS.map(() => '---:').join(' | ')} |`,
    ];
    const unclassified =
        report.unclassified.length === 0
            ? ['', 'Unclassified files: none']
            : [
                  '',
                  `Unclassified files (${report.unclassified.length}), add a layer to scripts/coverage-by-layer.ts:`,
                  '',
                  ...report.unclassified.map(path => `- ${path}`),
              ];
    return [
        ...header,
        ...report.layers.map(formatRow),
        formatRow(report.overall),
        ...unclassified,
        '',
    ].join('\n');
}

export interface CoverageByLayerOptions {
    readonly summaryPath: string;
    readonly root: string;
    /** 설정하면 마크다운을 이 파일에 덧붙인다(`GITHUB_STEP_SUMMARY`). */
    readonly stepSummaryPath?: string;
}

export interface CoverageByLayerResult {
    readonly exitCode: 0 | 1;
    readonly messages: readonly string[];
}

const readSummaryFile = (path: string): string => {
    try {
        return readFileSync(path, 'utf-8');
    } catch {
        throw new Error(`coverage summary not found: ${path}`);
    }
};

const appendStepSummary = (path: string | undefined, text: string): void => {
    if (path !== undefined && path !== '') {
        appendFileSync(path, `${text}\n`);
    }
};

export function runCoverageByLayer(
    options: CoverageByLayerOptions
): CoverageByLayerResult {
    const { summaryPath, root, stepSummaryPath } = options;
    try {
        const summary = parseCoverageSummary(readSummaryFile(summaryPath));
        const report = buildCoverageReport(summary, root);
        if (report.overall.metrics.statements.total === 0) {
            throw new Error('coverage summary has zero total statements');
        }
        const markdown = renderCoverageMarkdown(report);
        const outDir = dirname(summaryPath);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'by-layer.md'), markdown);
        writeFileSync(
            join(outDir, 'by-layer.json'),
            `${JSON.stringify(report, null, 2)}\n`
        );
        appendStepSummary(stepSummaryPath, markdown);
        return report.unclassified.length === 0
            ? { exitCode: 0, messages: [markdown] }
            : {
                  exitCode: 1,
                  messages: [
                      markdown,
                      `${report.unclassified.length} file(s) belong to no known layer`,
                  ],
              };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendStepSummary(
            stepSummaryPath,
            `## Coverage by layer\n\nReport failed: ${message}`
        );
        return { exitCode: 1, messages: [message] };
    }
}

const executedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (executedDirectly) {
    const result = runCoverageByLayer({
        summaryPath: resolve(
            process.argv[2] ?? 'coverage/coverage-summary.json'
        ),
        root: process.cwd(),
        stepSummaryPath: process.env.GITHUB_STEP_SUMMARY,
    });
    const log = result.exitCode === 0 ? console.log : console.error;
    result.messages.forEach(message => log(`[coverage-by-layer] ${message}`));
    process.exit(result.exitCode);
}
