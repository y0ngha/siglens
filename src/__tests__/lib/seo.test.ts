import {
    buildSymbolSeoContent,
    buildSymbolFundamentalSeoContent,
    buildSymbolNewsSeoContent,
    buildSymbolOverallSeoContent,
} from '@/lib/seo';

describe('buildSymbolSeoContent', () => {
    it('동적 세그먼트 플레이스홀더가 아닌 실제 티커로 심볼 메타데이터를 만든다', () => {
        const content = buildSymbolSeoContent('aapl');

        expect(content.ticker).toBe('AAPL');
        expect(content.title).toBe(
            'AAPL 주가 분석 — 차트와 매매 신호, 지지저항'
        );
        expect(content.fullTitle).toBe(
            'AAPL 주가 분석 — 차트와 매매 신호, 지지저항 | Siglens'
        );
        expect(content.description).toContain('AAPL');
        expect(content.url).toBe('https://siglens.io/AAPL');
        expect(content.keywords).toContain('AAPL 주가');
        expect(content.keywords).toContain('AAPL 매매 신호');
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });

    it('displayName/koreanName 옵션을 받아 description과 keywords를 풍부화한다', () => {
        const content = buildSymbolSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
            sector: 'Technology',
        });

        expect(content.description).toContain('Technology 섹터');
        expect(content.description).toContain('애플');
        expect(content.keywords).toContain('애플 주가');
        expect(content.keywords).toContain('애플 매수');
        expect(content.keywords).toContain('애플 매매 시점');
    });
});

describe('buildSymbolFundamentalSeoContent', () => {
    it('소문자 입력을 대문자로 정규화하고 title/fullTitle이 일관된 형태다', () => {
        const content = buildSymbolFundamentalSeoContent('aapl');
        expect(content.title).toBe(
            'AAPL 펀더멘털 — PER, ROE와 애널리스트 컨센서스'
        );
        expect(content.fullTitle).toBe(`${content.title} | Siglens`);
    });

    it('title에 브랜드명이 포함되지 않는다 (루트 레이아웃이 자동 추가)', () => {
        const content = buildSymbolFundamentalSeoContent('TSLA');
        expect(content.title).not.toContain('Siglens');
        expect(content.title).not.toContain('|');
    });

    it('fullTitle에 브랜드명이 포함된다', () => {
        const content = buildSymbolFundamentalSeoContent('MSFT');
        expect(content.fullTitle).toContain('Siglens');
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
        expect(content.description).toContain('애널리스트 컨센서스');
    });

    it('description은 메타 디스크립션 길이 권장치(120-170자) 안에 든다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description.length).toBeGreaterThanOrEqual(120);
        expect(content.description.length).toBeLessThanOrEqual(170);
    });

    it('sector가 함께 들어와도 description이 170자를 넘지 않는다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            sector: 'Technology',
        });
        expect(content.description.length).toBeLessThanOrEqual(170);
    });

    it('displayName이 있으면 description에 반영된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description).toContain('애플');
    });

    it('sector가 있으면 description에 섹터 문구가 추가된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            sector: 'Technology',
        });
        expect(content.description).toContain('Technology 섹터');
    });

    it('keywords 배열에 티커와 펀더멘털 관련 용어가 포함된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL');
        expect(content.keywords).toContain('AAPL');
        expect(content.keywords).toContain('PER');
        expect(content.keywords).toContain('애널리스트 컨센서스');
        expect(content.keywords).toContain('AAPL 펀더멘털 분석');
        expect(content.keywords).toContain('AAPL 목표 주가');
    });

    it('koreanName이 있으면 keywords에 한글 변형이 추가된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 펀더멘털');
        expect(content.keywords).toContain('애플 재무 분석');
        expect(content.keywords).toContain('애플 목표 주가');
    });

    it('sector가 있으면 keywords에 섹터 펀더멘털 키워드가 추가된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', {
            sector: 'Technology',
        });
        expect(content.keywords).toContain('Technology 섹터 펀더멘털');
    });

    it('[SYMBOL] 플레이스홀더가 결과에 포함되지 않는다', () => {
        const content = buildSymbolFundamentalSeoContent('MSFT');
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });
});

