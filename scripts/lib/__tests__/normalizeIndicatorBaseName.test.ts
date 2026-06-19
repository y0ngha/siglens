import { describe, it, expect } from 'vitest';
import { normalizeIndicatorBaseName } from '../normalizeIndicatorBaseName';

describe('normalizeIndicatorBaseName', () => {
    it('strips a trailing month suffix', () => {
        expect(
            normalizeIndicatorBaseName('Core PCE Price Index YoY (May)')
        ).toBe('Core PCE Price Index YoY');
    });
    it('strips a trailing quarter suffix', () => {
        expect(normalizeIndicatorBaseName('GDP Growth Rate QoQ (Q1)')).toBe(
            'GDP Growth Rate QoQ'
        );
    });
    it('strips a trailing date-token suffix', () => {
        expect(
            normalizeIndicatorBaseName('Fed Interest Rate Decision (Jun/20)')
        ).toBe('Fed Interest Rate Decision');
    });
    it('leaves names without a trailing suffix unchanged', () => {
        expect(normalizeIndicatorBaseName('Initial Jobless Claims')).toBe(
            'Initial Jobless Claims'
        );
    });
    it('trims surrounding whitespace', () => {
        expect(normalizeIndicatorBaseName('  CPI YoY (Apr)  ')).toBe('CPI YoY');
    });
    it('only strips the final parenthetical, not interior ones', () => {
        expect(normalizeIndicatorBaseName('Index (ex Food) MoM (Apr)')).toBe(
            'Index (ex Food) MoM'
        );
    });
});
