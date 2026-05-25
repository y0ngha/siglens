import {
    parseStructuredSummary,
    MIN_STRUCTURED_SUMMARY_SECTIONS,
} from '@/widgets/analysis/utils/parseStructuredSummary';

describe('parseStructuredSummary missing fields', () => {
    it('returns null when summary is empty string', () => {
        expect(parseStructuredSummary('')).toBeNull();
    });

    it('returns null when summary has no structured sections', () => {
        const plainText = 'This is just regular text without any bold labels.';
        expect(parseStructuredSummary(plainText)).toBeNull();
    });

    it('returns null when fewer than minimum sections', () => {
        const twoSections = '**Label1**: value1\n**Label2**: value2';
        expect(parseStructuredSummary(twoSections)).toBeNull();
        expect(MIN_STRUCTURED_SUMMARY_SECTIONS).toBe(3);
    });

    it('parses valid structured summary with enough sections', () => {
        const valid = [
            '**종합 의견**: 매수',
            '**신뢰도**: 높음',
            '**핵심 포인트**: 상승 추세 유지',
        ].join('\n');

        const result = parseStructuredSummary(valid);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(3);
        expect(result![0]).toEqual({ label: '종합 의견', value: '매수' });
    });

    it('filters out non-structured lines mixed with structured ones', () => {
        const mixed = [
            '**Label1**: value1',
            'plain text line',
            '**Label2**: value2',
            '',
            '**Label3**: value3',
        ].join('\n');

        const result = parseStructuredSummary(mixed);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(3);
    });

    it('handles short value after label', () => {
        const withShortValue = [
            '**Label1**: a',
            '**Label2**: value2',
            '**Label3**: value3',
        ].join('\n');

        const result = parseStructuredSummary(withShortValue);

        expect(result).not.toBeNull();
        expect(result![0].value).toBe('a');
    });

    it('returns null when all lines are blank', () => {
        expect(parseStructuredSummary('\n\n\n')).toBeNull();
    });

    it('handles multiline sections (only first line matched)', () => {
        const multiline = [
            '**Label1**: start of value',
            'continuation of value',
            '**Label2**: value2',
            '**Label3**: value3',
        ].join('\n');

        const result = parseStructuredSummary(multiline);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(3);
        expect(result![0].value).toBe('start of value');
    });

    it('handles label with special characters', () => {
        const special = [
            '**Key Levels (지지/저항)**: $150, $175',
            '**RSI (14)**: 65.2',
            '**MACD**: 상승 크로스',
        ].join('\n');

        const result = parseStructuredSummary(special);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(3);
    });
});
