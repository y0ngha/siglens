import { COMPUTED_CARD_KINDS } from '@y0ngha/siglens-core';
import matter from 'gray-matter';
import {
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseSkillFile, validateSkillData } from '../validate-skills';

describe('validateSkillData — display.chart.color', () => {
    const base = { gating: { tier: 'always_on' } };

    it('accepts a 6-digit hex color and an absent display block', () => {
        expect(
            validateSkillData({
                ...base,
                display: { chart: { color: '#26A69a' } },
            })
        ).toEqual([]);
        expect(validateSkillData(base)).toEqual([]);
    });

    it.each(['rgb(38, 166, 154)', 'teal', '#26a', '#26a69a80', 123])(
        'rejects %s (overlay dimming appends a hex alpha)',
        color => {
            expect(
                validateSkillData({ ...base, display: { chart: { color } } })
            ).toEqual([
                expect.stringContaining(
                    '`display.chart.color` must be a 6-digit hex'
                ),
            ]);
        }
    );
});

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
            // The 22 ChartPatternId values are accepted via PATTERN_TRIGGER_CATALOG
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

describe('validateSkillData — overlay_kind', () => {
    const strategy = { type: 'strategy', gating: { tier: 'always_on' } };

    it.each(['divergence', 'fibonacci', 'elliott'])(
        'accepts overlay_kind: %s on a strategy',
        kind => {
            expect(
                validateSkillData({ ...strategy, overlay_kind: kind })
            ).toEqual([]);
        }
    );

    it('rejects an unknown value — core would silently drop every drawing', () => {
        expect(validateSkillData({ ...strategy, overlay_kind: 'fib' })).toEqual(
            [expect.stringContaining('`overlay_kind` must be one of')]
        );
    });

    it('rejects overlay_kind on a non-strategy skill', () => {
        expect(
            validateSkillData({
                type: 'pattern',
                gating: { tier: 'always_on' },
                overlay_kind: 'elliott',
            })
        ).toEqual(['`overlay_kind` is only allowed on type: strategy']);
    });
});

// core는 전략 카드에 `overlay_kind`가 없으면 그 전략 작도를 전부 버린다 — 이 세
// 스킬에서 키가 빠지면 차트의 엘리어트·피보나치·다이버전스 작도가 조용히 사라진다.
describe('strategy skills that draw chart overlays', () => {
    it.each([
        ['elliott-wave', 'elliott'],
        ['fibonacci', 'fibonacci'],
        ['divergence', 'divergence'],
    ])('skills/strategies/%s.md declares overlay_kind: %s', (file, kind) => {
        const { data } = matter(
            readFileSync(
                join(process.cwd(), 'skills/strategies', `${file}.md`),
                'utf-8'
            )
        );
        expect(data.overlay_kind).toBe(kind);
    });
});

describe('validateSkillData — computed_card', () => {
    const guide = { type: 'indicator_guide', gating: { tier: 'always_on' } };
    const strategy = { type: 'strategy', gating: { tier: 'always_on' } };
    const required = { requireOnIndicatorGuide: true };

    it('accepts every core kind on its own skill type', () => {
        const indicatorKinds = COMPUTED_CARD_KINDS.filter(
            kind => kind !== 'ma_cycle' && kind !== 'macd_cycle'
        );
        expect(indicatorKinds).toHaveLength(36);
        indicatorKinds.forEach(kind => {
            expect(
                validateSkillData({ ...guide, computed_card: kind })
            ).toEqual([]);
        });
        ['ma_cycle', 'macd_cycle'].forEach(kind => {
            expect(
                validateSkillData({ ...strategy, computed_card: kind })
            ).toEqual([]);
        });
    });

    it('rejects a value core does not list — core would silently build no card', () => {
        expect(
            validateSkillData({ ...guide, computed_card: 'rsi_v2' })
        ).toEqual([expect.stringContaining('`computed_card` must be one of')]);
        expect(validateSkillData({ ...guide, computed_card: 7 })).toEqual([
            expect.stringContaining('`computed_card` must be one of'),
        ]);
    });

    it('rejects the tag on a type that has no card', () => {
        expect(
            validateSkillData({
                type: 'pattern',
                gating: { tier: 'always_on' },
                computed_card: 'rsi',
            })
        ).toEqual([
            '`computed_card` is only allowed on type: indicator_guide or strategy',
        ]);
    });

    it('keeps cycle kinds on strategies and indicator kinds on indicator guides', () => {
        expect(
            validateSkillData({ ...strategy, computed_card: 'rsi' })
        ).toEqual([expect.stringContaining('is an indicator card kind')]);
        expect(
            validateSkillData({ ...guide, computed_card: 'macd_cycle' })
        ).toEqual([expect.stringContaining('is a cycle card kind')]);
    });

    it('requires a tag on a non-reference indicator guide only when asked to', () => {
        expect(validateSkillData(guide, required)).toEqual([
            expect.stringContaining('`computed_card` is required'),
        ]);
        expect(validateSkillData(guide)).toEqual([]);
        expect(validateSkillData(strategy, required)).toEqual([]);
        expect(
            validateSkillData({ ...guide, computed_card: 'rsi' }, required)
        ).toEqual([]);
    });

    it('reports the tag error next to a missing gating block', () => {
        expect(
            validateSkillData({ type: 'strategy', computed_card: 'x' })
        ).toEqual([
            expect.stringContaining('`computed_card` must be one of'),
            expect.stringContaining('missing `gating` block'),
        ]);
    });
});

// 카드는 태그가 있는 스킬만 만들어진다 — 파일에서 태그가 빠지면 패널의 해당 지표 카드가
// 에러 없이 사라진다. 참조 문서(`_core/`, SMC 전체 가이드)는 카드가 없는 게 맞다.
describe('skills/ computed_card tags', () => {
    const skillFiles = (dir: string): string[] =>
        readdirSync(join(process.cwd(), 'skills', dir))
            .filter(name => name.endsWith('.md'))
            .map(name => join(process.cwd(), 'skills', dir, name));

    it('tags every indicator guide except the SMC full guide, one kind each', () => {
        const kinds = skillFiles('indicators')
            .map(file => matter(readFileSync(file, 'utf-8')).data)
            .filter(data => data.smc_full_guide !== true)
            .map(data => data.computed_card);
        expect(kinds).toHaveLength(36);
        expect(new Set(kinds).size).toBe(36);
        expect(kinds.every(kind => COMPUTED_CARD_KINDS.includes(kind))).toBe(
            true
        );
    });

    it.each([
        ['ma-cycle', 'ma_cycle'],
        ['macd-cycle', 'macd_cycle'],
    ])('skills/strategies/%s.md declares computed_card: %s', (file, kind) => {
        const { data } = matter(
            readFileSync(
                join(process.cwd(), 'skills/strategies', `${file}.md`),
                'utf-8'
            )
        );
        expect(data.computed_card).toBe(kind);
    });

    it('lets the CLI path pass every real skill file', async () => {
        const files = [
            ...skillFiles('indicators'),
            ...skillFiles('strategies'),
            ...skillFiles('_core'),
        ];
        const errors = files.flatMap(file => parseSkillFile(file).errors);
        expect(errors).toEqual([]);
    });
});
