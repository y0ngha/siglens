import { describe, expect, it } from 'vitest';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { SITE_URL } from '@/shared/lib/seo';
import { CRYPTO_RE } from '../lib/lpCopyRules';
import {
    ANALYSIS_CTA_HREF,
    FEATURES,
    LP_ANALYSIS_SUBJECTS,
    POPULAR,
} from '../lib/stockAnalysisContent';
import {
    CHAT_CTA_HREF,
    CHAT_SCENARIOS,
    HOW_DEMO,
} from '../lib/stockChatContent';

describe('stock-analysis content', () => {
    it('sends the CTA to a symbol page on the main host', () => {
        expect(ANALYSIS_CTA_HREF).toBe(`${SITE_URL}/NVDA`);
    });

    it('only shows analyses for symbols the page already links to', () => {
        const linked = new Set([
            ...POPULAR.map(stock => stock.symbol),
            ...FEATURES.map(feature => feature.href.split('/')[1]),
        ]);
        expect(LP_ANALYSIS_SUBJECTS.length).toBeGreaterThan(0);
        LP_ANALYSIS_SUBJECTS.forEach(({ symbol }) => {
            expect(linked.has(symbol)).toBe(true);
        });
    });

    it('lists no crypto subject', () => {
        LP_ANALYSIS_SUBJECTS.forEach(({ symbol, name, marketProfile }) => {
            expect(['us-equity', 'kr-equity']).toContain(marketProfile);
            expect(`${symbol} ${name}`).not.toMatch(CRYPTO_RE);
        });
    });
});

describe('stock-chat content', () => {
    it('sends the CTA to the agent chat on the ai host', () => {
        expect(CHAT_CTA_HREF).toBe(`${AI_SITE_URL}/`);
    });

    it('summarises the lookups without a made-up duration', () => {
        expect(CHAT_SCENARIOS.map(s => s.summary)).toEqual([
            '종목 검색, 시세, 차트와 지표, 시그렌즈 분석 확인',
            '시세, 기업 정보, 뉴스 확인',
            '시장 동향, 경제 지표, 뉴스 확인',
        ]);
        expect(CHAT_SCENARIOS[0]?.asOf).toBe('기준 가장 최근 종가');
    });

    it('carries no figure in the question-to-answer demo', () => {
        expect([HOW_DEMO.answer, ...HOW_DEMO.chips].join(' ')).not.toMatch(
            /\d/
        );
    });

    it('carries no figure in an example answer or its source labels', () => {
        CHAT_SCENARIOS.forEach(({ lines, sources, asOf }) => {
            const text = lines
                .flatMap(line => line.segments.map(seg => seg.text))
                .concat(sources, asOf)
                .join(' ');
            expect(text).not.toMatch(/\d/);
            expect(lines.flatMap(l => l.segments).map(seg => seg.tone)).toEqual(
                lines.flatMap(l => l.segments).map(() => 'plain')
            );
        });
    });
});