describe('buildSymbolNewsSeoContent', () => {
    it('소문자 입력을 대문자로 정규화하고 title/fullTitle이 일관된 형태다', () => {
        const content = buildSymbolNewsSeoContent('aapl');
        expect(content.title).toBe(
            'AAPL 뉴스 — 호재 분위기, 어닝과 실적, 애널리스트 등급'
        );
        expect(content.fullTitle).toBe(`${content.title} | Siglens`);
    });

    it('title에 브랜드명이 포함되지 않는다 (루트 레이아웃이 자동 추가)', () => {
        const content = buildSymbolNewsSeoContent('TSLA');
        expect(content.title).not.toContain('Siglens');
        expect(content.title).not.toContain('|');
    });

    it('URL이 /[SYMBOL]/news 형식이다', () => {
        const content = buildSymbolNewsSeoContent('NVDA');
        expect(content.url).toBe('https://siglens.io/NVDA/news');
    });

    it('description에 핵심 뉴스 키워드가 포함된다', () => {
        const content = buildSymbolNewsSeoContent('TSLA');
        expect(content.description).toContain('TSLA');
        expect(content.description).toContain('호재');
        expect(content.description).toContain('분위기');
        expect(content.description).toContain('어닝');
        expect(content.description).toContain('실적');
        expect(content.description).toContain('애널리스트');
    });

    it('description은 메타 디스크립션 길이 권장치(120-170자) 안에 든다', () => {
        const content = buildSymbolNewsSeoContent('AAPL');
        expect(content.description.length).toBeGreaterThanOrEqual(120);
        expect(content.description.length).toBeLessThanOrEqual(170);
    });

    it('keywords 배열에 티커와 뉴스 관련 용어가 포함된다', () => {
        const content = buildSymbolNewsSeoContent('AAPL');
        expect(content.keywords).toContain('AAPL');
        expect(content.keywords).toContain('AAPL 뉴스');
        expect(content.keywords).toContain('AAPL 호재');
        expect(content.keywords).toContain('AAPL 악재');
        expect(content.keywords).toContain('AAPL 뉴스 분위기');
        expect(content.keywords).toContain('AAPL 소식');
        expect(content.keywords).toContain('AAPL 이슈');
        expect(content.keywords).toContain('AAPL 분석 의견');
        expect(content.keywords).toContain('AAPL 어닝 일정');
        expect(content.keywords).toContain('AAPL 실적 발표');
        expect(content.keywords).toContain('AAPL 목표 주가');
        expect(content.keywords).toContain('뉴스 분석');
        expect(content.keywords).toContain('뉴스 분위기');
        expect(content.keywords).toContain('실적 발표');
        expect(content.keywords).toContain('애널리스트 등급');
    });

    it('displayName이 있으면 description에 반영된다', () => {
        const content = buildSymbolNewsSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description).toContain('애플');
    });

    it('koreanName이 있으면 keywords에 한글 변형이 추가된다', () => {
        const content = buildSymbolNewsSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 뉴스');
        expect(content.keywords).toContain('애플 어닝');
        expect(content.keywords).toContain('애플 목표 주가');
    });

    it('[SYMBOL] 플레이스홀더가 결과에 포함되지 않는다', () => {
        const content = buildSymbolNewsSeoContent('MSFT');
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });

    it('fullTitle에 브랜드명이 포함된다', () => {
        const content = buildSymbolNewsSeoContent('AMZN');
        expect(content.fullTitle).toContain('Siglens');
    });
});

describe('buildSymbolOverallSeoContent', () => {
    it('소문자 입력을 대문자로 정규화하고 title/fullTitle이 일관된 형태다', () => {
        const content = buildSymbolOverallSeoContent('aapl');
        expect(content.title).toBe(
            'AAPL 종합 분석 — 강세와 약세 시나리오, 위험 요인'
        );
        expect(content.fullTitle).toBe(`${content.title} | Siglens`);
    });

    it('URL이 절대 경로 /[SYMBOL]/overall 형식이다', () => {
        const content = buildSymbolOverallSeoContent('NVDA');
        expect(content.url).toBe('https://siglens.io/NVDA/overall');
    });

    it('title에 브랜드명이 포함되지 않는다 (루트 레이아웃이 자동 추가)', () => {
        const content = buildSymbolOverallSeoContent('TSLA');
        expect(content.title).not.toContain('Siglens');
        expect(content.title).not.toContain('|');
    });

    it('fullTitle에 브랜드명이 포함된다', () => {
        const content = buildSymbolOverallSeoContent('MSFT');
        expect(content.fullTitle).toContain('Siglens');
    });

    it('description에 티커와 핵심 키워드가 포함된다', () => {
        const content = buildSymbolOverallSeoContent('AAPL');
        expect(content.description).toContain('AAPL');
        expect(content.description).toContain('시나리오');
        expect(content.description).toContain('위험 요인');
    });

    it('description은 메타 디스크립션 길이 권장치(120-170자) 안에 든다', () => {
        const content = buildSymbolOverallSeoContent('AAPL');
        expect(content.description.length).toBeGreaterThanOrEqual(120);
        expect(content.description.length).toBeLessThanOrEqual(170);
    });

    it('keywords 배열에 티커와 종합 분석 관련 용어가 포함된다', () => {
        const content = buildSymbolOverallSeoContent('AAPL');
        expect(content.keywords).toContain('AAPL');
        expect(content.keywords).toContain('AAPL AI 종합 분석');
        expect(content.keywords).toContain('AAPL 시나리오 분석');
        expect(content.keywords).toContain('AAPL 시나리오');
        expect(content.keywords).toContain('AAPL 진입 타이밍');
        expect(content.keywords).toContain('AAPL 위험 요인');
        expect(content.keywords).toContain('AI 종합 분석');
        expect(content.keywords).toContain('시나리오 분석');
    });

    it('displayName이 있으면 description에 반영된다', () => {
        const content = buildSymbolOverallSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description).toContain('애플');
    });

    it('koreanName이 있으면 keywords에 한글 변형이 추가된다', () => {
        const content = buildSymbolOverallSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 종합 분석');
        expect(content.keywords).toContain('애플 AI 분석');
        expect(content.keywords).toContain('애플 시나리오 분석');
    });

    it('[SYMBOL] 플레이스홀더가 결과에 포함되지 않는다', () => {
        const content = buildSymbolOverallSeoContent('AMZN');
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });
});
