import { describe, expect, it } from 'vitest';
import {
    SUMMARY_SINGLE_ROW_MAX_CARDS,
    summaryGridColumnsClass,
} from '../summaryGridColumns';

describe('summaryGridColumnsClass', () => {
    it('keeps up to the single-row maximum on four columns', () => {
        expect(summaryGridColumnsClass(SUMMARY_SINGLE_ROW_MAX_CARDS)).toBe(
            'lg:grid-cols-4'
        );
    });

    it('folds to three columns past the single-row maximum', () => {
        expect(summaryGridColumnsClass(SUMMARY_SINGLE_ROW_MAX_CARDS + 1)).toBe(
            'lg:grid-cols-3'
        );
    });
});
