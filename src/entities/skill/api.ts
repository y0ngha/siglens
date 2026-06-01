import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import type {
    Skill,
    SkillCategory,
    SkillCounts,
    SkillDisplay,
    SkillGating,
    SkillStateFeature,
    SkillStatePredicate,
    SkillStatePredicateKind,
    SkillType,
} from '@y0ngha/siglens-core';
import type { SkillsProvider } from './model';

const SKILLS_DIR = join(process.cwd(), 'skills');

const SKILL_CATEGORIES = [
    'reversal_bullish',
    'reversal_bearish',
    'continuation_bullish',
    'continuation_bearish',
    'neutral',
    'fundamental',
    'news',
] as const satisfies readonly SkillCategory[];

const parseYamlValue = (value: string): unknown => {
    if (value === '[]') return [];
    if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        if (inner === '') return [];
        return inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    const num = Number(value);
    if (value !== '' && !isNaN(num)) return num;
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }
    return value;
};

type YamlNode = Record<string, unknown>;

type ParsedLine =
    | { kind: 'skip' }
    | { kind: 'deeper' }
    | { kind: 'break' }
    | { kind: 'leaf'; key: string; value: unknown }
    | { kind: 'block'; key: string };

const classifyLine = (line: string, baseIndent: number): ParsedLine => {
    const trimmed = line.trimStart();
    if (trimmed === '' || !trimmed.includes(':')) return { kind: 'skip' };

    const indent = line.length - trimmed.length;
    if (indent < baseIndent) return { kind: 'break' };
    if (indent > baseIndent) return { kind: 'deeper' };

    const colonIdx = trimmed.indexOf(':');
    const key = trimmed.slice(0, colonIdx).trim();
    const rawVal = trimmed.slice(colonIdx + 1).trim();

    if (rawVal !== '')
        return { kind: 'leaf', key, value: parseYamlValue(rawVal) };
    return { kind: 'block', key };
};

/**
 * 중첩 YAML 블록을 재귀적으로 파싱한다.
 * 들여쓰기(2칸)를 기준으로 depth를 결정한다.
 */
const parseYamlBlock = (lines: string[], baseIndent: number): YamlNode =>
    lines.reduce<{ result: YamlNode; skip: number }>(
        ({ result, skip }, line, idx) => {
            if (skip > 0) return { result, skip: skip - 1 };

            const classified = classifyLine(line, baseIndent);

            if (classified.kind === 'skip' || classified.kind === 'deeper') {
                return { result, skip: 0 };
            }
            if (classified.kind === 'break') {
                return { result, skip: lines.length };
            }
            if (classified.kind === 'leaf') {
                return {
                    result: { ...result, [classified.key]: classified.value },
                    skip: 0,
                };
            }

            // block kind
            const { key } = classified;

            const childLines = lines.slice(idx + 1).filter(childLine => {
                const childTrimmed = childLine.trimStart();
                if (childTrimmed === '') return true;
                const childIndent = childLine.length - childTrimmed.length;
                return childIndent > baseIndent;
            });

            return {
                result: {
                    ...result,
                    [key]: parseYamlBlock(childLines, baseIndent + 2),
                },
                skip: childLines.length,
            };
        },
        { result: {}, skip: 0 }
    ).result;

interface ParsedFrontmatter {
    data: Record<string, unknown>;
    content: string;
}

const parseFrontmatter = (raw: string): ParsedFrontmatter | null => {
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
    if (!match) return null;

    const lines = match[1].split('\n');
    const data = parseYamlBlock(lines, 0);

    return { data, content: match[2].trim() };
};

const isSkillCategory = (value: unknown): value is SkillCategory =>
    typeof value === 'string' &&
    // SKILL_CATEGORIES is `as const` literal tuple; widening to readonly string[] for .includes() is safe — every element is a string literal.
    (SKILL_CATEGORIES as readonly string[]).includes(value);

