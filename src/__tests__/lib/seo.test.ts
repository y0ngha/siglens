import { buildSymbolSeoContent, buildSymbolFundamentalSeoContent } from '@/lib/seo';

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

describe('buildSymbolFundamentalSeoContent', () => {
    it('소문자 입력을 대문자로 정규화한다', () => {
        const content = buildSymbolFundamentalSeoContent('aapl');
        expect(content.title).toBe('AAPL 펀더멘털 분석');
        expect(content.fullTitle).toBe('AAPL 펀더멘털 분석 | Siglens');
    });

    it('URL이 /[SYMBOL]/fundamental 형식이다', () => {
        const content = buildSymbolFundamentalSeoContent('NVDA');
        expect(content.url).toBe('https://siglens.io/NVDA/fundamental');
    });

    it('description에 티커와 핵심 지표 키워드가 포함된다', () => {
        const content = buildSymbolFundamentalSeoContent('TSLA');
        expect(content.description).toContain('TSLA');
        expect(content.description).toContain('PER');
        expect(content.description).toContain('ROE');
    });

    it('keywords 배열에 티커와 펀더멘털 관련 용어가 포함된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL');
        expect(content.keywords).toContain('AAPL');
        expect(content.keywords).toContain('PER');
        expect(content.keywords).toContain('애널리스트 컨센서스');
        expect(content.keywords).toContain('AAPL 펀더멘털 분석');
    });

    it('[SYMBOL] 플레이스홀더가 결과에 포함되지 않는다', () => {
        const content = buildSymbolFundamentalSeoContent('MSFT');
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });
});
