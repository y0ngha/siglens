// release-it 경유 실행 시 `.env.local`의 NEXT_PUBLIC_SITE_URL(=dev URL)이 부모 프로세스에
// 주입되어 SITE_URL이 'http://localhost:4200'으로 평가될 수 있다. SEO 메타데이터 빌더의
// canonical URL 회귀가드는 production URL 형태를 검증해야 하므로 import 평가 전에 강제 세팅한다.
//
// 이 패턴의 안전성은 ts-jest의 CommonJS transform에 의존한다 — ES `import`가 `require()`로
// lowering되어 코드 순서대로 평가되므로, 이 줄이 `@/lib/seo` evaluation 전에 실행된다.
// Babel 전환·`isolatedModules`+ESM output으로 바꾸면 import hoisting이 깨질 수 있으니
// 그때는 jest.mock 패턴으로 옮겨야 한다.
process.env.NEXT_PUBLIC_SITE_URL = 'https://siglens.io';

import {
    buildSymbolSeoContent,
    buildSymbolFundamentalSeoContent,
    buildSymbolNewsSeoContent,
    buildSymbolOverallSeoContent,
    buildSymbolFearGreedSeoContent,
    buildSymbolOptionsSeoContent,
    clampSeoDescription,
    SEO_DESCRIPTION_MAX_LENGTH,
} from '@/lib/seo';