const parseSkillDisplay = (raw: unknown): SkillDisplay | undefined => {
    if (typeof raw !== 'object' || raw === null) return undefined;

    // typeof + non-null guard above ensures raw is a non-null object; YamlNode widening is safe.
    const obj = raw as YamlNode;
    const chartRaw = obj.chart;
    if (typeof chartRaw !== 'object' || chartRaw === null) return undefined;

    // typeof + non-null guard above ensures chartRaw is a non-null object.
    const chart = chartRaw as YamlNode;
    if (
        typeof chart.show !== 'boolean' &&
        chart.show !== 'true' &&
        chart.show !== 'false'
    )
        return undefined;

    const show =
        typeof chart.show === 'boolean' ? chart.show : chart.show === 'true';
    const type = String(chart.type ?? '');
    const color = String(chart.color ?? '');
    const label = String(chart.label ?? '');

    if (type !== 'line' && type !== 'marker' && type !== 'region')
        return undefined;

    return {
        chart: { show, type, color, label },
    };
};

const SKILL_TYPES = [
    'pattern',
    'indicator_guide',
    'strategy',
    'candlestick',
    'support_resistance',
] as const satisfies readonly SkillType[];

const isSkillType = (value: unknown): value is SkillType =>
    typeof value === 'string' &&
    // SKILL_TYPES is `as const` literal tuple; widening to readonly string[] for .includes() is safe.
    (SKILL_TYPES as readonly string[]).includes(value);

// Gating frontmatter — unified with the core loader's contract
// (@y0ngha/siglens-core infrastructure/skills/loader). Keys are snake_case by
// repo convention (matching `confidence_weight`); `signal_kind` / `token_cost` /
// `smc_full_guide` map to the camelCase Skill fields the selector reads.

// `tier` / `signalKind` are inlined literals on the core's `SkillGating`
// discriminated union (no standalone exported union), so we derive the closed
// sets from that union — `satisfies` + the exhaustiveness guards below fail the
// build if the core ever adds a tier or a gated signal kind.
type SkillGatingTier = SkillGating['tier'];
type SkillSignalKind = Extract<SkillGating, { tier: 'gated' }>['signalKind'];

const SKILL_GATING_TIERS = [
    'always_on',
    'gated',
] as const satisfies readonly SkillGatingTier[];
const SIGNAL_KINDS = [
    'event',
    'state',
] as const satisfies readonly SkillSignalKind[];

type MissingGatingTier = Exclude<
    SkillGatingTier,
    (typeof SKILL_GATING_TIERS)[number]
>;
const _gatingTiersAreExhaustive: MissingGatingTier extends never
    ? true
    : never = true;
void _gatingTiersAreExhaustive;

type MissingSignalKind = Exclude<
    SkillSignalKind,
    (typeof SIGNAL_KINDS)[number]
>;
const _signalKindsAreExhaustive: MissingSignalKind extends never
    ? true
    : never = true;
void _signalKindsAreExhaustive;

// Duplicated as `STATE_FEATURES` / `STATE_PREDICATE_KINDS` in
// scripts/validate-skills.ts — the CI validator is a build script and can't
// import from app `src/`, so the lists are kept in sync by hand. Update both
// when the core's SkillStateFeature / SkillStatePredicateKind unions change
// (the `satisfies` clause fails the build here if this copy drifts).
const SKILL_STATE_FEATURES = [
    'bollinger',
    'keltner',
    'williamsR',
    'stochastic',
    'stochRsi',
    'donchian',
    'vwap',
    'buySellVolume',
] as const satisfies readonly SkillStateFeature[];
const SKILL_STATE_PREDICATE_KINDS = [
    'pctB',
    'bandDistAtr',
    'level',
    'ratio',
    'channelProximity',
] as const satisfies readonly SkillStatePredicateKind[];

// Exhaustiveness guards: if the core grows a new SkillStateFeature /
// SkillStatePredicateKind member not mirrored above, the corresponding type
// becomes a non-`never` union and tsc fails here — so a core drift fails the
// build instead of silently dropping the gating of otherwise-valid skills.
type MissingStateFeature = Exclude<
    SkillStateFeature,
    (typeof SKILL_STATE_FEATURES)[number]
