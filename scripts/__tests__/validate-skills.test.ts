import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseSkillFile, validateSkillData } from '../validate-skills';

describe('validateSkillData', () => {
    describe('valid frontmatter', () => {
        it('always_on tier is valid', () => {
            expect(
                validateSkillData({ gating: { tier: 'always_on' } })
            ).toEqual([]);
        });

        it('event-gated skill with known catalog triggers is valid', () => {
            expect(
                validateSkillData({
                    gating: {
                        tier: 'gated',
                        signal_kind: 'event',
                        triggers: ['rsi_oversold', 'macd_bullish_cross'],
                    },
                })
            ).toEqual([]);
        });

        it('event-gated candle skill with candle-pattern triggers is valid', () => {
            expect(
                validateSkillData({
                    type: 'candlestick',
                    gating: {
                        tier: 'gated',
                        signal_kind: 'event',
                        triggers: ['hammer', 'bullish_engulfing'],
                    },
                })
            ).toEqual([]);
        });

        it('event-gated pattern skill with chart-pattern pre-screener triggers is valid', () => {
            // The 17 ChartPatternId values are accepted via PATTERN_TRIGGER_CATALOG
            // (a separate catalog from SIGNAL_CATALOG). A pattern skill gates in
            // when the pre-screener flags its pattern as a candidate.
            expect(
                validateSkillData({
                    type: 'pattern',
                    gating: {
                        tier: 'gated',
                        signal_kind: 'event',
                        triggers: ['head_and_shoulders'],
                    },
                })
            ).toEqual([]);
            expect(
                validateSkillData({
                    type: 'pattern',
                    gating: {
                        tier: 'gated',
                        signal_kind: 'event',
                        triggers: ['cup_and_handle', 'rounding_bottom'],
                    },
                })
            ).toEqual([]);
        });

        it('state-gated skill with a supported (feature, predicate) pair is valid', () => {
            expect(
                validateSkillData({
                    gating: {
                        tier: 'gated',
                        signal_kind: 'state',
                        state: { feature: 'bollinger', predicate: 'pctB' },
                    },
                })
            ).toEqual([]);
        });
    });

    describe('schema errors', () => {
        it('rejects a skill with no `gating` block at all (explicit-gating policy)', () => {
            const errors = validateSkillData({
                name: 'x',
                confidence_weight: 0.5,
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/missing `gating` block/);
        });

        it('rejects a non-mapping gating block', () => {
            expect(validateSkillData({ gating: 'always_on' })).toHaveLength(1);
        });

        it('rejects an invalid tier', () => {
            const errors = validateSkillData({ gating: { tier: 'sometimes' } });
            expect(errors[0]).toMatch(/tier/);
        });

        it('rejects a gated skill with no signal_kind', () => {
            const errors = validateSkillData({ gating: { tier: 'gated' } });
            expect(errors[0]).toMatch(/signal_kind/);
        });
    });

    describe('unknown triggers', () => {
        it('rejects a trigger absent from the signal + candle catalog', () => {
            const errors = validateSkillData({
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['rsi_oversold', 'totally_fake_signal'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/unknown trigger "totally_fake_signal"/);
        });

        it('rejects a non-string entry in the triggers array', () => {
            const errors = validateSkillData({
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['rsi_oversold', 42],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/triggers.*entry is not a string/);
        });
    });

    describe('type-aware trigger vocabulary', () => {
        it('rejects a candle-pattern name on a non-candlestick skill', () => {
            const errors = validateSkillData({
                type: 'indicator_guide',
                usage_roles: ['signal'],
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['hammer'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/unknown trigger "hammer"/);
            expect(errors[0]).toMatch(/detectSignals catalog entry/);
        });

        it('rejects a chart-pattern id on a non-pattern skill', () => {
            const errors = validateSkillData({
                type: 'strategy',
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['head_and_shoulders'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/unknown trigger "head_and_shoulders"/);
            expect(errors[0]).toMatch(/detectSignals catalog entry/);
        });

        it('rejects a detectSignals catalog name on a pattern skill', () => {
            const errors = validateSkillData({
                type: 'pattern',
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['rsi_oversold'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/unknown trigger "rsi_oversold"/);
            expect(errors[0]).toMatch(/PATTERN_TRIGGER_CATALOG/);
        });

        it('rejects a candle-pattern name on a pattern skill', () => {
            const errors = validateSkillData({
                type: 'pattern',
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['bullish_engulfing'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/unknown trigger "bullish_engulfing"/);
            expect(errors[0]).toMatch(/PATTERN_TRIGGER_CATALOG/);
        });

        it('rejects a detectSignals catalog name on a candlestick skill', () => {
            const errors = validateSkillData({
                type: 'candlestick',
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['rsi_oversold'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/unknown trigger "rsi_oversold"/);
            expect(errors[0]).toMatch(/candle-pattern name/);
        });

        it('rejects a chart-pattern id on a candlestick skill', () => {
            const errors = validateSkillData({
                type: 'candlestick',
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['double_top'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/unknown trigger "double_top"/);
            expect(errors[0]).toMatch(/candle-pattern name/);
        });

        it('a skill with no `type` field is validated against the signal vocabulary', () => {
            const errors = validateSkillData({
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['hammer'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/unknown trigger "hammer"/);
        });
    });

    describe('usage_roles', () => {
        // These fixtures all include a valid `gating` block so the assertion
        // isolates the usage_roles check under test — otherwise the missing
        // `gating` block would surface as an extra, unrelated error.
        const VALID_GATING = {
            tier: 'gated' as const,
            signal_kind: 'event' as const,
            triggers: ['rsi_oversold'],
        };

        it('indicator_guide with valid [signal, confirmation] passes', () => {
            expect(
                validateSkillData({
                    type: 'indicator_guide',
                    usage_roles: ['signal', 'confirmation'],
                    gating: VALID_GATING,
                })
            ).toEqual([]);
        });

        it('indicator_guide missing usage_roles fails', () => {
            const errors = validateSkillData({
                type: 'indicator_guide',
                gating: VALID_GATING,
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/usage_roles/);
        });

        it('indicator_guide with empty [] fails', () => {
            const errors = validateSkillData({
                type: 'indicator_guide',
                usage_roles: [],
                gating: VALID_GATING,
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/usage_roles/);
        });

        it('indicator_guide with non-array scalar fails', () => {
            const errors = validateSkillData({
                type: 'indicator_guide',
                usage_roles: 'signal',
                gating: VALID_GATING,
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/usage_roles/);
        });

        it('indicator_guide with unknown role fails', () => {
            const errors = validateSkillData({
                type: 'indicator_guide',
                usage_roles: ['signal', 'bogus_role'],
                gating: VALID_GATING,
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/invalid usage_role/);
        });

        it('indicator_guide with duplicate role fails', () => {
            const errors = validateSkillData({
                type: 'indicator_guide',
                usage_roles: ['signal', 'signal'],
                gating: VALID_GATING,
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/duplicate usage_role/);
        });

        it('indicator_guide with wrong order [confirmation, signal] fails', () => {
            const errors = validateSkillData({
                type: 'indicator_guide',
                usage_roles: ['confirmation', 'signal'],
                gating: VALID_GATING,
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/canonical order/);
        });

        it('non-indicator skill (type: pattern) with usage_roles fails', () => {
            const errors = validateSkillData({
                type: 'pattern',
                usage_roles: ['signal'],
                // `type: pattern` triggers must come from the pattern
                // vocabulary — use a valid chart-pattern id here so the
                // assertion isolates the usage_roles check under test.
                gating: {
                    tier: 'gated' as const,
                    signal_kind: 'event' as const,
                    triggers: ['head_and_shoulders'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/usage_roles/);
        });

        it('always_on indicator_guide without usage_roles passes (exemption taken)', () => {
            // always_on skills are injected unconditionally — role-based routing
            // does not apply, so usage_roles is optional.
            expect(
                validateSkillData({
                    type: 'indicator_guide',
                    gating: { tier: 'always_on' },
                })
            ).toEqual([]);
        });

        it('gated indicator_guide without usage_roles fails (exemption NOT applied)', () => {
            // The always_on exemption must not extend to gated skills — they still
            // require a non-empty usage_roles array so role-based routing can fire.
            const errors = validateSkillData({
                type: 'indicator_guide',
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['rsi_oversold'],
                },
            });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatch(/usage_roles/);
        });
    });

    describe('unreachable skills', () => {
        it('rejects an event-gated skill with empty triggers', () => {
            const errors = validateSkillData({
                gating: {
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: [],
                },
            });
            expect(errors[0]).toMatch(/unreachable/);
        });

        it('rejects an event-gated skill with no triggers field', () => {
            const errors = validateSkillData({
                gating: { tier: 'gated', signal_kind: 'event' },
            });
            expect(errors[0]).toMatch(/unreachable/);
        });

        it('rejects a state-gated skill with no state predicate', () => {
            const errors = validateSkillData({
                gating: { tier: 'gated', signal_kind: 'state' },
            });
            expect(errors[0]).toMatch(/unreachable/);
        });

        it('rejects an invalid state feature', () => {
            const errors = validateSkillData({
                gating: {
                    tier: 'gated',
                    signal_kind: 'state',
                    state: { feature: 'bogus', predicate: 'pctB' },
                },
            });
            expect(errors[0]).toMatch(/state\.feature/);
        });

        it('rejects a valid feature paired with an invalid predicate', () => {
            const errors = validateSkillData({
                gating: {
                    tier: 'gated',
                    signal_kind: 'state',
                    state: {
                        feature: 'bollinger',
                        predicate: 'bogus_predicate',
                    },
                },
            });
            expect(errors[0]).toMatch(/state\.predicate/);
        });

        it('rejects a (feature, predicate) pair the core never evaluates', () => {
            // bollinger only supports pctB; channelProximity is never evaluated
            // for it → the skill would be unreachable.
            const errors = validateSkillData({
                gating: {
                    tier: 'gated',
                    signal_kind: 'state',
                    state: {
                        feature: 'bollinger',
                        predicate: 'channelProximity',
                    },
                },
            });
            expect(errors[0]).toMatch(/unreachable state predicate/);
        });
    });
});

describe('parseSkillFile fail-closed parse failures', () => {
    // Both branches below must surface as an *error* (so `main()` exits 1 —
    // fail-closed drop), never as a silently-accepted valid skill. These cover
    // the gray-matter try/catch and the "frontmatter missing/not a mapping"
    // check in parseSkillFile, which had no test before this file.
    let dir: string;

    const writeFixture = (name: string, content: string): string => {
        const file = join(dir, name);
        writeFileSync(file, content);
        return file;
    };

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'validate-skills-test-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('drops a file with unparseable (broken) YAML frontmatter', () => {
        // Unbalanced `{` in a flow mapping — js-yaml (via gray-matter) throws
        // rather than returning malformed data.
        const file = writeFixture(
            'broken-yaml.md',
            '---\ngating: {tier: gated\n---\nbody text\n'
        );
        const result = parseSkillFile(file);
        expect(result.hasGating).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toMatch(
            /failed to parse frontmatter/
        );
    });

    it('drops a file whose frontmatter parses to a non-mapping (e.g. a YAML list)', () => {
        // Valid YAML, but the top-level value is an array, not a mapping —
        // gray-matter does not throw here, so this exercises the separate
        // `!isRecord(parsed.data)` guard.
        const file = writeFixture(
            'non-mapping.md',
            '---\n- just\n- a\n- list\n---\nbody text\n'
        );
        const result = parseSkillFile(file);
        expect(result.hasGating).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toMatch(
            /frontmatter is missing or not a mapping/
        );
    });
});
