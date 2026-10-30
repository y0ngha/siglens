import type { MarketNewsItem } from '../marketNewsClientPort';
import { selectAnalysisCandidates } from '../selectAnalysisCandidates';

function item(id: string): MarketNewsItem {
    return {
        id,
        symbol: '__NEWS_STOCK__',
        source: 'Wire',
        url: `https://x/${id}`,
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: id,
        bodyEn: null,
        tickers: [],
    };
}

const FRESH = ['a', 'b', 'c', 'd'].map(item);

describe('selectAnalysisCandidates는', () => {
    it('이미 보강됐거나 upsert에 실패한 기사를 뺀다', () => {
        const { selected, pending } = selectAnalysisCandidates({
            fresh: FRESH,
            upsertedIds: new Set(['a', 'b', 'c']),
            analyzedIds: new Set(['b']),
        });

        expect(selected.map(i => i.id)).toEqual(['a', 'c']);
        expect(pending).toBe(0);
    });

    it('상한을 넘는 후보는 피드 순서로 자르고 남은 수를 pending으로 돌려준다', () => {
        const { selected, pending } = selectAnalysisCandidates({
            fresh: FRESH,
            upsertedIds: new Set(['a', 'b', 'c', 'd']),
            analyzedIds: new Set(),
            analyzeLimit: 3,
        });

        expect(selected.map(i => i.id)).toEqual(['a', 'b', 'c']);
        expect(pending).toBe(1);
    });

    it('상한이 0이면 아무것도 고르지 않고 전부 pending이다', () => {
        const { selected, pending } = selectAnalysisCandidates({
            fresh: FRESH,
            upsertedIds: new Set(['a', 'b']),
            analyzedIds: new Set(),
            analyzeLimit: 0,
        });

        expect(selected).toEqual([]);
        expect(pending).toBe(2);
    });
});