>;
const _stateFeaturesAreExhaustive: MissingStateFeature extends never
    ? true
    : never = true;
void _stateFeaturesAreExhaustive;

type MissingPredicateKind = Exclude<
    SkillStatePredicateKind,
    (typeof SKILL_STATE_PREDICATE_KINDS)[number]
>;
const _predicateKindsAreExhaustive: MissingPredicateKind extends never
    ? true
    : never = true;
void _predicateKindsAreExhaustive;

// (feature, predicate) pairs the core's `isStateNotable` actually evaluates;
// any other pairing returns `false` for every chart, so the gated skill is
// unreachable. Validating the pair here (not just each half) keeps the runtime
// parser fail-open robust instead of leaning on the CI validator alone.
// Mirrors `VALID_STATE_PAIRS` in scripts/validate-skills.ts — keep both in sync.
const VALID_STATE_PAIRS = new Set<string>([
    'bollinger:pctB',
    'keltner:bandDistAtr',
    'williamsR:level',
    'stochastic:level',
    'stochRsi:level',
    'donchian:channelProximity',
    'vwap:bandDistAtr',
    'buySellVolume:ratio',
]);

/** Parse a state predicate; returns undefined when any required field is invalid. */
const parseStatePredicate = (raw: unknown): SkillStatePredicate | undefined => {
    if (typeof raw !== 'object' || raw === null) return undefined;

    // typeof + non-null guard above ensures raw is a non-null object; widening
    // to Record<string, unknown> is a safe structural up-cast.
    const obj = raw as Record<string, unknown>;
    const { feature, predicate, hi, lo } = obj;

    if (
        typeof feature !== 'string' ||
        // Tuple `.includes` is typed to its own members; widen to readonly string[].
        !(SKILL_STATE_FEATURES as readonly string[]).includes(feature) ||
        typeof predicate !== 'string' ||
        !(SKILL_STATE_PREDICATE_KINDS as readonly string[]).includes(predicate)
    ) {
        return undefined;
    }

    // Each half is valid above, but an unreachable pair (e.g. bollinger +
    // channelProximity) would parse into a SkillGating the core never fires on.
    // Fail-open: treat such a predicate as untagged so the selector loads it.
    if (!VALID_STATE_PAIRS.has(`${feature}:${predicate}`)) return undefined;

    return {
        // .includes() guards above proved membership in the literal unions at
        // runtime; TS cannot narrow `string` through them, hence the casts.
        feature: feature as SkillStateFeature,
        predicate: predicate as SkillStatePredicateKind,
        ...(typeof hi === 'number' ? { hi } : {}),
        ...(typeof lo === 'number' ? { lo } : {}),
    };
};

/**
 * Validate and normalize a `gating` frontmatter block, mirroring the core
 * loader. Returns undefined (skill treated as untagged → selector fail-opens)
 * when the block is malformed or unreachable.
 *
 * Exported for unit testing of branches the inline-array YAML parser cannot
 * reach (e.g. a non-string trigger element) — not re-exported via the entity
 * barrel, so it stays module-internal to consumers.
 */
export const parseGating = (raw: unknown): SkillGating | undefined => {
    if (typeof raw !== 'object' || raw === null) return undefined;

    // typeof + non-null guard above ensures raw is a non-null object; widening
    // to Record<string, unknown> is a safe structural up-cast.
    const obj = raw as Record<string, unknown>;
    const tier = obj.tier;
    if (
        typeof tier !== 'string' ||
        // Tuple `.includes` is typed to its own members; widen to readonly string[].
        !(SKILL_GATING_TIERS as readonly string[]).includes(tier)
    ) {
        return undefined;
    }
    if (tier === 'always_on') return { tier: 'always_on' };

    const signalKind = obj.signal_kind;
    if (
        typeof signalKind !== 'string' ||
        // Tuple `.includes` is typed to its own members; widen to readonly string[].
        !(SIGNAL_KINDS as readonly string[]).includes(signalKind)
    ) {
        return undefined;
    }

    if (signalKind === 'event') {
        const triggers = obj.triggers;
        if (
            !Array.isArray(triggers) ||
            triggers.length === 0 ||
            !triggers.every((t): t is string => typeof t === 'string')
        ) {
            return undefined;
        }
        return { tier: 'gated', signalKind: 'event', triggers };
    }

    const state = parseStatePredicate(obj.state);
    if (state === undefined) return undefined;
    return { tier: 'gated', signalKind: 'state', state };
};

