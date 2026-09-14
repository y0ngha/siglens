import { describe, expect, it } from 'vitest';
import { fitProse } from '@/app/api/ai/chat/tools/fitProse';
import { CACHED_ANALYSIS_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

describe('fitProse', () => {
    it('envelope가 예산 이내면 필드를 그대로 반환한다', () => {
        const envelope = { analysis: { summary: 'short', items: ['a', 'b'] } };
        const out = fitProse(envelope, {
            summary: { kind: 'text', value: 'short' },
            items: { kind: 'list', value: ['a', 'b'] },
        });
        expect(out).toEqual({ summary: 'short', items: ['a', 'b'] });
    });

    it('예산 초과 시 text 필드는 잘리고, list 필드는 통째로 들어가는 항목만 앞에서부터 남긴다', () => {
        const longText = 'x'.repeat(CACHED_ANALYSIS_MAX_CHARS);
        const items = Array.from({ length: 50 }, (_, i) =>
            `item-${i}-`.repeat(20)
        );
        const envelope = { analysis: { summary: longText, items } };
        const out = fitProse(envelope, {
            summary: { kind: 'text', value: longText },
            items: { kind: 'list', value: items },
        });
        expect((out.summary as string).length).toBeLessThan(longText.length);
        const kept = out.items as string[];
        expect(kept.length).toBeGreaterThan(0);
        expect(kept.length).toBeLessThan(items.length);
        // Kept items are a prefix — every kept item is byte-identical to an
        // original, never a mid-item slice.
        expect(kept.every((item, i) => item === items[i])).toBe(true);
    });

    it('list 필드는 통째로 들어가지 않는 항목을 중간에서 자르지 않고 통째로 드롭한다', () => {
        // A large fixed field OUTSIDE the `fields` spec (mirrors
        // `keyLevels`/`priceTargets` in the real technical-analysis envelope)
        // eats most of the budget, leaving room for only some of `items`.
        const items = Array.from({ length: 5 }, (_, i) =>
            `item-${i}-`.repeat(300)
        );
        const envelope = {
            analysis: {
                bulk: 'f'.repeat(CACHED_ANALYSIS_MAX_CHARS - 3_000),
                items,
            },
        };
        const out = fitProse(envelope, {
            items: { kind: 'list', value: items },
        });
        const kept = out.items as string[];
        expect(kept.length).toBeGreaterThan(0);
        expect(kept.length).toBeLessThan(items.length);
        // Kept items are a byte-identical prefix — never a mid-item slice.
        expect(kept.every((item, i) => item === items[i])).toBe(true);
    });

    it('여러 필드가 예산을 나눠 쓴다 — 균등 분배', () => {
        const longA = 'a'.repeat(CACHED_ANALYSIS_MAX_CHARS);
        const longB = 'b'.repeat(CACHED_ANALYSIS_MAX_CHARS);
        const envelope = { analysis: { a: longA, b: longB } };
        const out = fitProse(envelope, {
            a: { kind: 'text', value: longA },
            b: { kind: 'text', value: longB },
        });
        const lenA = (out.a as string).length;
        const lenB = (out.b as string).length;
        expect(lenA).toBeGreaterThan(0);
        expect(lenB).toBeGreaterThan(0);
        // Split evenly: neither field should dominate the whole budget.
        expect(Math.abs(lenA - lenB)).toBeLessThan(10);
    });

    it('남은 예산이 0 이하로 떨어져도 빈 값을 반환할 뿐 throw하지 않는다', () => {
        // A large fixed field OUTSIDE the `fields` spec already consumes the
        // whole ceiling by itself, so `targetLeavesSize` clamps to 0 via
        // `Math.max(0, ...)` regardless of the prose field's own size.
        const envelope = {
            analysis: {
                bulk: 'y'.repeat(CACHED_ANALYSIS_MAX_CHARS),
                summary: 'z'.repeat(100),
            },
        };
        const out = fitProse(envelope, {
            summary: { kind: 'text', value: 'z'.repeat(100) },
        });
        expect(out.summary).toBe('');
    });

    it('spec이 비어 있으면 빈 객체를 반환한다', () => {
        const envelope = { analysis: {} };
        expect(fitProse(envelope, {})).toEqual({});
    });

    it('list 필드가 undefined/빈 배열이면 빈 배열을 반환한다', () => {
        const envelope = { analysis: { items: undefined } };
        const out = fitProse(envelope, {
            items: { kind: 'list', value: undefined },
        });
        expect(out.items).toEqual([]);
    });

    it('text 필드가 null/undefined면 빈 문자열로 취급한다', () => {
        const envelope = { analysis: { summary: null } };
        const out = fitProse(envelope, {
            summary: { kind: 'text', value: null },
        });
        expect(out.summary).toBe('');
    });
});
