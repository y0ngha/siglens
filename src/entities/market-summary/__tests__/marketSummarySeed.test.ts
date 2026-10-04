import type { MarketSummaryData } from '@y0ngha/siglens-core';
import { marketSummarySeed } from '@/entities/market-summary/lib/marketSummarySeed';

const SUMMARY = { indices: [], sectors: [] } as unknown as MarketSummaryData;

describe('marketSummarySeed', () => {
    /**
     * 시드는 클라이언트 액션 응답과 같은 모양이어야 한다. `scope`가 빠지면 미국 밖 시장에서
     * `useMarketSummary`가 시드를 버려 서버 HTML에 지수·섹터 카드가 안 그려진다.
     */
    it.each(['us', 'kr'] as const)(
        '%s: 요약과 함께 자기 시장을 밝힌다',
        scope => {
            expect(marketSummarySeed(scope, SUMMARY)).toEqual({
                summary: SUMMARY,
                scope,
            });
        }
    );

    it('요약 객체를 복사하지 않는다 — 같은 참조여야 Flight가 중복을 접는다', () => {
        expect(marketSummarySeed('kr', SUMMARY).summary).toBe(SUMMARY);
    });
});
