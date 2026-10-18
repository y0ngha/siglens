import type { ChartOverlay } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { isReachedTarget, targetDirectionOf } from '../../utils/reachedLevel';

const seg = (
    from: number,
    to: number,
    role: string
): ChartOverlay['segments'][number] => ({
    from: { time: 1, price: from },
    to: { time: 2, price: to },
    role,
    style: 'solid',
    pane: 'price',
});

const base: ChartOverlay = {
    id: 'x',
    kind: 'elliott',
    skill: 'elliott-wave',
    sourceRef: 's',
    variant: 'primary',
    segments: [],
    levels: [],
    labels: [],
};

// Impulse down then A–B–C up: A rises 186 → 265, so C targets sit above.
const impulseAbc: ChartOverlay = {
    ...base,
    id: 'ew:down:1782345600:6:abc',
    segments: [seg(372, 285, 'wave_1'), seg(186, 265, 'wave_A')],
};
// Triangle, A down: the thrust out of it runs up (against A).
const triangle: ChartOverlay = {
    ...base,
    id: 'ew:down:0:tri',
    segments: [seg(120, 100, 'wave_A'), seg(100, 116, 'wave_B')],
};
const fibUpLeg: ChartOverlay = {
    ...base,
    id: 'fib:short:1',
    kind: 'fibonacci',
    skill: 'fibonacci-retracement',
    segments: [seg(248, 281, 'anchor')],
};

describe('targetDirectionOf', () => {
    it('an A–B–C C target runs with A; a triangle thrust against A', () => {
        expect(targetDirectionOf('target 100%', impulseAbc)).toBe('up');
        expect(targetDirectionOf('target', triangle)).toBe('up');
    });

    it('a fib extension runs with its leg; a retracement is not a target', () => {
        expect(targetDirectionOf('ext 127.2%', fibUpLeg)).toBe('up');
        expect(targetDirectionOf('ABC 161.8%', fibUpLeg)).toBe('up');
        expect(targetDirectionOf('61.8%', fibUpLeg)).toBeNull();
    });

    it('invalidations, caps and other kinds are not targets', () => {
        expect(targetDirectionOf('invalidation', impulseAbc)).toBeNull();
        expect(targetDirectionOf('wave5_cap', impulseAbc)).toBeNull();
        expect(
            targetDirectionOf('target', { ...base, id: 'ew:up:0:6' })
        ).toBeNull();
        expect(
            targetDirectionOf('target', { ...impulseAbc, kind: 'pattern' })
        ).toBeNull();
    });
});

describe('isReachedTarget', () => {
    it('an up target is reached once the last close is above it, not before', () => {
        const target = { label: 'target 100%', price: 305_000 };
        expect(isReachedTarget(target, impulseAbc, 306_000)).toBe(true);
        expect(isReachedTarget(target, impulseAbc, 305_000)).toBe(false);
        expect(isReachedTarget(target, impulseAbc, 290_000)).toBe(false);
    });

    it('a down target is reached below it', () => {
        const downLeg: ChartOverlay = {
            ...fibUpLeg,
            segments: [seg(281, 248, 'anchor')],
        };
        const ext = { label: 'ext 127.2%', price: 239 };
        expect(isReachedTarget(ext, downLeg, 230)).toBe(true);
        expect(isReachedTarget(ext, downLeg, 245)).toBe(false);
    });

    it('is never reached without a usable last close, or for a non-target', () => {
        const target = { label: 'target 100%', price: 305_000 };
        expect(isReachedTarget(target, impulseAbc, null)).toBe(false);
        expect(isReachedTarget(target, impulseAbc, Number.NaN)).toBe(false);
        expect(
            isReachedTarget(
                { label: 'invalidation', price: 189_200 },
                impulseAbc,
                100_000
            )
        ).toBe(false);
    });
});
