/**
 * Skill frontmatter validation gate.
 *
 * Loads every `skills/**\/*.md`, validates each file's `gating` block against
 * the snake_case schema, and cross-checks every `triggers` value against the
 * detectSignals signal catalog + candle-pattern catalog exported by
 * `@y0ngha/siglens-core` (the resolved core — see STEP-0 finding: siglens
 * consumes the core via the bare package specifier, never via `@/domain`).
 *
 * Exits non-zero on any of:
 *   - frontmatter that cannot be parsed,
 *   - a `gating` block missing a required field / with an invalid value,
 *   - an unreachable gated skill (no triggers and no state predicate),
 *   - a `triggers` entry that is not a known catalog signal or candle pattern.
 *
 * Run via `yarn validate:skills`; wired into CI.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import matter from 'gray-matter';
import {
    getCandlePatternLabel,
    getMultiCandlePatternLabel,
} from '@y0ngha/siglens-core';
import type {
    CandlePattern,
    MultiCandlePattern,
    SignalType,
    SkillStateFeature,
    SkillStatePredicateKind,
} from '@y0ngha/siglens-core';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const SKILLS_DIR = join(REPO_ROOT, 'skills');

/**
 * Every detectSignals catalog entry (post-PR1, bidirectional). Declared
 * `satisfies readonly SignalType[]` so a drift between this list and the core's
 * `SignalType` union surfaces as a tsc error here. The exhaustiveness check
 * below additionally fails the build if the union grows but this list does not.
 */
const SIGNAL_CATALOG = [
    'rsi_oversold',
    'rsi_overbought',
    'rsi_bullish_divergence',
    'rsi_bearish_divergence',
    'golden_cross',
    'death_cross',
    'macd_bullish_cross',
    'macd_bearish_cross',
    'macd_histogram_bullish_convergence',
    'macd_histogram_bearish_convergence',
    'bollinger_lower_bounce',
    'bollinger_upper_breakout',
    'bollinger_squeeze_bullish',
    'bollinger_squeeze_bearish',
    'supertrend_bullish_flip',
    'supertrend_bearish_flip',
    'parabolic_sar_flip',
    'parabolic_sar_bearish_flip',
    'ichimoku_cloud_breakout',
    'ichimoku_cloud_breakdown',
    'cci_bullish_cross',
    'cci_bearish_cross',
    'dmi_bullish_cross',
    'dmi_bearish_cross',
    'cmf_bullish_flip',
    'cmf_bearish_flip',
    'mfi_oversold_bounce',
    'mfi_overbought_reversal',
    'keltner_upper_breakout',
    'keltner_lower_breakout',
    'squeeze_momentum_bullish',
    'squeeze_momentum_bearish',
    'support_proximity_bullish',
    'resistance_proximity_bearish',
] as const satisfies readonly SignalType[];

// Exhaustiveness guard: if the core's SignalType union ever contains a member
// not listed above, `missing` becomes a non-`never` type and tsc fails here.
type MissingSignal = Exclude<SignalType, (typeof SIGNAL_CATALOG)[number]>;
const _signalCatalogIsExhaustive: MissingSignal extends never ? true : never =
    true;
void _signalCatalogIsExhaustive;

const SIGNAL_SET = new Set<string>(SIGNAL_CATALOG);

/** A trigger is a valid candle pattern when the core has a label for it. */
const isCandlePattern = (name: string): boolean =>
    // (a) why cast: the label getters are typed to accept only the
    // CandlePattern / MultiCandlePattern unions, but `name` is an arbitrary
    // frontmatter string we are probing for membership.
    // (b) why safe: both getters return `undefined` for any unknown key, and we
    // use only the truthiness of the result — we never treat `name` as a real
    // pattern — so casting an out-of-union string is runtime-safe.
    getCandlePatternLabel(name as CandlePattern) !== undefined ||
    getMultiCandlePatternLabel(name as MultiCandlePattern) !== undefined;

const isKnownTrigger = (name: string): boolean =>
    SIGNAL_SET.has(name) || isCandlePattern(name);

// Mirror the core loader's accepted state-predicate vocabulary.
// Duplicates `SKILL_STATE_FEATURES` / `SKILL_STATE_PREDICATE_KINDS` in
// src/entities/skill/api.ts — a build script can't import from app `src/`, so
// the lists are kept in sync by hand. Update both when the core's
// SkillStateFeature / SkillStatePredicateKind unions change (the
// `satisfies` clause fails the build here if this copy drifts).
const STATE_FEATURES = [
    'bollinger',
    'keltner',
    'williamsR',
    'stochastic',
    'stochRsi',
    'donchian',
    'vwap',
    'buySellVolume',
] as const satisfies readonly SkillStateFeature[];
const STATE_PREDICATE_KINDS = [
    'pctB',
    'bandDistAtr',
    'level',
    'ratio',
    'channelProximity',
] as const satisfies readonly SkillStatePredicateKind[];

// Exhaustiveness guards: if the core grows a new SkillStateFeature /
// SkillStatePredicateKind member not mirrored above, the corresponding type
// becomes a non-`never` union and tsc fails here — so a core drift fails the
// build instead of silently rejecting otherwise-valid skills.
type MissingStateFeature = Exclude<
    SkillStateFeature,
    (typeof STATE_FEATURES)[number]
>;
const _stateFeaturesAreExhaustive: MissingStateFeature extends never
    ? true
    : never = true;
void _stateFeaturesAreExhaustive;

