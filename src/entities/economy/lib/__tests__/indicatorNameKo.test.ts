import { describe, it, expect } from 'vitest';
import {
    normalizeIndicatorName,
    koreanizePeriodToken,
    indicatorLabelKoFromMaps,
    INDICATOR_NAME_KO,
} from '@/entities/economy/lib/indicatorNameKo';

describe('normalizeIndicatorName', () => {
    it('splits a trailing month parenthetical into base + period', () => {
        expect(
            normalizeIndicatorName('Core PCE Price Index YoY (May)')
        ).toEqual({ base: 'Core PCE Price Index YoY', period: 'May' });
    });

    it('splits a trailing quarter parenthetical', () => {
        expect(normalizeIndicatorName('GDP Growth Rate QoQ (Q1)')).toEqual({
            base: 'GDP Growth Rate QoQ',
            period: 'Q1',
        });
    });

    it('splits a slash date-token parenthetical', () => {
        expect(
            normalizeIndicatorName('Fed Interest Rate Decision (Jun/20)')
        ).toEqual({ base: 'Fed Interest Rate Decision', period: 'Jun/20' });
    });

    it('returns an empty period when there is no parenthetical', () => {
        expect(normalizeIndicatorName('Initial Jobless Claims')).toEqual({
            base: 'Initial Jobless Claims',
            period: '',
        });
    });

    it('strips only the final parenthetical, preserving interior ones', () => {
        expect(normalizeIndicatorName('Index (ex Food) MoM (Apr)')).toEqual({
            base: 'Index (ex Food) MoM',
            period: 'Apr',
        });
    });

    it('trims surrounding whitespace from base', () => {
        expect(normalizeIndicatorName('  CPI YoY (Apr)  ')).toEqual({
            base: 'CPI YoY',
            period: 'Apr',
        });
    });
});

describe('koreanizePeriodToken', () => {
    it('translates change-direction tokens', () => {
        expect(koreanizePeriodToken('YoY')).toBe('전년比');
        expect(koreanizePeriodToken('MoM')).toBe('전월比');
        expect(koreanizePeriodToken('QoQ')).toBe('전분기比');
    });

    it('translates month abbreviations', () => {
        expect(koreanizePeriodToken('May')).toBe('5월');
        expect(koreanizePeriodToken('Jan')).toBe('1월');
        expect(koreanizePeriodToken('Dec')).toBe('12월');
    });

    it('translates quarter tokens', () => {
        expect(koreanizePeriodToken('Q1')).toBe('1분기');
        expect(koreanizePeriodToken('Q4')).toBe('4분기');
    });

    it('returns an unknown token unchanged', () => {
        expect(koreanizePeriodToken('Jun/20')).toBe('Jun/20');
        expect(koreanizePeriodToken('')).toBe('');
    });
});

describe('indicatorLabelKoFromMaps', () => {
    it('renders dict base + Korean period when the base is mapped', () => {
        expect(
            indicatorLabelKoFromMaps('Core PCE Price Index YoY (May)', {})
        ).toBe('근원 PCE 물가지수(전년比) (5월)');
    });

    it('renders a mapped base with no period parenthetical', () => {
        expect(indicatorLabelKoFromMaps('Nonfarm Payrolls', {})).toBe(
            '비농업 고용'
        );
    });

    it('falls back to the DB-cache map when dict misses', () => {
        expect(
            indicatorLabelKoFromMaps('Some Obscure Index YoY (May)', {
                'Some Obscure Index YoY': '어떤 모호한 지수(전년比)',
            })
        ).toBe('어떤 모호한 지수(전년比) (5월)');
    });

    it('falls back to the raw English name when both maps miss', () => {
        expect(
            indicatorLabelKoFromMaps('Totally Unknown Thing (Apr)', {})
        ).toBe('Totally Unknown Thing (Apr)');
    });

    it('seeds the dictionary with confirmed common indicators', () => {
        expect(INDICATOR_NAME_KO['Nonfarm Payrolls']).toBe('비농업 고용');
        expect(INDICATOR_NAME_KO['ADP Employment Change']).toBe(
            'ADP 고용 변화'
        );
        expect(INDICATOR_NAME_KO['10-Year Note Auction']).toBe(
            '10년물 국채 입찰'
        );
    });
});
