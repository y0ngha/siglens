import { LOCALE_HREFLANG } from '@/shared/i18n/locales';
import { readFileSync } from 'node:fs';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import {
    buildSymbolSeoContent,
    buildSymbolFundamentalSeoContent,
    buildSymbolFinancialsSeoContent,
    buildSymbolNewsSeoContent,
    buildSymbolOverallSeoContent,
    buildSymbolFearGreedSeoContent,
    buildSymbolOptionsSeoContent,
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    buildSnapshotMetaDescription,
    composeSymbolTitle,
    symbolMetadataFromSeo,
    clampSeoDescription,
    SEO_DESCRIPTION_MAX_LENGTH,
    SITE_URL,
    SITE_NAME,
    type SeoTranslator,
    resolveSymbolSeoContent,
    resolveSymbolNewsSeoContent,
    resolveSymbolOverallSeoContent,
    resolveSymbolFearGreedSeoContent,
} from '@/shared/lib/seo';

// t는 이제 필수 인자다(§design SeoTranslator required-param). ko로 고정한
// 실제 번역자를 한 번 만들어 모든 builder 호출에 재사용한다.
let t: SeoTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.seo' });
});

describe('buildSymbolSeoContent', () => {
    it('동적 세그먼트 플레이스홀더가 아닌 실제 티커로 심볼 메타데이터를 만든다', () => {
        const content = buildSymbolSeoContent('aapl', t);

        expect(content.ticker).toBe('AAPL');
        // core(주가 전망)만 단언한다 — tail(차트·매매 신호)은
        // composeSymbolTitle이 예산 압박 시 가장 먼저 버리는 서술이라,
        // 전체 문자열을 고정하면 카피 문구만 바뀌어도 이 테스트가 깨진다.
        // 알고리즘 자체(어떤 조건에서 tail/한국어명이 버려지는지)를 고정하는
        // 리터럴 단언은 seo.composeSymbolTitle.test.ts의 책임이다.
        expect(content.title).toContain('AAPL');
        expect(content.title).toContain('주가 전망');
        expect(content.fullTitle).toBe(`${content.title} | Siglens`);
        expect(content.description).toContain('AAPL');
        expect(content.url).toBe('https://siglens.io/AAPL');
        expect(content.keywords).toContain('AAPL 주가');
        expect(content.keywords).toContain('AAPL 매매 신호');
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });

    it('displayName/koreanName 옵션을 받아 description과 keywords를 풍부화한다', () => {
        const content = buildSymbolSeoContent('AAPL', t, {
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
        const content = buildSymbolFundamentalSeoContent('aapl', t);
        // core(펀더멘털)만 단언한다 — tail은 composeSymbolTitle이 예산
        // 압박 시 가장 먼저 버리는 서술이라 전체 문자열을 고정하지 않는다.
        expect(content.title).toContain('AAPL');
        expect(content.title).toContain('펀더멘털');
        expect(content.fullTitle).toBe(`${content.title} | Siglens`);
    });

    it('title에 브랜드명이 포함되지 않는다 (루트 레이아웃이 자동 추가)', () => {
        const content = buildSymbolFundamentalSeoContent('TSLA', t);
        expect(content.title).not.toContain('Siglens');
        expect(content.title).not.toContain('|');
    });

    it('fullTitle에 브랜드명이 포함된다', () => {
        const content = buildSymbolFundamentalSeoContent('MSFT', t);
        expect(content.fullTitle).toContain('Siglens');
    });

    it('URL이 /[SYMBOL]/fundamental 형식이다', () => {
        const content = buildSymbolFundamentalSeoContent('NVDA', t);
        expect(content.url).toBe('https://siglens.io/NVDA/fundamental');
    });

    it('description에 티커와 핵심 지표 키워드가 포함된다', () => {
        const content = buildSymbolFundamentalSeoContent('TSLA', t);
        expect(content.description).toContain('TSLA');
        expect(content.description).toContain('PER');
        expect(content.description).toContain('ROE');
        expect(content.description).toContain('애널리스트 컨센서스');
    });

    it('description은 SEO_DESCRIPTION_MAX_LENGTH(120자) 이하다 — 한글 SERP 안전권', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('sector가 함께 들어와도 description이 120자 클램프를 넘지 않는다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
            sector: 'Technology',
        });
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('displayName이 있으면 description에 반영된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description).toContain('애플');
    });

    it('sector가 있으면 description에 섹터 문구가 추가된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
            sector: 'Technology',
        });
        expect(content.description).toContain('Technology 섹터');
    });

    it('keywords 배열에 티커와 펀더멘털 관련 용어가 포함된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', t);
        expect(content.keywords).toContain('AAPL');
        expect(content.keywords).toContain('PER');
        expect(content.keywords).toContain('애널리스트 컨센서스');
        expect(content.keywords).toContain('AAPL 펀더멘털 분석');
        expect(content.keywords).toContain('AAPL 목표 주가');
    });

    it('koreanName이 있으면 keywords에 한글 변형이 추가된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 펀더멘털');
        expect(content.keywords).toContain('애플 재무 분석');
        expect(content.keywords).toContain('애플 목표 주가');
    });

    it('sector가 있으면 keywords에 섹터 펀더멘털 키워드가 추가된다', () => {
        const content = buildSymbolFundamentalSeoContent('AAPL', t, {
            sector: 'Technology',
        });
        expect(content.keywords).toContain('Technology 섹터 펀더멘털');
    });

    it('[SYMBOL] 플레이스홀더가 결과에 포함되지 않는다', () => {
        const content = buildSymbolFundamentalSeoContent('MSFT', t);
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });
});

