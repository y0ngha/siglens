import { buildSymbolSeoContent } from '@/lib/seo';

describe('buildSymbolSeoContent', () => {
    it('동적 세그먼트 플레이스홀더가 아닌 실제 티커로 심볼 메타데이터를 만든다', () => {
        const content = buildSymbolSeoContent('aapl');

        expect(content.ticker).toBe('AAPL');
        expect(content.title).toBe('AAPL 주가 AI 분석');
        expect(content.fullTitle).toBe('AAPL 주가 AI 분석 | Siglens');
        expect(content.description).toContain('AAPL 주가');
        expect(content.url).toBe('https://siglens.io/AAPL');
        expect(content.keywords).toContain('AAPL 주가 AI 분석');
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });
});
