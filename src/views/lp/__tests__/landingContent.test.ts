import { describe, expect, it } from 'vitest';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { SITE_URL } from '@/shared/lib/seo';
import {
    ANALYSIS_CTA_HREF,
    ANALYSIS_SCENARIOS,
} from '../lib/stockAnalysisContent';
import { CHAT_CTA_HREF, CHAT_SCENARIOS } from '../lib/stockChatContent';

describe('stock-analysis content', () => {
    it('sends the CTA to a symbol page on the main host', () => {
        expect(ANALYSIS_CTA_HREF).toBe(`${SITE_URL}/NVDA`);
    });

    it('counts every step but lists the report step as no source', () => {
        const [aapl] = ANALYSIS_SCENARIOS;
        expect(aapl?.summary).toBe('5단계를 거쳐 분석했어요');
        expect(aapl?.sources).toEqual([
            '시세와 차트',
            '보조지표',
            '캔들과 차트 패턴',
            '재무와 뉴스',
        ]);
        expect(aapl?.asOf).toBe('미국 장 마감 기준');
    });
});

describe('stock-chat content', () => {
    it('sends the CTA to the agent chat on the ai host', () => {
        expect(CHAT_CTA_HREF).toBe(`${AI_SITE_URL}/`);
    });

    it('summarises the lookups and their total time in seconds', () => {
        expect(CHAT_SCENARIOS.map(s => s.summary)).toEqual([
            '종목 검색, 시세, 차트와 지표, 시그렌즈 분석 확인, 3.0초',
            '시세, 기업 정보, 뉴스 확인, 2.4초',
            '시장 동향, 경제 지표, 뉴스 확인, 2.4초',
        ]);
        expect(CHAT_SCENARIOS[0]?.asOf).toBe('기준 2026-09-18 종가');
    });
});
