import { describe, expect, it } from 'vitest';
import { validateSkillData } from '../validate-skills';

describe('validateSkillData', () => {
    describe('valid frontmatter', () => {
        it('untagged skill (no gating block) produces no errors', () => {
            expect(
                validateSkillData({ name: 'x', confidence_weight: 0.5 })
            ).toEqual([]);
        });

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
                    gating: {
                        tier: 'gated',
                        signal_kind: 'event',
                        triggers: ['hammer', 'bullish_engulfing'],
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
                    state: { feature: 'bollinger', predicate: 'bogus_predicate' },
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
