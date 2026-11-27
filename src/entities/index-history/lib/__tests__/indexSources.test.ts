import { AGENT_HISTORY_INDICES } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { INDEX_SOURCES } from '../indexSources';

describe('INDEX_SOURCES', () => {
    it('has a source for every agent index, with a display name and a market profile', () => {
        expect(Object.keys(INDEX_SOURCES).toSorted()).toEqual(
            [...AGENT_HISTORY_INDICES].toSorted()
        );
        expect(
            Object.fromEntries(
                Object.entries(INDEX_SOURCES).map(([key, s]) => [
                    key,
                    [s.name, s.symbol, s.provider, s.profile, s.timeZone],
                ])
            )
        ).toEqual({
            sp500: ['S&P 500', '^GSPC', 'fmp', 'us-equity', 'America/New_York'],
            nasdaq: [
                'Nasdaq Composite',
                '^IXIC',
                'fmp',
                'us-equity',
                'America/New_York',
            ],
            kospi: ['KOSPI', '^KS11', 'yahoo', 'kr-equity', 'Asia/Seoul'],
            kosdaq: ['KOSDAQ', '^KQ11', 'yahoo', 'kr-equity', 'Asia/Seoul'],
        });
    });
});