describe('buildSymbolSeoContent', () => {
    it('동적 세그먼트 플레이스홀더가 아닌 실제 티커로 심볼 메타데이터를 만든다', () => {
        const content = buildSymbolSeoContent('aapl');

        expect(content.ticker).toBe('AAPL');
        expect(content.title).toBe(
            'AAPL 주가 분석 — 차트와 매매 신호, 지지선·저항선'
        );
        expect(content.fullTitle).toBe(
            'AAPL 주가 분석 — 차트와 매매 신호, 지지선·저항선 | Siglens'
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

    it('description은 SEO_DESCRIPTION_MAX_LENGTH(120자) 이하다 — 한글 SERP 안전권', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('sector가 함께 들어와도 description이 120자 클램프를 넘지 않는다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            sector: 'Technology',
        });
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
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

    it('description은 SEO_DESCRIPTION_MAX_LENGTH(120자) 이하다 — 한글 SERP 안전권', () => {
        const content = buildSymbolNewsSeoContent('AAPL');
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
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

    it('description은 SEO_DESCRIPTION_MAX_LENGTH(120자) 이하다 — 한글 SERP 안전권', () => {
        const content = buildSymbolOverallSeoContent('AAPL');
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
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

describe('Placeholder 회귀 가드 — 어떤 입력에도 [SYMBOL] / [symbol] 누수 금지', () => {
    const inputs = ['AAPL', 'aapl', 'Aapl', 'A', 'BRK.B', 'brk.b'];
    const builders = [
        ['buildSymbolSeoContent', buildSymbolSeoContent, ''],
        [
            'buildSymbolFundamentalSeoContent',
            buildSymbolFundamentalSeoContent,
            '/fundamental',
        ],
        ['buildSymbolNewsSeoContent', buildSymbolNewsSeoContent, '/news'],
        [
            'buildSymbolOverallSeoContent',
            buildSymbolOverallSeoContent,
            '/overall',
        ],
        [
            'buildSymbolFearGreedSeoContent',
            buildSymbolFearGreedSeoContent,
            '/fear-greed',
        ],
    ] as const;

    it.each(
        builders.flatMap(([name, builder, _suffix]) =>
            inputs.map(input => [name, builder, input] as const)
        )
    )(
        '%s(%s) — [symbol] 플레이스홀더가 결과에 포함되지 않는다',
        (_name, builder, input) => {
            const content = builder(input);
            const serialized = JSON.stringify(content);
            expect(serialized).not.toMatch(/\[symbol\]/i);
            expect(content.ticker).toBe(input.toUpperCase());
        }
    );

    it.each(
        builders.flatMap(([name, builder, suffix]) =>
            inputs.map(input => [name, builder, input, suffix] as const)
        )
    )(
        '%s(%s) — canonical URL이 https://siglens.io/<대문자티커> 형식이다',
        (_name, builder, input, suffix) => {
            const content = builder(input);
            const expectedTicker = input.toUpperCase();
            expect(content.url).toBe(
                `https://siglens.io/${expectedTicker}${suffix}`
            );
        }
    );
});

describe('clampSeoDescription', () => {
    it('안전권(120자 이하)은 변형 없이 그대로 반환한다', () => {
        const short = '짧은 설명입니다.';
        expect(clampSeoDescription(short)).toBe(short);
    });

    it('정확히 SEO_DESCRIPTION_MAX_LENGTH 길이는 변형 없이 그대로 반환한다', () => {
        const boundary = 'a'.repeat(SEO_DESCRIPTION_MAX_LENGTH);
        expect(clampSeoDescription(boundary)).toBe(boundary);
        expect(clampSeoDescription(boundary).length).toBe(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('SEO_DESCRIPTION_MAX_LENGTH 초과는 잘라내고 말줄임표(…)를 붙인다', () => {
        const over = 'a'.repeat(SEO_DESCRIPTION_MAX_LENGTH + 50);
        const clamped = clampSeoDescription(over);
        expect(clamped.length).toBe(SEO_DESCRIPTION_MAX_LENGTH);
        expect(clamped.endsWith('…')).toBe(true);
    });

    it('말줄임표 포함 길이가 한도를 절대 넘지 않는다 — 회귀 가드', () => {
        for (const len of [
            SEO_DESCRIPTION_MAX_LENGTH + 1,
            SEO_DESCRIPTION_MAX_LENGTH + 10,
            SEO_DESCRIPTION_MAX_LENGTH * 3,
        ]) {
            const over = 'x'.repeat(len);
            expect(clampSeoDescription(over).length).toBeLessThanOrEqual(
                SEO_DESCRIPTION_MAX_LENGTH
            );
        }
    });

    it('한글이 정확히 경계를 넘는 입력도 안전권 안으로 클램프된다', () => {
        const overByOne = '한'.repeat(SEO_DESCRIPTION_MAX_LENGTH + 1);
        const clamped = clampSeoDescription(overByOne);
        expect([...clamped].length).toBe(SEO_DESCRIPTION_MAX_LENGTH);
        expect(clamped.endsWith('…')).toBe(true);

        const wayOver = '한'.repeat(SEO_DESCRIPTION_MAX_LENGTH * 2);
        expect([...clampSeoDescription(wayOver)].length).toBe(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('surrogate pair(이모지)도 깨지지 않고 code-point 단위로 잘린다', () => {
        // '🚀' (U+1F680)은 UTF-16에서 surrogate pair(2 code units).
        // .slice()로 자르면 중간이 갈라져 invalid UTF-16이 될 위험이 있다.
        // 안전권을 초과하도록 50자 더 넣어 클램프가 작동하는 케이스를 만든다.
        const emoji = '🚀'.repeat(SEO_DESCRIPTION_MAX_LENGTH + 50);
        const clamped = clampSeoDescription(emoji);

        // 잘린 결과의 모든 code point가 온전한 이모지여야 한다 (lone surrogate 없음).
        const codePoints = [...clamped];
        expect(codePoints.length).toBe(SEO_DESCRIPTION_MAX_LENGTH);
        // 마지막은 말줄임표, 나머지는 모두 🚀.
        expect(codePoints[codePoints.length - 1]).toBe('…');
        expect(codePoints.slice(0, -1).every(cp => cp === '🚀')).toBe(true);
    });
});

describe('description 길이 가드 — 모든 빌더가 SEO_DESCRIPTION_MAX_LENGTH 이하를 보장', () => {
    // 한국 displayName + sector를 같이 넣어 가장 긴 입력 케이스로 가드한다.
    const richOpts = {
        displayName: '애플, Apple Inc. (AAPL)',
        koreanName: '애플',
        sector: 'Technology',
    };

    it.each([
        ['buildSymbolSeoContent', buildSymbolSeoContent],
        ['buildSymbolFundamentalSeoContent', buildSymbolFundamentalSeoContent],
        ['buildSymbolNewsSeoContent', buildSymbolNewsSeoContent],
        ['buildSymbolOverallSeoContent', buildSymbolOverallSeoContent],
        ['buildSymbolFearGreedSeoContent', buildSymbolFearGreedSeoContent],
    ] as const)('%s — description이 120자 클램프 이하', (_name, builder) => {
        const content = builder('AAPL', richOpts);
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('buildSymbolOptionsSeoContent — hasOptions:true에서도 120자 이하', () => {
        const content = buildSymbolOptionsSeoContent('AAPL', {
            ...richOpts,
            hasOptions: true,
        });
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('buildSymbolOptionsSeoContent — hasOptions:false에서도 120자 이하', () => {
        const content = buildSymbolOptionsSeoContent('AAPL', {
            ...richOpts,
            hasOptions: false,
        });
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });
});