/**
 * Coerce a frontmatter boolean. Some authors write `smc_full_guide: 'true'`
 * (quoted string) instead of the correct `smc_full_guide: true` (boolean);
 * accept both forms defensively.
 */
const isYamlTrue = (value: unknown): boolean =>
    value === true || value === 'true';

const toSkill = (data: Record<string, unknown>, content: string): Skill => ({
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    type: isSkillType(data.type) ? data.type : undefined,
    category: isSkillCategory(data.category) ? data.category : undefined,
    pattern: data.pattern != null ? String(data.pattern) : undefined,
    indicators: Array.isArray(data.indicators)
        ? (data.indicators as string[])
        : [],
    confidenceWeight:
        typeof data.confidence_weight === 'number' ? data.confidence_weight : 0,
    content,
    display: parseSkillDisplay(data.display),
    gating: parseGating(data.gating),
    // Reserved for build-time tokenizer baking; currently unused (placeholder 0). See skills/CLAUDE.md.
    tokenCost:
        typeof data.token_cost === 'number' ? data.token_cost : undefined,
    smcFullGuide: isYamlTrue(data.smc_full_guide),
});

const collectMdFiles = async (dir: string): Promise<string[]> => {
    // Missing skills subdirectory is treated as empty (e.g. fundamental/news
    // directories created lazily as Skill `.md` catalogs are added).
    // Node.js FS errors always carry .code; non-FS errors yield code === undefined and don't pass the ENOENT check, so the cast is safe.
    const entries = await readdir(dir, { withFileTypes: true }).catch(
        (error: unknown) => {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw error;
        }
    );
    if (entries === null) return [];
    const results = await Promise.all(
        entries.map(async (entry: Dirent) => {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) return collectMdFiles(fullPath);
            if (entry.name.endsWith('.md')) return [fullPath];
            return [];
        })
    );
    return results.flat();
};

const countMdFiles = async (subdir: string): Promise<number> => {
    const files = await collectMdFiles(join(SKILLS_DIR, subdir));
    return files.length;
};

// cacheComponents 비활성 기간 동안 'use cache' 제거.
// skills 디렉토리는 빌드 산출물이라 매 요청 fs.readdir이 사실상 OS page cache hit.
export async function countSkillFiles(): Promise<SkillCounts> {
    const [
        indicators,
        candlesticks,
        patterns,
        strategies,
        supportResistance,
        fundamental,
        news,
    ] = await Promise.all([
        countMdFiles('indicators'),
        countMdFiles('candlesticks'),
        countMdFiles('patterns'),
        countMdFiles('strategies'),
        countMdFiles('support-resistance'),
        countMdFiles('fundamental'),
        countMdFiles('news'),
    ]);
    return {
        indicators,
        candlesticks,
        patterns,
        strategies,
        supportResistance,
        fundamental,
        news,
    };
}

export class FileSkillsLoader implements SkillsProvider {
    async loadSkills(): Promise<Skill[]> {
        const mdFiles = await collectMdFiles(SKILLS_DIR);

        const skills = await Promise.all(
            mdFiles.map(async file => {
                const raw = await readFile(file, 'utf-8');
                const parsed = parseFrontmatter(raw);
                if (!parsed) return null;
                return toSkill(parsed.data, parsed.content);
            })
        );

        return skills.filter((s): s is Skill => s !== null);
    }
}
