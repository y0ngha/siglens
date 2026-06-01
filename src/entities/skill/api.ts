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

const SKILL_GATING_TIERS = ['always_on', 'gated'] as const;
const SIGNAL_KINDS = ['event', 'state'] as const;
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
 */
const parseGating = (raw: unknown): SkillGating | undefined => {
    if (typeof raw !== 'object' || raw === null) return undefined;

    const obj = raw as Record<string, unknown>;
    const tier = obj.tier;
    if (
        typeof tier !== 'string' ||
        !(SKILL_GATING_TIERS as readonly string[]).includes(tier)
    ) {
        return undefined;
    }
    if (tier === 'always_on') return { tier: 'always_on' };

    // tier === 'gated' → snake_case `signal_kind` maps to camelCase `signalKind`.
    const signalKind = obj.signal_kind;
    if (
        typeof signalKind !== 'string' ||
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

    // signalKind === 'state'
    const state = parseStatePredicate(obj.state);
    if (state === undefined) return undefined;
    return { tier: 'gated', signalKind: 'state', state };
};

/**
 * Coerce a frontmatter boolean. The minimal YAML parser keeps an unquoted
 * `true` as the string `'true'`, so a flag must accept both forms.
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
