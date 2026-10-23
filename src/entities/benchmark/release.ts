import { BENCHMARK_PUBLISHED } from '@/shared/config/benchmark';
import {
    BENCHMARK_JUDGED_LEVELS,
    BENCHMARK_FILTER_ALL,
    BENCHMARK_LABELS,
    BENCHMARK_LEVELS,
    BENCHMARK_MARKETS,
    BENCHMARK_OBJECTIVE_LEVELS,
    BENCHMARK_SUBJECT_ID,
    BENCHMARK_SUBSETS,
    type BenchmarkRelease,
} from './types';

/**
 * 공개 중인 벤치마크 결과. `null`이면 공개 전이다 — 두 `/benchmark` 라우트는 404, about
 * 요약·푸터 링크·ai sitemap 항목은 없다. 게이트의 정본은 `shared/config/benchmark.ts`의
 * `BENCHMARK_PUBLISHED`이고 둘이 어긋나지 않음은 `release.test.ts`가 고정한다.
 *
 * 공개 PR은 `export.py`가 만든 `data/release-<round>.json`을 import해
 * `assertBenchmarkRelease(json)`로 검증한 값으로 이 상수를 바꾸고
 * `BENCHMARK_PUBLISHED`를 `true`로 올린다. JSON을 이 파일 밖에서 재export하지 않는다
 * (barrel 금지).
 */
export const BENCHMARK_RELEASE: BenchmarkRelease | null = null;

/**
 * 화면이 읽는 유일한 진입점. 게이트가 꺼져 있으면 데이터가 있어도 `null`이다 — 라우트·
 * about 요약·푸터가 한 값으로 열리고 닫히게 한다.
 */
export function getPublishedBenchmarkRelease(): BenchmarkRelease | null {
    return BENCHMARK_PUBLISHED ? BENCHMARK_RELEASE : null;
}

type Rec = Readonly<Record<string, unknown>>;

function fail(path: string, expected: string): never {
    throw new Error(`[benchmark] invalid release at ${path}: ${expected}`);
}

function isRec(value: unknown): value is Rec {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rec(value: unknown, path: string): Rec {
    return isRec(value) ? value : fail(path, 'object');
}

function arr(value: unknown, path: string): readonly unknown[] {
    return Array.isArray(value) ? value : fail(path, 'array');
}

function str(value: unknown, path: string): string {
    return typeof value === 'string' && value !== ''
        ? value
        : fail(path, 'non-empty string');
}

function num(value: unknown, path: string): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fail(path, 'finite number');
}

function numOrNull(value: unknown, path: string): number | null {
    return value === null ? null : num(value, path);
}