describe('buildSymbolFinancialsSeoContent', () => {
    it('소문자 입력을 대문자로 정규화하고 title에 티커와 재무제표 키워드가 포함된다', () => {
        const content = buildSymbolFinancialsSeoContent('aapl', t);
        expect(content.ticker).toBe('AAPL');
        expect(content.title).toContain('AAPL');
        expect(content.title).toContain('재무제표');
    });

    it('title 형식이 일관된다 — 매출·이익·현금흐름 구조', () => {
        const content = buildSymbolFinancialsSeoContent('TSLA', t);
        // core(재무제표)만 단언한다 — tail(매출·이익·현금흐름)은
        // composeSymbolTitle이 예산 압박 시 가장 먼저 버리는 서술이라,
        // 전체 문자열을 고정하면 카피 문구만 바뀌어도 이 테스트가 깨진다.
        expect(content.title).toContain('TSLA');
        expect(content.title).toContain('재무제표');
        expect(content.fullTitle).toBe(`${content.title} | Siglens`);
    });

    it('title에 브랜드명이 포함되지 않는다 (루트 레이아웃이 자동 추가)', () => {
        const content = buildSymbolFinancialsSeoContent('TSLA', t);
        expect(content.title).not.toContain('Siglens');
        expect(content.title).not.toContain('|');
    });

    it('fullTitle에 브랜드명이 포함된다', () => {
        const content = buildSymbolFinancialsSeoContent('MSFT', t);
        expect(content.fullTitle).toContain('Siglens');
    });

    it('URL이 /[SYMBOL]/financials 형식이다', () => {
        const content = buildSymbolFinancialsSeoContent('NVDA', t);
        expect(content.url).toBe('https://siglens.io/NVDA/financials');
    });

    it('description은 SEO_DESCRIPTION_MAX_LENGTH(120자) 이하다 — 한글 SERP 안전권', () => {
        const content = buildSymbolFinancialsSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect([...content.description].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('displayName이 있으면 description에 반영된다', () => {
        const content = buildSymbolFinancialsSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description).toContain('애플');
    });

    it('description에 재무 핵심 키워드가 포함된다', () => {
        const content = buildSymbolFinancialsSeoContent('AAPL', t);
        expect(content.description).toContain('손익');
        expect(content.description).toContain('현금흐름');
    });

    it('keywords 배열에 티커와 재무제표 관련 용어가 포함된다', () => {
        const content = buildSymbolFinancialsSeoContent('AAPL', t);
        expect(content.keywords).toContain('AAPL');
        expect(content.keywords).toContain('AAPL 재무제표');
        expect(content.keywords).toContain('AAPL 손익계산서');
        expect(content.keywords).toContain('AAPL 현금흐름표');
        expect(content.keywords).toContain('재무제표 분석');
        expect(content.keywords).toContain('손익계산서');
        expect(content.keywords).toContain('현금흐름표');
    });

    it('koreanName이 있으면 keywords에 한글 변형이 추가된다', () => {
        const content = buildSymbolFinancialsSeoContent('AAPL', t, {
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 재무제표');
        expect(content.keywords).toContain('애플 손익계산서');
        expect(content.keywords).toContain('애플 재무 분석');
        expect(content.keywords).toContain('애플 현금흐름');
    });

    it('[SYMBOL] 플레이스홀더가 결과에 포함되지 않는다', () => {
        const content = buildSymbolFinancialsSeoContent('MSFT', t);
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });
});

describe('buildSymbolNewsSeoContent', () => {
    it('소문자 입력을 대문자로 정규화하고 title/fullTitle이 일관된 형태다', () => {
        const content = buildSymbolNewsSeoContent('aapl', t);
        // core(뉴스)만 단언한다 — tail(호재 분위기와 애널리스트 등급)은
        // composeSymbolTitle이 예산 압박 시 가장 먼저 버리는 서술이라
        // 전체 문자열을 고정하지 않는다.
        expect(content.title).toContain('AAPL');
        expect(content.title).toContain('뉴스');
        expect(content.fullTitle).toBe(`${content.title} | Siglens`);
    });

    it('title에 브랜드명이 포함되지 않는다 (루트 레이아웃이 자동 추가)', () => {
        const content = buildSymbolNewsSeoContent('TSLA', t);
        expect(content.title).not.toContain('Siglens');
        expect(content.title).not.toContain('|');
    });

    it('URL이 /[SYMBOL]/news 형식이다', () => {
        const content = buildSymbolNewsSeoContent('NVDA', t);
        expect(content.url).toBe('https://siglens.io/NVDA/news');
    });

    it('description에 핵심 뉴스 키워드가 포함된다', () => {
        const content = buildSymbolNewsSeoContent('TSLA', t);
        expect(content.description).toContain('TSLA');
        expect(content.description).toContain('호재');
        expect(content.description).toContain('분위기');
        expect(content.description).toContain('어닝');
        expect(content.description).toContain('실적');
        expect(content.description).toContain('애널리스트');
    });

    it('description은 SEO_DESCRIPTION_MAX_LENGTH(120자) 이하다 — 한글 SERP 안전권', () => {
        const content = buildSymbolNewsSeoContent('AAPL', t);
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('keywords 배열에 티커와 뉴스 관련 용어가 포함된다', () => {
        const content = buildSymbolNewsSeoContent('AAPL', t);
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
        const content = buildSymbolNewsSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description).toContain('애플');
    });

    it('koreanName이 있으면 keywords에 한글 변형이 추가된다', () => {
        const content = buildSymbolNewsSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 뉴스');
        expect(content.keywords).toContain('애플 어닝');
        expect(content.keywords).toContain('애플 목표 주가');
    });

    it('[SYMBOL] 플레이스홀더가 결과에 포함되지 않는다', () => {
        const content = buildSymbolNewsSeoContent('MSFT', t);
        expect(JSON.stringify(content)).not.toContain('[SYMBOL]');
    });

    it('fullTitle에 브랜드명이 포함된다', () => {
        const content = buildSymbolNewsSeoContent('AMZN', t);
        expect(content.fullTitle).toContain('Siglens');
    });
});

describe('buildSymbolOverallSeoContent', () => {
    it('소문자 입력을 대문자로 정규화하고 title/fullTitle이 일관된 형태다', () => {
        const content = buildSymbolOverallSeoContent('aapl', t);
        // core(종합 분석)만 단언한다 — tail(강세·약세 시나리오)은
        // composeSymbolTitle이 예산 압박 시 가장 먼저 버리는 서술이라
        // 전체 문자열을 고정하지 않는다.
        expect(content.title).toContain('AAPL');
        expect(content.title).toContain('종합 분석');
        expect(content.fullTitle).toBe(`${content.title} | Siglens`);
    });

    it('URL이 절대 경로 /[SYMBOL]/overall 형식이다', () => {
        const content = buildSymbolOverallSeoContent('NVDA', t);
        expect(content.url).toBe('https://siglens.io/NVDA/overall');
    });

    it('title에 브랜드명이 포함되지 않는다 (루트 레이아웃이 자동 추가)', () => {
        const content = buildSymbolOverallSeoContent('TSLA', t);
        expect(content.title).not.toContain('Siglens');
        expect(content.title).not.toContain('|');
    });

    it('fullTitle에 브랜드명이 포함된다', () => {
        const content = buildSymbolOverallSeoContent('MSFT', t);
        expect(content.fullTitle).toContain('Siglens');
    });

    it('description에 티커와 핵심 키워드가 포함된다', () => {
        const content = buildSymbolOverallSeoContent('AAPL', t);
        expect(content.description).toContain('AAPL');
        expect(content.description).toContain('시나리오');
        expect(content.description).toContain('위험 요인');
    });

    it('description은 SEO_DESCRIPTION_MAX_LENGTH(120자) 이하다 — 한글 SERP 안전권', () => {
        const content = buildSymbolOverallSeoContent('AAPL', t);
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('keywords 배열에 티커와 종합 분석 관련 용어가 포함된다', () => {
        const content = buildSymbolOverallSeoContent('AAPL', t);
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
        const content = buildSymbolOverallSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
        });
        expect(content.description).toContain('애플');
    });

    it('koreanName이 있으면 keywords에 한글 변형이 추가된다', () => {
        const content = buildSymbolOverallSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 종합 분석');
        expect(content.keywords).toContain('애플 AI 분석');
        expect(content.keywords).toContain('애플 시나리오 분석');
    });

    it('[SYMBOL] 플레이스홀더가 결과에 포함되지 않는다', () => {
        const content = buildSymbolOverallSeoContent('AMZN', t);
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
        [
            'buildSymbolFinancialsSeoContent',
            buildSymbolFinancialsSeoContent,
            '/financials',
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
            const content = builder(input, t);
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
            const content = builder(input, t);
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

describe('buildBreadcrumbJsonLd', () => {
    it('produces a valid BreadcrumbList with home as first item', () => {
        const result = buildBreadcrumbJsonLd(
            [{ name: 'AAPL', url: '/AAPL' }],
            'ko'
        );

        expect(result['@context']).toBe('https://schema.org');
        expect(result['@type']).toBe('BreadcrumbList');
        const items = result.itemListElement as Array<{
            position: number;
            name: string;
            item: string;
        }>;
        expect(items).toHaveLength(2);
        expect(items[0].position).toBe(1);
        expect(items[0].name).toBe(SITE_NAME);
        expect(items[0].item).toBe(SITE_URL);
        expect(items[1].position).toBe(2);
        expect(items[1].name).toBe('AAPL');
        expect(items[1].item).toBe(`${SITE_URL}/AAPL`);
    });

    it('keeps absolute URLs as-is without prepending SITE_URL', () => {
        const result = buildBreadcrumbJsonLd(
            [{ name: 'External', url: 'https://other.com/path' }],
            'ko'
        );

        const items = result.itemListElement as Array<{
            item: string;
        }>;
        expect(items[1].item).toBe('https://other.com/path');
    });
});

describe('buildSymbolFearGreedSeoContent', () => {
    it('produces correct title, URL, and description', () => {
        const content = buildSymbolFearGreedSeoContent('AAPL', t);
        expect(content.title).toContain('AAPL 공포 탐욕 지수');
        expect(content.url).toBe('https://siglens.io/AAPL/fear-greed');
    });

    it('includes sector in keywords when provided', () => {
        const content = buildSymbolFearGreedSeoContent('AAPL', t, {
            sector: 'Technology',
        });
        expect(content.keywords).toContain('Technology 섹터 매수 분위기');
    });

    it('includes koreanName in keywords when provided', () => {
        const content = buildSymbolFearGreedSeoContent('AAPL', t, {
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 공포 지수');
        expect(content.keywords).toContain('애플 탐욕 지수');
    });
});

describe('buildSymbolOptionsSeoContent', () => {
    it('produces different titles for hasOptions true vs false', () => {
        const withOptions = buildSymbolOptionsSeoContent('AAPL', t, {
            hasOptions: true,
        });
        const noOptions = buildSymbolOptionsSeoContent('AAPL', t, {
            hasOptions: false,
        });

        expect(withOptions.title).toContain('Max Pain');
        expect(noOptions.title).not.toContain('Max Pain');
    });

    it('produces correct URL', () => {
        const content = buildSymbolOptionsSeoContent('NVDA', t);
        expect(content.url).toBe('https://siglens.io/NVDA/options');
    });

    it('includes koreanName in keywords', () => {
        const content = buildSymbolOptionsSeoContent('AAPL', t, {
            koreanName: '애플',
        });
        expect(content.keywords).toContain('애플 옵션');
    });

    it('defaults hasOptions to true', () => {
        const content = buildSymbolOptionsSeoContent('AAPL', t);
        expect(content.title).toContain('Max Pain');
    });
});

describe('buildSnapshotMetaDescription', () => {
    it.each([
        [
            'technical',
            'summary',
            'AAPL은 200일선 위에서 상승 추세를 이어가고 있습니다.',
        ],
        [
            'overall',
            'headlineKo',
            'AAPL, 실적 호조에 힘입어 강세 시나리오 우세',
        ],
        [
            'fundamental',
            'overallConclusionKo',
            'PER은 업종 평균 대비 높지만 성장성이 이를 상쇄합니다.',
        ],
        [
            'financials',
            'overallConclusionKo',
            '매출과 영업이익이 5년 연속 증가하는 추세입니다.',
        ],
        [
            'congress',
            'summaryKo',
            '최근 3개월간 상원 의원들의 순매수가 우세했습니다.',
        ],
        [
            'options',
            'summary',
            '콜옵션 프리미엄이 풋옵션 대비 높게 형성되어 있습니다.',
        ],
        [
            'news',
            'currentDriverKo',
            '최근 실적 발표 이후 주가가 강세를 보이고 있습니다.',
        ],
    ] as const)(
        '%s tab — extracts the primary prose field (%s), prefixes the subject, and clamps it',
        (tab, field, prose) => {
            const content = { [field]: prose };
            expect(
                buildSnapshotMetaDescription(tab, content, 'AAPL', 'ko')
            ).toBe(clampSeoDescription(`AAPL — ${prose}`));
        }
    );

    it('collapses multi-line prose into a single space-joined line, prefixed with the subject', () => {
        const content = {
            summary:
                '첫 번째 문단입니다.\n두 번째 문단입니다.\n\n세 번째 문단입니다.',
        };
        expect(
            buildSnapshotMetaDescription('technical', content, 'AAPL', 'ko')
        ).toBe(
            'AAPL — 첫 번째 문단입니다. 두 번째 문단입니다. 세 번째 문단입니다.'
        );
    });

    // FIX 5 (audit): every templated builder (buildSymbol*SeoContent) leads
    // with the subject (ticker/company name) — losing it here forfeits the
    // bolded query-term match in the SERP snippet for queries like
    // "AAPL 주가 전망".
    it('starts with the subject (FIX 5)', () => {
        const content = { summary: '상승 추세를 이어가고 있습니다.' };
        const result = buildSnapshotMetaDescription(
            'technical',
            content,
            '애플, Apple Inc. (AAPL)',
            'ko'
        );
        expect(result?.startsWith('애플, Apple Inc. (AAPL) — ')).toBe(true);
    });

    // FIX 5 (audit): clamp at the last sentence boundary under the limit
    // instead of a mid-sentence hard cut, when one exists.
    it('clamps an over-length multi-sentence result at the last sentence boundary under the limit (FIX 5)', () => {
        const long = Array(20).fill('첫 문장입니다.').join(' ');
        const content = { summary: long };
        const result = buildSnapshotMetaDescription(
            'technical',
            content,
            'AAPL',
            'ko'
        );

        expect(result).not.toBeNull();
        expect([...(result as string)].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
        expect(result?.startsWith('AAPL — ')).toBe(true);
        // A sentence boundary exists well within the search window (every
        // ~8 chars) — the clamp must land on it, not fall back to a
        // mid-sentence ellipsis cut.
        expect(result?.endsWith('.')).toBe(true);
        expect(result?.endsWith('…')).toBe(false);
    });

    it('clamps an over-length single-line result with no sentence boundary to SEO_DESCRIPTION_MAX_LENGTH with an ellipsis', () => {
        const long = 'a'.repeat(SEO_DESCRIPTION_MAX_LENGTH + 50);
        const content = { summary: long };
        const result = buildSnapshotMetaDescription(
            'technical',
            content,
            'AAPL',
            'ko'
        );
        expect(result).not.toBeNull();
        expect([...(result as string)].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
        expect(result?.endsWith('…')).toBe(true);
    });

    it('returns null for an unrecognized tab', () => {
        expect(
            buildSnapshotMetaDescription(
                'unknown-tab',
                { summary: 'x' },
                'AAPL',
                'ko'
            )
        ).toBeNull();
    });

    it('returns null when content is not an object', () => {
        expect(
            buildSnapshotMetaDescription('technical', null, 'AAPL', 'ko')
        ).toBeNull();
        expect(
            buildSnapshotMetaDescription('technical', undefined, 'AAPL', 'ko')
        ).toBeNull();
        expect(
            buildSnapshotMetaDescription('technical', 'a string', 'AAPL', 'ko')
        ).toBeNull();
        expect(
            buildSnapshotMetaDescription('technical', 42, 'AAPL', 'ko')
        ).toBeNull();
    });

    it('returns null when the primary field is missing', () => {
        expect(
            buildSnapshotMetaDescription(
                'technical',
                { trend: 'bullish' },
                'AAPL',
                'ko'
            )
        ).toBeNull();
    });

    it('returns null when the primary field is not a string', () => {
        expect(
            buildSnapshotMetaDescription(
                'technical',
                { summary: 123 },
                'AAPL',
                'ko'
            )
        ).toBeNull();
        expect(
            buildSnapshotMetaDescription(
                'overall',
                { headlineKo: null },
                'AAPL',
                'ko'
            )
        ).toBeNull();
    });

    it('returns null when the primary field is an empty or whitespace-only string', () => {
        expect(
            buildSnapshotMetaDescription(
                'technical',
                { summary: '' },
                'AAPL',
                'ko'
            )
        ).toBeNull();
        expect(
            buildSnapshotMetaDescription(
                'news',
                { currentDriverKo: '   \n  ' },
                'AAPL',
                'ko'
            )
        ).toBeNull();
    });

    // Call-site contract (unchanged by FIX 5): a null return from this
    // function is the caller's signal to fall back to the templated
    // buildSymbol*SeoContent(...).description — verified at each of the 7
    // page.tsx call sites via `snapshotDescription ?? metadata.description`.
    // Nothing in this function's own return value changes that contract; the
    // null-returning cases above are exactly the fallback trigger.
});

describe('buildWebPageJsonLd', () => {
    /**
     * 회귀: `inLanguage`가 `'ko'` 고정이라 `/en/AAPL`의 `WebPage`가 한국어를
     * 자처했다 — 같은 페이지의 형제 `Article` 노드는 이미 로케일을 따르고 있어
     * 한 문서 안에서 두 노드가 서로 다른 언어를 주장했다.
     */
    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: inLanguage가 html lang과 같다',
        locale => {
            const result = buildWebPageJsonLd({
                url: 'https://siglens.io/AAPL',
                name: 'AAPL',
                description: 'desc',
                locale,
            }) as Record<string, unknown>;

            // `<html lang>`과 같은 태그여야 한다 — `zh`는 `zh-Hans`다.
            expect(result['inLanguage']).toBe(LOCALE_HREFLANG[locale]);
        }
    );

    it('필수 필드(context/type/id/name/description/url/inLanguage/isPartOf)를 모두 포함한다', () => {
        const result = buildWebPageJsonLd({
            url: 'https://siglens.io/AAPL',
            name: 'AAPL 주가 분석 | Siglens',
            description: 'AAPL 주가 흐름과 매매 신호를 확인합니다.',
            locale: 'ko',
        }) as Record<string, unknown>;

        expect(result['@context']).toBe('https://schema.org');
        expect(result['@type']).toBe('WebPage');
        expect(result['@id']).toBe('https://siglens.io/AAPL#webpage');
        expect(result['name']).toBe('AAPL 주가 분석 | Siglens');
        expect(result['description']).toBe(
            'AAPL 주가 흐름과 매매 신호를 확인합니다.'
        );
        expect(result['url']).toBe('https://siglens.io/AAPL');
        expect(result['inLanguage']).toBe('ko');
        expect(result['isPartOf']).toEqual({
            '@type': 'WebSite',
            '@id': `${SITE_URL}#website`,
        });
    });

    it('about이 없으면 about 키를 포함하지 않는다', () => {
        const result = buildWebPageJsonLd({
            url: 'https://siglens.io/AAPL',
            name: 'AAPL | Siglens',
            description: '설명',
            locale: 'ko',
        }) as Record<string, unknown>;

        expect('about' in result).toBe(false);
    });

    it('about이 있으면 about 키를 포함한다', () => {
        const aboutNode = { '@type': 'Corporation', name: '애플' };
        const result = buildWebPageJsonLd({
            url: 'https://siglens.io/AAPL',
            name: 'AAPL | Siglens',
            description: '설명',
            about: aboutNode,
            locale: 'ko',
        }) as Record<string, unknown>;

        expect(result['about']).toEqual(aboutNode);
    });

    it('@id가 url#webpage 패턴이다', () => {
        const url = 'https://siglens.io/TSLA/overall';
        const result = buildWebPageJsonLd({
            url,
            name: 'TSLA | Siglens',
            description: '설명',
            locale: 'ko',
        }) as Record<string, unknown>;

        expect(result['@id']).toBe(`${url}#webpage`);
    });
});

describe('symbolMetadataFromSeo', () => {
    // `describe` 콜백 본문은 vitest의 수집(collection) 단계에서 즉시 실행되므로,
    // `beforeAll`이 채우기 전의 `t`를 참조하면 `undefined`다. `beforeAll` 안에서
    // 계산해야 실행(run) 단계 — 바깥 `beforeAll`이 `t`를 채운 뒤 — 에 돈다.
    let baseSeo: ReturnType<typeof buildSymbolSeoContent>;
    beforeAll(() => {
        baseSeo = buildSymbolSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
    });

    it('title/description/keywords를 그대로 매핑한다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');

        // title은 { absolute } 형태다 — 루트 레이아웃의 title.template
        // ("%s | Siglens" 자동 접미사)를 무시하기 위함(Task 6).
        expect(meta.title).toEqual({ absolute: baseSeo.title });
        expect(meta.description).toBe(baseSeo.description);
        expect(meta.keywords).toEqual(baseSeo.keywords);
    });

    /**
     * 회귀 방지: `/en/AAPL`의 `<title>`이 한국어 사이트 기본 제목으로 떨어졌던 건.
     * 색인은 막되 **제목·설명·og는 그 로케일 것**이 나가야 한다.
     */
    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 색인은 막지만 제목은 유지하고 follow는 남긴다',
        locale => {
            const meta = symbolMetadataFromSeo(baseSeo, locale);

            expect(meta.robots).toEqual({ index: false, follow: true });
            expect(meta.title).toEqual({ absolute: baseSeo.title });
            expect(meta.description).toBe(baseSeo.description);
            expect((meta.openGraph as Record<string, unknown>)['title']).toBe(
                baseSeo.fullTitle
            );
        }
    );

    it('기본 로케일에는 robots를 덮지 않는다', () => {
        expect(symbolMetadataFromSeo(baseSeo, 'ko').robots).toBeUndefined();
    });

    it('alternates.canonical이 seo.url이다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');

        expect(meta.alternates?.canonical).toBe(baseSeo.url);
    });

    it('openGraph에 type/siteName/locale이 고정값으로 들어간다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');
        const og = meta.openGraph as Record<string, unknown>;

        expect(og['type']).toBe('website');
        expect(og['siteName']).toBe(SITE_NAME);
        expect(og['locale']).toBe('ko_KR');
        expect(og['title']).toBe(baseSeo.fullTitle);
        expect(og['description']).toBe(baseSeo.description);
        expect(og['url']).toBe(baseSeo.url);
    });

    it('twitter에 card/title/description이 들어간다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');
        const tw = meta.twitter as Record<string, unknown>;

        expect(tw['card']).toBe('summary_large_image');
        // twitter.title은 fullTitle(브랜드 포함) — 소셜 카드는 SERP 폭
        // 제약이 없고 브랜드 노출이 도움이 된다(Task 6).
        expect(tw['title']).toBe(baseSeo.fullTitle);
        expect(tw['title']).toContain('Siglens');
        expect(tw['description']).toBe(baseSeo.description);
    });

    it('openGraph.title이 fullTitle(브랜드 포함)이고 meta.title이 absolute(브랜드 제외)이다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');
        const og = meta.openGraph as Record<string, unknown>;

        // title은 { absolute }로 루트 레이아웃의 "| Siglens" 자동 접미사를
        // 무시한다 → 브랜드 미포함(Task 6, `| Siglens` 8 폭단위를 검색 의도
        // 카피로 되돌린다).
        // as 캐스팅 근거: symbolMetadataFromSeo는 항상 title을 { absolute }
        // 형태로만 반환한다(구현 참고) — Next.js Metadata['title'] 유니온
        // (string | TemplateString | null)을 좁히는 것이지 검증 안 된 값을
        // 단언하는 게 아니다.
        const titleMeta = meta.title as { absolute: string };
        expect(titleMeta.absolute).toBe(baseSeo.title);
        expect(titleMeta.absolute).not.toContain('Siglens');
        // openGraph/twitter title은 fullTitle(브랜드 포함) 사용 —
        // 소셜 카드는 SERP 폭 제약이 없고 브랜드 노출이 도움이 된다.
        expect(og['title']).toContain('Siglens');
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
        ['buildSymbolFinancialsSeoContent', buildSymbolFinancialsSeoContent],
        ['buildSymbolNewsSeoContent', buildSymbolNewsSeoContent],
        ['buildSymbolOverallSeoContent', buildSymbolOverallSeoContent],
        ['buildSymbolFearGreedSeoContent', buildSymbolFearGreedSeoContent],
    ] as const)('%s — description이 120자 클램프 이하', (_name, builder) => {
        const content = builder('AAPL', t, richOpts);
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('buildSymbolOptionsSeoContent — hasOptions:true에서도 120자 이하', () => {
        const content = buildSymbolOptionsSeoContent('AAPL', t, {
            ...richOpts,
            hasOptions: true,
        });
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('buildSymbolOptionsSeoContent — hasOptions:false에서도 120자 이하', () => {
        const content = buildSymbolOptionsSeoContent('AAPL', t, {
            ...richOpts,
            hasOptions: false,
        });
        expect(content.description.length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });
});

/**
 * 런타임 감사(R15)가 실측으로 잡은 두 건. 둘 다 "번역된 템플릿 + 번역 안 된
 * 데이터"라는 같은 모양이라, `i18n:lint`의 리터럴 기준선이 구조적으로 못 본다.
 */
describe('비-기본 로케일 SEO — 감사 실측 회귀', () => {
    it('스냅샷 설명은 비-ko에서 쓰지 않는다', () => {
        // 스냅샷은 로케일 없이 저장돼 산문이 항상 한국어다. 그대로 쓰면
        // `<meta name="description">`(한국어)과 `og:description`(영어)이
        // 같은 문서에서 어긋난다.
        const content = { summary: '애플 주식은 최근 급락 이후 반등했다.' };

        expect(
            buildSnapshotMetaDescription(
                'technical',
                content,
                'Apple Inc. (AAPL)',
                'ko'
            )
        ).toContain('애플');
        for (const locale of ['en', 'ja', 'zh'] as const) {
            expect(
                buildSnapshotMetaDescription(
                    'technical',
                    content,
                    'Apple Inc. (AAPL)',
                    locale
                )
            ).toBeNull();
        }
    });

    it('비-ko title은 영문 법인명으로 대체한다 — 티커만 남기지 않는다', () => {
        const args = {
            ticker: '005930.KS',
            koreanName: '삼성전자',
            englishName: 'Samsung Electronics',
            core: 'Stock Forecast',
        };

        // 한국어명을 뺀 자리에 영문명이 들어가야 한다. 안 그러면 국내 종목은
        // 제목이 `005930 Stock Forecast`처럼 숫자만 남는다.
        expect(composeSymbolTitle({ ...args, locale: 'en' })).toContain(
            'Samsung Electronics'
        );
        expect(composeSymbolTitle({ ...args, locale: 'en' })).not.toContain(
            '삼성전자'
        );
        expect(composeSymbolTitle({ ...args, locale: 'ko' })).toContain(
            '삼성전자'
        );
    });
});

/**
 * JSON-LD의 `url`·`@id`는 **canonical과 같은 문서를 가리켜야 한다.**
 *
 * 실측(R15): `/en/AAPL`이 `<link rel="canonical" href=".../en/AAPL">`을 걸고도
 * `WebPage.url`은 `.../AAPL`을 말했고, `@id`가 `${url}#webpage`라서 **네 로케일이
 * 전부 같은 `@id`를 발행**하면서 각자 다른 `inLanguage`를 선언했다.
 */
describe('JSON-LD 로케일 URL', () => {
    const base = {
        url: `${SITE_URL}/AAPL`,
        name: 'Apple',
        description: 'desc',
    };

    it('@id가 로케일마다 다르다', () => {
        const ids = (['ko', 'en', 'ja', 'zh'] as const).map(
            locale => buildWebPageJsonLd({ ...base, locale })['@id']
        );

        expect(new Set(ids).size).toBe(4);
    });

    it('url이 로케일 접두사를 갖는다 — 기본 로케일은 접두사 없음', () => {
        expect(buildWebPageJsonLd({ ...base, locale: 'ko' }).url).toBe(
            `${SITE_URL}/AAPL`
        );
        expect(buildWebPageJsonLd({ ...base, locale: 'ja' }).url).toBe(
            `${SITE_URL}/ja/AAPL`
        );
    });

    it('breadcrumb 항목도 같은 규칙을 따른다', () => {
        const crumb = buildBreadcrumbJsonLd(
            [{ name: 'AAPL', url: '/AAPL' }],
            'en'
        );
        const items = (crumb.itemListElement as Array<{ item: string }>).map(
            e => e.item
        );

        // 첫 항목은 사이트 루트다 — 여기도 로케일 홈을 가리켜야 한다.
        expect(items).toEqual([`${SITE_URL}/en`, `${SITE_URL}/en/AAPL`]);
    });
});

/**
 * `englishName`을 **모든** 리졸버가 실제로 전달하는지 본다.
 *
 * 도입 당시 4개 중 1개만 전달하고 나머지 3개는 조용히 흘렸다 — 인자는
 * 옵셔널이고 타입은 맞아서 컴파일도 기존 테스트도 통과했다. 각 리졸버를
 * 호출하되 `englishName`을 단언하지 않는 테스트가 이미 있었는데, 그게 정확히
 * 이 결함을 못 보는 모양이었다.
 *
 * 리졸버를 배열로 돌린다 — 새 탭이 생기면 여기 등록해야 하고, 등록을 잊으면
 * 그건 그것대로 다음 감사에서 잡힌다.
 */
describe('resolve*SeoContent — englishName 전달', () => {
    const RESOLVERS = [
        ['chart', resolveSymbolSeoContent],
        ['news', resolveSymbolNewsSeoContent],
        ['overall', resolveSymbolOverallSeoContent],
        ['fear-greed', resolveSymbolFearGreedSeoContent],
    ] as const;

    it('리졸버를 하나도 빠뜨리지 않았다', () => {
        // seo.ts가 내보내는 `resolve*SeoContent` 수와 위 목록이 일치해야 한다.
        const source = readFileSync(
            `${process.cwd()}/src/shared/lib/seo.ts`,
            'utf8'
        );
        const exported = [
            ...source.matchAll(/export function (resolve\w*SeoContent)\b/g),
        ];

        expect(exported).toHaveLength(RESOLVERS.length);
    });

    it.each(RESOLVERS)(
        '%s: 비-ko에서 영문명이 title에 들어간다',
        (_name, resolve) => {
            const content = resolve('AAPL', 'equity', t, {
                displayName: 'Apple Inc. (AAPL)',
                koreanName: '애플',
                englishName: 'Apple Inc.',
                locale: 'en',
            });

            // 한국어명은 빠지고 그 자리를 영문명이 채워야 한다.
            expect(content.title).toContain('Apple Inc.');
            expect(content.title).not.toContain('애플');
        }
    );
});

/**
 * 폭 예산(55)은 한글 기준이라 라틴 문자 법인명이 쉽게 넘긴다. 그래서 국내
 * 종목의 비-ko 제목이 8개 탭 중 4개에서 `005930 Overall Analysis`가 됐다 —
 * 숫자만 남는 제목. `Apple Inc.`처럼 짧은 이름으로만 검증해서 처음엔 못 봤다.
 */
describe('composeSymbolTitle — 긴 영문 법인명', () => {
    const LONG = 'Samsung Electronics Co., Ltd.';

    // 카탈로그의 실제 core/tail 조합 — 감사가 실패로 관측한 탭들이다.
    const TABS = [
        ['Overall Analysis', 'Bull & Bear Scenarios'],
        ['News', 'Sentiment & Analyst Ratings'],
        ['Financial Statements', 'Revenue, Profit & Cash Flow'],
        ['Fear & Greed Index', '0–100 Score, 5 Levels'],
        ['Fundamentals', 'PER, ROE & Consensus'],
        ['Stock Forecast', 'Chart & Trading Signals'],
    ] as const;

    it.each(TABS)('core "%s"에서도 회사명이 남는다', (core, tail) => {
        const title = composeSymbolTitle({
            ticker: '005930.KS',
            koreanName: '삼성전자',
            englishName: LONG,
            locale: 'en',
            core,
            tail,
        });

        // 법인 접미사는 버려도 되지만, 이름 자체가 사라지면 안 된다.
        expect(title).toContain('Samsung Electronics');
        expect(title).toContain(core);
    });

    it('짧은 이름은 접미사를 유지한다', () => {
        // 예산에 여유가 있으면 굳이 깎지 않는다.
        expect(
            composeSymbolTitle({
                ticker: 'AAPL',
                koreanName: '애플',
                englishName: 'Apple Inc.',
                locale: 'en',
                core: 'Stock Forecast',
            })
        ).toContain('Apple Inc.');
    });
});