type MissingPredicateKind = Exclude<
    SkillStatePredicateKind,
    (typeof STATE_PREDICATE_KINDS)[number]
>;
const _predicateKindsAreExhaustive: MissingPredicateKind extends never
    ? true
    : never = true;
void _predicateKindsAreExhaustive;

/**
 * (feature, predicate) pairs the core's `isStateNotable` actually evaluates.
 * Any other pairing returns `false` for every chart → the skill is unreachable,
 * so the validator rejects it even though each half is individually valid.
 *
 * Mirrors `VALID_STATE_PAIRS` in src/entities/skill/api.ts — keep both in sync.
 */
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

interface SkillError {
    file: string;
    message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validate a single skill's frontmatter `data`. Returns the list of error
 * messages (empty when the skill is valid or intentionally untagged). Exported
 * for unit testing without spawning the CLI.
 */
export const validateSkillData = (data: Record<string, unknown>): string[] =>
    // A skill with no `gating` block is intentionally untagged (the core
    // selector fail-opens it). Only validate when a block is present.
    'gating' in data ? validateGating(data.gating) : [];

function validateGating(gating: unknown): string[] {
    if (!isRecord(gating)) {
        return ['`gating` must be a mapping.'];
    }

    const tier = gating.tier;
    if (tier !== 'always_on' && tier !== 'gated') {
        return [
            `\`gating.tier\` must be 'always_on' or 'gated' (got ${String(tier)}).`,
        ];
    }
    if (tier === 'always_on') return [];

    const signalKind = gating.signal_kind;
    if (signalKind !== 'event' && signalKind !== 'state') {
        return [
            `gated skill requires \`signal_kind\` of 'event' or 'state' (got ${String(signalKind)}).`,
        ];
    }

    if (signalKind === 'event') {
        const triggers = gating.triggers;
        if (!Array.isArray(triggers) || triggers.length === 0) {
            return [
                'event-gated skill is unreachable: `triggers` is missing or empty.',
            ];
        }
        return triggers.flatMap(trigger => {
            if (typeof trigger !== 'string') {
                return [
                    `\`triggers\` entry is not a string: ${String(trigger)}.`,
                ];
            }
            if (!isKnownTrigger(trigger)) {
                return [
                    `unknown trigger "${trigger}" — not a detectSignals catalog entry or candle pattern.`,
                ];
            }
            return [];
        });
    }

    const state = gating.state;
    if (!isRecord(state)) {
        return [
            'state-gated skill is unreachable: `state` predicate is missing.',
        ];
    }
    const feature = state.feature;
    const predicate = state.predicate;
    if (
        typeof feature !== 'string' ||
        // Tuple `.includes` is typed to its own members; widen to readonly string[].
        !(STATE_FEATURES as readonly string[]).includes(feature)
    ) {
        return [`invalid \`state.feature\`: ${String(feature)}.`];
    }
    if (
        typeof predicate !== 'string' ||
        // Tuple `.includes` is typed to its own members; widen to readonly string[].
        !(STATE_PREDICATE_KINDS as readonly string[]).includes(predicate)
    ) {
        return [`invalid \`state.predicate\`: ${String(predicate)}.`];
    }
    if (!VALID_STATE_PAIRS.has(`${feature}:${predicate}`)) {
        return [
            `unreachable state predicate: (${feature}, ${predicate}) is never evaluated by the core — use the supported predicate for this feature.`,
        ];
    }
    return [];
}

interface FileResult {
    hasGating: boolean;
    errors: SkillError[];
}

/** Read + validate one skill file. Returns its errors (with file context) and whether it carries a gating block. */
const parseSkillFile = (file: string): FileResult => {
    const rel = relative(REPO_ROOT, file);
    const withFile = (message: string): SkillError => ({ file: rel, message });

    let data: Record<string, unknown>;
    try {
        const parsed = matter(readFileSync(file, 'utf-8'));
        if (!isRecord(parsed.data)) {
            return {
                hasGating: false,
                errors: [withFile('frontmatter is missing or not a mapping.')],
            };
        }
        data = parsed.data;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
            hasGating: false,
            errors: [withFile(`failed to parse frontmatter: ${reason}`)],
        };
    }

    return {
        hasGating: 'gating' in data,
        errors: validateSkillData(data).map(withFile),
    };
};

const main = async (): Promise<void> => {
    const allFiles = await glob('**/*.md', { cwd: SKILLS_DIR, absolute: true });
    // `.sort()` not `.toSorted()`: scripts/ isn't covered by the main tsconfig's
    // esnext lib, so Array.prototype.toSorted isn't available; the spread copies
    // the array first so the original is not mutated.
    const files = [...allFiles].sort();

    const parsed = files.map(file => parseSkillFile(file));
    const withGating = parsed.filter(p => p.hasGating).length;
    const errors: SkillError[] = parsed.flatMap(p => p.errors);

    if (errors.length > 0) {
        console.error(
            `\n✖ Skill validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):\n`
        );
        for (const { file, message } of errors) {
            console.error(`  ${file}\n    ${message}`);
        }
        console.error('');
        process.exit(1);
    }

    console.log(
        `✓ Validated ${files.length} skill file${files.length === 1 ? '' : 's'} (${withGating} tagged with gating).`
    );
};

// Run the CLI only when executed directly (`tsx scripts/validate-skills.ts`),
// not when imported by the unit test, which exercises `validateSkillData`.
const executedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (executedDirectly) {
    main().catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`✖ validate-skills crashed: ${reason}`);
        process.exit(1);
    });
}
