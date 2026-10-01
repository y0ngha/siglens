import { describe, expect, it } from 'vitest';
import {
    fibLegDirection,
    formatFibLevelLabel,
    parseFibLevelLabel,
} from '../../utils/fibLevelLabel';

describe('parseFibLevelLabel', () => {
    it.each([
        ['23.6%', 'retracement', '23.6%'],
        ['50%', 'retracement', '50%'],
        ['78.6%', 'retracement', '78.6%'],
        ['ext 127.2%', 'extension', '127.2%'],
        ['ABC 161.8%', 'abcExtension', '161.8%'],
        // core 2.2.1 이하 캐시 분석 — `ext ` 접두사 없이 확장이 온다.
        ['100%', 'extension', '100%'],
        ['161.8%', 'extension', '161.8%'],
    ])('%s → %s', (label, kind, percent) => {
        expect(parseFibLevelLabel(label)).toEqual({ kind, percent });
    });

    it.each(['breakout', '', 'ext', '61.8'])(
        '피보나치 라벨이 아니면 null: %j',
        label => {
            expect(parseFibLevelLabel(label)).toBeNull();
        }
    );
});

const seg = (from: number, to: number) => ({
    from: { time: 1, price: from },
    to: { time: 2, price: to },
    role: 'anchor' as const,
    style: 'dashed' as const,
    pane: 'price' as const,
});
const fibOverlay = (from: number, to: number) => ({
    kind: 'fibonacci' as const,
    segments: [seg(from, to)],
});

describe('fibLegDirection', () => {
    it('첫 앵커 선분의 끝 가격이 낮으면 하락, 아니면 상승', () => {
        expect(fibLegDirection([seg(185, 162)])).toBe('down');
        expect(fibLegDirection([seg(120, 185)])).toBe('up');
    });

    it('ABC는 첫 선분(A→B)만 본다 — B→C 되돌림 방향은 무시', () => {
        expect(fibLegDirection([seg(185, 120), seg(120, 150)])).toBe('down');
        expect(fibLegDirection([seg(120, 185), seg(185, 160)])).toBe('up');
    });

    it('수평 선분(가격 같음)은 상승으로 본다 — core가 만들지 않는 경계값의 기본값', () => {
        expect(fibLegDirection([seg(150, 150)])).toBe('up');
    });

    it('선분이 없으면 null', () => {
        expect(fibLegDirection([])).toBeNull();
    });
});

describe('formatFibLevelLabel', () => {
    const texts = {
        retracement: {
            down: (p: string) => `반등 ${p}`,
            up: (p: string) => `눌림 ${p}`,
        },
        extension: {
            down: (p: string) => `하락 목표 ${p}`,
            up: (p: string) => `상승 목표 ${p}`,
        },
        abcExtension: {
            down: (p: string) => `ABC 하락 목표 ${p}`,
            up: (p: string) => `ABC 상승 목표 ${p}`,
        },
    };

    it.each([
        ['61.8%', 185, 162, '반등 61.8%'],
        ['61.8%', 120, 185, '눌림 61.8%'],
        ['ext 127.2%', 185, 162, '하락 목표 127.2%'],
        ['ext 127.2%', 120, 185, '상승 목표 127.2%'],
        ['ABC 161.8%', 120, 185, 'ABC 상승 목표 161.8%'],
        ['ABC 161.8%', 185, 120, 'ABC 하락 목표 161.8%'],
    ])('%s (다리 %s→%s) → %s', (label, from, to, expected) => {
        expect(formatFibLevelLabel(label, fibOverlay(from, to), texts)).toBe(
            expected
        );
    });

    it('피보나치 라벨이 아니거나, 피보나치 작도가 아니거나, 방향 미상이면 null', () => {
        expect(
            formatFibLevelLabel('breakout', fibOverlay(1, 2), texts)
        ).toBeNull();
        expect(
            formatFibLevelLabel(
                '61.8%',
                { kind: 'pattern', segments: [seg(1, 2)] },
                texts
            )
        ).toBeNull();
        expect(
            formatFibLevelLabel(
                '61.8%',
                { kind: 'fibonacci', segments: [] },
                texts
            )
        ).toBeNull();
    });
});
