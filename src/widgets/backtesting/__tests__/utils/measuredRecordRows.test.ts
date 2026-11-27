import {
    PATTERN_BASE_RATES,
    PATTERN_POOLED_BASE_RATE,
    PRICE_LEVEL_BASE_RATE,
    PRICE_LEVEL_FAMILY_BASE_RATES,
} from '@y0ngha/siglens-core';
import { levelRecord, patternRecord } from '../../utils/measuredRecordRows';

describe('patternRecord', () => {
    it('keeps own rows in the constant key order, never sorted by share', () => {
        const { own } = patternRecord();
        const expected = Object.entries(PATTERN_BASE_RATES)
            .filter(([, rate]) => rate?.key !== 'pooled')
            .map(([id]) => id);
        expect(own.map(row => row.id)).toEqual(expected);
        const shares = own.map(row => row.rate?.eventShare ?? 0);
        expect(shares).not.toEqual(shares.toSorted((a, b) => a - b));
        expect(shares).not.toEqual(shares.toSorted((a, b) => b - a));
    });

    it('takes the pooled row from the whole-set constant, not from a small family copy', () => {
        const copy = Object.values(PATTERN_BASE_RATES).find(
            rate => rate?.key === 'pooled'
        );
        expect(copy?.verdict).toBe('insufficient_sample');
        expect(patternRecord().pooled).toBe(PATTERN_POOLED_BASE_RATE);
        expect(patternRecord().pooled.verdict).not.toBe('insufficient_sample');
    });

    it('hands each own row the exact core row', () => {
        patternRecord().own.forEach(({ id, rate }) => {
            expect(rate).toBe(
                Object.entries(PATTERN_BASE_RATES).find(([k]) => k === id)?.[1]
            );
            expect(rate?.key).toBe(id);
        });
    });

    it('moves every small family to the pooled row and keeps the two sets disjoint', () => {
        const { own, pooledIds, pooled } = patternRecord();
        expect(pooledIds).toEqual(
            Object.entries(PATTERN_BASE_RATES)
                .filter(([, rate]) => rate?.key === 'pooled')
                .map(([id]) => id)
        );
        expect(own.length + pooledIds.length).toBe(
            Object.keys(PATTERN_BASE_RATES).length
        );
        expect(pooled).toBe(PATTERN_POOLED_BASE_RATE);
        pooledIds.forEach(id => {
            expect(own.map(row => row.id)).not.toContain(id);
        });
    });
});

describe('levelRecord', () => {
    it('lists every family in key order and nulls the ones without own measurement', () => {
        const { families, pooled } = levelRecord();
        expect(families.map(row => row.id)).toEqual(
            Object.keys(PRICE_LEVEL_FAMILY_BASE_RATES)
        );
        expect(pooled).toBe(PRICE_LEVEL_BASE_RATE);
        families.forEach(({ id, rate }) => {
            const raw = PRICE_LEVEL_FAMILY_BASE_RATES[id];
            if (raw?.key === 'pooled') {
                expect(rate).toBeNull();
            } else {
                expect(rate).toBe(raw);
            }
        });
    });

    it('has at least one family without its own measurement (pooled stand-in)', () => {
        expect(levelRecord().families.some(row => row.rate === null)).toBe(
            true
        );
    });
});
