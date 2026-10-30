import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { SHARE_KIND_OG_BUILDERS } from '@/entities/shared-analysis/server/kindServerRegistry';

const tOg = catalogTranslator('entities.shared-analysis.og', 'ko');

describe('SHARE_KIND_OG_BUILDERS malformed stored result', () => {
    it('overall: ignores a non-array scenarios value', () => {
        const out = SHARE_KIND_OG_BUILDERS.overall(
            { scenarios: { length: 2 }, headlineKo: '요약' },
            'AAPL',
            tOg
        );
        expect(out.description).toBe(`${tOg('neutral')}: 요약`);
    });

    it('overall: skips null and nameless scenario entries', () => {
        const out = SHARE_KIND_OG_BUILDERS.overall(
            {
                scenarios: [null, 7, {}, { name: 'bullish' }],
                headlineKo: '요약',
            },
            'AAPL',
            tOg
        );
        expect(out.description).toBe(`${tOg('bullish')}: 요약`);
    });

    it('overall: picks the most frequent scenario name', () => {
        const out = SHARE_KIND_OG_BUILDERS.overall(
            {
                scenarios: [
                    { name: 'bearish' },
                    { name: 'bullish' },
                    { name: 'bearish' },
                ],
                headlineKo: '요약',
            },
            'AAPL',
            tOg
        );
        expect(out.description).toBe(`${tOg('bearish')}: 요약`);
    });

    it('options: falls back to tone when signals is not an array', () => {
        const out = SHARE_KIND_OG_BUILDERS.options(
            { signals: 'bullish', tone: 'bearish', summary: '요약' },
            'AAPL',
            tOg
        );
        expect(out.description).toBe(`${tOg('bearish')}: 요약`);
    });

    it('overall: does not count a numeric scenario name', () => {
        const out = SHARE_KIND_OG_BUILDERS.overall(
            { scenarios: [{ name: 7 }, { name: 7 }], headlineKo: '요약' },
            'AAPL',
            tOg
        );
        expect(out.description).toBe(`${tOg('neutral')}: 요약`);
    });

    it('options: falls back to tone when the first signal kind is numeric', () => {
        const out = SHARE_KIND_OG_BUILDERS.options(
            { signals: [{ kind: 7 }], tone: 'bearish', summary: '요약' },
            'AAPL',
            tOg
        );
        expect(out.description).toBe(`${tOg('bearish')}: 요약`);
    });

    it('options: uses the first signal kind when present', () => {
        const out = SHARE_KIND_OG_BUILDERS.options(
            {
                signals: [{ kind: 'bullish' }],
                tone: 'bearish',
                summary: '요약',
            },
            'AAPL',
            tOg
        );
        expect(out.description).toBe(`${tOg('bullish')}: 요약`);
    });

    it('options: falls back to tone when the first signal is null', () => {
        const out = SHARE_KIND_OG_BUILDERS.options(
            { signals: [null], tone: 'bearish', summary: '요약' },
            'AAPL',
            tOg
        );
        expect(out.description).toBe(`${tOg('bearish')}: 요약`);
    });
});

describe('SHARE_KIND_OG_BUILDERS', () => {
    it('has a builder for every ShareableKind (8 kinds)', () => {
        expect(Object.keys(SHARE_KIND_OG_BUILDERS).length).toBe(
            SHAREABLE_KIND_VALUES.length
        );
        for (const kind of SHAREABLE_KIND_VALUES) {
            expect(typeof SHARE_KIND_OG_BUILDERS[kind]).toBe('function');
        }
    });
});