function oneOf(
    value: unknown,
    allowed: readonly string[],
    path: string
): string {
    return typeof value === 'string' && allowed.includes(value)
        ? value
        : fail(path, `one of ${allowed.join('|')}`);
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 존재하지 않는 날짜(`2026-02-30`)는 Date가 다음 달로 넘기므로 왕복 비교로 거른다. */
function isoDate(value: unknown, path: string): string {
    const text = str(value, path);
    const valid =
        ISO_DATE_PATTERN.test(text) &&
        !Number.isNaN(Date.parse(text)) &&
        new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text;
    return valid ? text : fail(path, 'ISO date (YYYY-MM-DD)');
}

const ROUND_PATTERN = /^[0-9a-z][0-9a-z-]*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function matching(
    value: unknown,
    pattern: RegExp,
    path: string,
    expected: string
): string {
    const text = str(value, path);
    return pattern.test(text) ? text : fail(path, expected);
}

function httpsUrl(value: unknown, path: string): string {
    const text = str(value, path);
    try {
        if (new URL(text).protocol === 'https:') return text;
    } catch {
        // 파싱 실패는 아래 fail로 합친다.
    }
    return fail(path, 'https:// URL');
}

/** 풀·템플릿 id는 필터의 "전체" 예약어와 같을 수 없다. */
function filterId(value: unknown, path: string): string {
    const text = str(value, path);
    return text === BENCHMARK_FILTER_ALL
        ? fail(path, `an id other than the reserved "${BENCHMARK_FILTER_ALL}"`)
        : text;
}

/** 정적 파일 경로는 회차 디렉터리 안이어야 한다 — 다른 회차·외부 경로로 새지 않게 한다. */
function roundPath(value: unknown, round: string, path: string): string {
    const text = str(value, path);
    const prefix = `/benchmark/${round}/`;
    const clean = !text.split('/').some(segment => segment === '..');
    return text.startsWith(prefix) && clean
        ? text
        : fail(path, `path under ${prefix} without ".." segments`);
}

function scoreMap(
    value: unknown,
    targetIds: ReadonlySet<string>,
    path: string
): void {
    const map = rec(value, path);
    for (const id of targetIds) numOrNull(map[id], `${path}.${id}`);
}

function keyedScoreMaps(
    value: unknown,
    keys: readonly string[],
    targetIds: ReadonlySet<string>,
    path: string
): void {
    const map = rec(value, path);
    for (const key of keys) scoreMap(map[key], targetIds, `${path}.${key}`);
}

/** 대상 id → 기준선 여부. */
type BaselineById = ReadonlyMap<string, boolean>;

function checkTargets(raw: unknown): BaselineById {
    const targets = arr(raw, 'targets');
    if (targets.length === 0) fail('targets', 'at least one target');
    const ids = new Map<string, boolean>();
    targets.forEach((entry, i) => {
        const path = `targets[${i}]`;
        const target = rec(entry, path);
        const id = str(target.id, `${path}.id`);
        if (ids.has(id)) fail(`${path}.id`, 'unique id');
        str(target.label, `${path}.label`);
        str(target.model, `${path}.model`);
        if (typeof target.isBaseline !== 'boolean') {
            fail(`${path}.isBaseline`, 'boolean');
        }
        ids.set(id, target.isBaseline);
    });
    if (!ids.has(BENCHMARK_SUBJECT_ID)) {
        fail('targets', `a target with id ${BENCHMARK_SUBJECT_ID}`);
    }
    return ids;
}

/**
 * 경쟁 모델은 검정한 비교라 Holm p값이 숫자여야 하고, 기준선은 검정하지 않으므로 null이어야 한다.
 * 같은 대상의 비교가 둘이면 헤드라인 개수가 부풀고, 경쟁 모델 비교가 빠지면 조용히 줄어든다 —
 * 주체를 뺀 비기준선 대상마다 정확히 하나, 기준선은 많아야 하나만 받는다.
 */
function checkHeadline(raw: unknown, baselineById: BaselineById): void {
    const seen = new Set<string>();
    arr(raw, 'headline').forEach((entry, i) => {
        const path = `headline[${i}]`;
        const contrast = rec(entry, path);
        const target = str(contrast.target, `${path}.target`);
        if (!baselineById.has(target) || target === BENCHMARK_SUBJECT_ID) {
            fail(`${path}.target`, 'a known target id other than the subject');
        }
        if (seen.has(target)) fail(`${path}.target`, 'one contrast per target');
        seen.add(target);
        num(contrast.diff, `${path}.diff`);
        const ci = arr(contrast.ci95, `${path}.ci95`);
        if (ci.length !== 2) fail(`${path}.ci95`, 'pair [lo, hi]');
        const lo = num(ci[0], `${path}.ci95[0]`);
        const hi = num(ci[1], `${path}.ci95[1]`);
        if (lo > hi) fail(`${path}.ci95`, 'lo <= hi');
        if (baselineById.get(target)) {
            if (contrast.pHolm !== null) {
                fail(`${path}.pHolm`, 'null for a baseline comparison');
            }
        } else {
            num(contrast.pHolm, `${path}.pHolm`);
        }
        num(contrast.n, `${path}.n`);
    });
    for (const [id, isBaseline] of baselineById) {
        if (!isBaseline && id !== BENCHMARK_SUBJECT_ID && !seen.has(id)) {
            fail('headline', `a contrast against competitor ${id}`);
        }
    }
}

function checkBreakdown(raw: unknown, targetIds: ReadonlySet<string>): void {
    const breakdown = rec(raw, 'breakdown');
    keyedScoreMaps(
        breakdown.byLevel,
        BENCHMARK_OBJECTIVE_LEVELS,
        targetIds,
        'breakdown.byLevel'
    );
    keyedScoreMaps(
        breakdown.byMarket,
        BENCHMARK_MARKETS,
        targetIds,
        'breakdown.byMarket'
    );
    keyedScoreMaps(
        breakdown.bySubset,
        BENCHMARK_SUBSETS,
        targetIds,
        'breakdown.bySubset'
    );
    keyedScoreMaps(
        breakdown.judged,
        BENCHMARK_JUDGED_LEVELS,
        targetIds,
        'breakdown.judged'
    );
    const counts = rec(breakdown.labelCounts, 'breakdown.labelCounts');
    for (const id of targetIds) {
        const perTarget = rec(counts[id], `breakdown.labelCounts.${id}`);
        for (const label of BENCHMARK_LABELS) {
            num(perTarget[label], `breakdown.labelCounts.${id}.${label}`);
        }
    }
}

function checkItems(raw: unknown, targetIds: ReadonlySet<string>): void {
    const qids = new Set<string>();
    arr(raw, 'items').forEach((entry, i) => {
        const path = `items[${i}]`;
        const item = rec(entry, path);
        const qid = str(item.qid, `${path}.qid`);
        if (qids.has(qid)) fail(`${path}.qid`, 'unique qid');
        qids.add(qid);
        filterId(item.pool, `${path}.pool`);
        oneOf(item.level, BENCHMARK_LEVELS, `${path}.level`);
        oneOf(item.market, BENCHMARK_MARKETS, `${path}.market`);
        filterId(item.template, `${path}.template`);
        str(item.question, `${path}.question`);
        str(item.truthSummary, `${path}.truthSummary`);
        const results = rec(item.results, `${path}.results`);
        for (const id of targetIds) {
            const result = rec(results[id], `${path}.results.${id}`);
            oneOf(
                result.label,
                BENCHMARK_LABELS,
                `${path}.results.${id}.label`
            );
            numOrNull(result.score, `${path}.results.${id}.score`);
        }
    });
}

/**
 * export 결과(미검증 JSON)가 `BenchmarkRelease` 형태인지 검사하고 그대로 돌려준다.
 * 공개 PR이 JSON을 `BENCHMARK_RELEASE`에 연결하기 전에 거치는 관문이다 — 대상 id 누락,
 * 모르는 판정 라벨, 중복 qid 같은 데이터 결함이 화면에서 `undefined`로 번지지 않고
 * 빌드 시점에 `[benchmark] invalid release at <path>`로 드러나게 한다.
 */
export function assertBenchmarkRelease(value: unknown): BenchmarkRelease {
    const release = rec(value, 'release');
    const round = matching(
        release.round,
        ROUND_PATTERN,
        'round',
        'lowercase alphanumeric id (a-z, 0-9, "-")'
    );
    isoDate(release.measuredAt, 'measuredAt');
    isoDate(release.scoredAt, 'scoredAt');
    const baselineById = checkTargets(release.targets);
    const targetIds: ReadonlySet<string> = new Set(baselineById.keys());
    checkHeadline(release.headline, baselineById);
    checkBreakdown(release.breakdown, targetIds);
    const methodology = rec(release.methodology, 'methodology');
    const pools = rec(methodology.poolSizes, 'methodology.poolSizes');
    for (const [pool, size] of Object.entries(pools)) {
        filterId(pool, `methodology.poolSizes.${pool}`);
        num(size, `methodology.poolSizes.${pool}`);
    }
    num(methodology.rounds, 'methodology.rounds');
    num(methodology.lambda, 'methodology.lambda');
    numOrNull(
        methodology.vendorMismatchCount,
        'methodology.vendorMismatchCount'
    );
    const prereg = rec(release.prereg, 'prereg');
    matching(
        prereg.combinedSha256,
        SHA256_PATTERN,
        'prereg.combinedSha256',
        '64 lowercase hex characters'
    );
    httpsUrl(prereg.gistUrl, 'prereg.gistUrl');
    roundPath(prereg.otsPath, round, 'prereg.otsPath');
    roundPath(
        rec(release.downloads, 'downloads').zipPath,
        round,
        'downloads.zipPath'
    );
    checkItems(release.items, targetIds);
    return value as BenchmarkRelease;
}
