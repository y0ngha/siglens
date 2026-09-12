import { SUGGESTIONS_PROMPT_VERSION } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { suggestionsCacheKey } from './cacheKey';

const NOW = new Date('2026-09-12T03:07:00.000Z');

describe('suggestionsCacheKey', () => {
    it('buckets by UTC hour and omits the user suffix with no portfolio', () => {
        const key = suggestionsCacheKey({
            locale: 'ko',
            userId: 'u1',
            portfolioSymbols: [],
            now: NOW,
        });
        expect(key).toBe(
            `ai:suggest:v1:${SUGGESTIONS_PROMPT_VERSION}:ko:2026091203`
        );
    });

    it('appends :u:<userId> only when portfolioSymbols is non-empty', () => {
        const key = suggestionsCacheKey({
            locale: 'ko',
            userId: 'u1',
            portfolioSymbols: ['AAPL'],
            now: NOW,
        });
        expect(key).toBe(
            `ai:suggest:v1:${SUGGESTIONS_PROMPT_VERSION}:ko:2026091203:u:u1`
        );
    });

    it('varies the key by locale', () => {
        const ko = suggestionsCacheKey({
            locale: 'ko',
            userId: 'u1',
            portfolioSymbols: [],
            now: NOW,
        });
        const en = suggestionsCacheKey({
            locale: 'en',
            userId: 'u1',
            portfolioSymbols: [],
            now: NOW,
        });
        expect(ko).not.toBe(en);
    });

    it('rolls over to a new key at the next UTC hour boundary', () => {
        const before = suggestionsCacheKey({
            locale: 'ko',
            userId: 'u1',
            portfolioSymbols: [],
            now: new Date('2026-09-12T03:59:59.999Z'),
        });
        const after = suggestionsCacheKey({
            locale: 'ko',
            userId: 'u1',
            portfolioSymbols: [],
            now: new Date('2026-09-12T04:00:00.000Z'),
        });
        expect(before).not.toBe(after);
    });
});
