import { describe, expect, it } from 'vitest';
import {
    buildFearGreedMetaFactsFromBars,
    lastScoredDateFromBars,
    scoredHistoryFromBars,
} from '../utils/fearGreedFromBars';
import { buildFearGreedSeedBars } from '@/__tests__/utils/fearGreedSeedBars';

/**
 * 설명(`generateMetadata`)과 `dateModified`(페이지 본문)는 같은 함수로 점수 시계열을 읽는다 —
 * 설명이 말하는 마지막 날짜와 `dateModified`의 기준 봉이 갈릴 수 없다는 것을 못 박는다.
 */
describe('fearGreedFromBars', () => {
    const bars = buildFearGreedSeedBars(300);

    it('메타 사실의 날짜와 dateModified 기준 날짜가 같은 봉이다', () => {
        const facts = buildFearGreedMetaFactsFromBars(bars);

        expect(facts).not.toBeNull();
        expect(facts?.date).toBe(lastScoredDateFromBars(bars));
        expect(facts?.date).toBe(scoredHistoryFromBars(bars).at(-1)?.date);
    });

    it('점수를 못 내면 사실도 날짜도 없다', () => {
        const short = buildFearGreedSeedBars(20);

        expect(buildFearGreedMetaFactsFromBars(short)).toBeNull();
        expect(lastScoredDateFromBars(short)).toBeUndefined();
    });
});
