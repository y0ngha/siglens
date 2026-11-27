/**
 * 홈 FAQ는 **화면과 마크업이 한 배열**에서 나와야 한다.
 *
 * 홈은 오랫동안 12문항짜리 `FAQPage`를 마크업으로만 내보내고 화면에는 Q&A가 한
 * 줄도 없었다. 구글은 FAQPage에 대응하는 질문·답변이 페이지에 실제로 보일 것을
 * 요구하므로 그 상태는 리치 결과 자격이 없을 뿐 아니라 숨김 콘텐츠 판정 쪽에
 * 가깝다. 배열 하나에서 두 표면을 만들면 갈릴 수가 없다는 것을 여기서 못 박는다.
 */
vi.mock('@/widgets/home/utils/heroQuickLinks', () => ({
    HERO_QUICK_LINKS: [
        { href: '/market', labelKey: 'shared.config.nav.full.market.us' },
    ],
}));
vi.mock('@/widgets/home/HeroIllustration', () => ({
    HeroIllustration: () => null,
}));
vi.mock('@/widgets/home/SkillsShowcase', () => ({
    SkillsShowcase: () => null,
}));
vi.mock('@/widgets/home/StatsBar', () => ({
    StatsBar: () => null,
}));
vi.mock('@/features/watchlist/ui/HomeWatchlistCard', () => ({
    HomeWatchlistCard: () => null,
}));
vi.mock('@/widgets/home/PopularTickers', () => ({
    PopularTickers: () => null,
}));
vi.mock('@/features/ticker-search/ui/SymbolSearchPanel', () => ({
    SymbolSearchPanel: () => null,
}));
// "오늘의 시장" 로더는 FMP·DB 캐시를 읽는다 — 이 파일의 관심사(메타·마크업)와 무관하니 빈 값으로 둔다.
vi.mock('@/app/[locale]/(home)/_lib/loadHomeTodayMarket', () => ({
    loadHomeTodayMarket: vi.fn(async () => ({
        fearGreed: { us: null, kr: null, crypto: null },
        signals: {
            us: { rows: [], computedAt: null },
            kr: { rows: [], computedAt: null },
        },
    })),
}));
vi.mock('@/entities/skill/api', () => ({
    countSkillFiles: vi.fn().mockResolvedValue({
        indicators: 13,
        candlesticks: 30,
        patterns: 5,
        strategies: 4,
        supportResistance: 3,
        fundamental: 2,
        news: 1,
    }),
    loadShowcaseSkills: vi.fn().mockResolvedValue([]),
}));
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import { expectFaqSingleSource } from '@/__tests__/utils/expectFaqSingleSource';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { HomeMethodBand } from '@/app/[locale]/(home)/_components/HomeMethodBand';
import { buildHomeFaq } from '@/app/[locale]/(home)/_lib/homeJsonLd';
import Home, { generateMetadata } from '@/app/[locale]/(home)/page';
import { SITE_NAME_KO } from '@/shared/config/brand';
import { OPERATOR_SAME_AS, SITE_OPERATOR } from '@/shared/lib/legal';
import {
    brandIntroName,
    buildOrganizationCoreJsonLd,
    GITHUB_URL,
    X_URL,
} from '@/shared/lib/seo';
import { SEO_TITLE_MAX_WIDTH, seoTitleWidth } from '@/shared/lib/seoClamp';
import { defined } from '@/shared/test-utils/defined';
import { resolveMeterDailySymbols } from '@/widgets/analysis/utils/meterDailySymbols';
import koMessages from '../../../../messages/ko.json';

const KO_ROOT_SEO = koMessages.shared.seo.root;
const KO_HOME_PAGE = koMessages.app.home.page;

async function renderHome() {
    return await Home({ params: Promise.resolve({ locale: 'ko' }) });
}

describe('홈 메타데이터·H1·WebPage — 브랜드', () => {
    it('title·og·twitter 제목에 한글·영문 브랜드가 들어가고 폭이 55 이하다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        const title = (metadata.title as { absolute: string }).absolute;

        expect(title).toContain(SITE_NAME_KO);
        expect(title.startsWith(brandIntroName('ko'))).toBe(true);
        expect(seoTitleWidth(title)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
        expect(metadata.openGraph?.title).toBe(title);
        expect(metadata.twitter?.title).toBe(title);
        expect(metadata.twitter).toMatchObject({ site: '@siglens_io' });
    });

    it('H1이 시그렌즈(SIGLENS)를 담고 마케팅 문구("새로운 기준")는 없다', async () => {
        const { container } = render(await renderHome());
        const h1 = container.querySelector('h1')!;

        expect(h1.textContent).toContain(brandIntroName('ko'));
        expect(h1.textContent).not.toContain('새로운 기준');
    });

    it('H1은 새 헤드라인과 브랜드를 담고 옛 문구("분석 서비스")와 "확신"은 없다', async () => {
        const { container } = render(await renderHome());
        const h1 = defined(container.querySelector('h1'));

        expect(h1.textContent).toContain(KO_HOME_PAGE.headline);
        expect(h1.textContent).toContain(brandIntroName('ko'));
        expect(h1.textContent).not.toContain('분석 서비스');
        expect(h1.textContent).not.toContain('확신');
    });

    it('눈썹 문구가 카탈로그 값이고 "확신"이 없다', async () => {
        const { container } = render(await renderHome());

        const eyebrow = [...container.querySelectorAll('p')].find(
            p => p.textContent === KO_HOME_PAGE.eyebrow
        );
        expect(eyebrow).toBeDefined();
        expect(eyebrow?.textContent).not.toContain('확신');
    });

    it('WebApplication·WebPage·Organization 설명은 root.description이고 Organization의 disambiguatingDescription은 root.headline이다', async () => {
        const nodes = collectJsonLdData(await renderHome());
        const byType = (type: string) =>
            nodes.find(d => d['@type'] === type) as
                | { description: string; disambiguatingDescription?: string }
                | undefined;

        expect(byType('WebApplication')?.description).toBe(
            KO_ROOT_SEO.description
        );
        expect(byType('WebPage')?.description).toBe(KO_ROOT_SEO.description);
        expect(byType('Organization')?.description).toBe(
            KO_ROOT_SEO.description
        );
        expect(byType('Organization')?.disambiguatingDescription).toBe(
            KO_ROOT_SEO.headline
        );
    });

    it('메타 description·og·twitter 설명이 root.description이다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });

        expect(metadata.description).toBe(KO_ROOT_SEO.description);
        expect(metadata.openGraph?.description).toBe(KO_ROOT_SEO.description);
        expect(metadata.twitter?.description).toBe(KO_ROOT_SEO.description);
    });

    it('WebPage JSON-LD name이 title과 같다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        const webPage = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'WebPage'
        ) as { name: string } | undefined;

        expect(webPage?.name).toBe(
            (metadata.title as { absolute: string }).absolute
        );
    });
});

describe('홈 FAQ', () => {
    it('FAQPage 구조화데이터가 화면 FaqSection과 같은 질문·답변을 쓴다', async () => {
        expectFaqSingleSource(await renderHome());
    });

    it('JSON-LD 문항 수 == 화면 <summary> 수(접힌 FAQ)', async () => {
        const tree = await renderHome();

        const faq = collectJsonLdData(tree).find(
            d => d['@type'] === 'FAQPage'
        ) as { mainEntity: unknown[] } | undefined;
        expect(faq).toBeDefined();

        const { container } = render(tree);
        expect(container.querySelectorAll('summary')).toHaveLength(
            faq!.mainEntity.length
        );
        expect(container.querySelector('dt')).toBeNull();
    });

    it('답변 속 사이트 경로(/market 등)는 화면에서 링크가 되고 구조화데이터에는 원문이 간다', async () => {
        const tree = await renderHome();
        const { container } = render(tree);

        const hrefs = [...container.querySelectorAll('details a')].map(a =>
            a.getAttribute('href')
        );
        expect(hrefs).toContain('/market');
        expect(hrefs).toContain('/NVDA/overall');

        const faq = collectJsonLdData(tree).find(
            d => d['@type'] === 'FAQPage'
        ) as { mainEntity: { acceptedAnswer: { text: string } }[] };
        for (const { acceptedAnswer } of faq.mainEntity) {
            expect(acceptedAnswer.text).not.toMatch(/<a\b|<\/a>/);
        }
        expect(
            faq.mainEntity.some(e => e.acceptedAnswer.text.includes('/market '))
        ).toBe(true);
    });

    it('PER/PBR·24/7 같은 글자는 링크가 되지 않는다', async () => {
        const { container } = render(await renderHome());

        const linkTexts = [...container.querySelectorAll('details a')].map(
            a => a.textContent
        );
        expect(linkTexts.every(text => /^\/[A-Za-z]/.test(text ?? ''))).toBe(
            true
        );
        expect(linkTexts).not.toContain('/7');
    });

    it('HomeMethodBand(StatsBar를 담는다)는 히어로 카피와 같은 skillCounts를 받는다', async () => {
        const tree = await renderHome();

        const band = findElementByType(tree, HomeMethodBand);
        expect(band?.props).toMatchObject({
            counts: { indicators: 13, candlesticks: 30, patterns: 5 },
            guestDailySymbols: resolveMeterDailySymbols(),
        });
    });

    it('FAQ는 접혀 있고 첫 문항(q0)만 열려 있으며 닫힌 답변도 문서에 있다', async () => {
        const tree = await renderHome();
        const { container } = render(tree);

        const faq = collectJsonLdData(tree).find(
            d => d['@type'] === 'FAQPage'
        ) as { mainEntity: { acceptedAnswer: { text: string } }[] };
        const details = [...container.querySelectorAll('details')];
        expect(details.map(d => d.open)).toEqual(
            faq.mainEntity.map((_, index) => index === 0)
        );
        expect(details.map(d => d.querySelector('p')?.textContent)).toEqual(
            faq.mainEntity.map(e => e.acceptedAnswer.text)
        );
    });

    it('q10 답변이 비회원 하루 한도를 core 정책 값으로 말한다', async () => {
        const faqPage = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'FAQPage'
        ) as
            | {
                  mainEntity: {
                      name: string;
                      acceptedAnswer: { text: string };
                  }[];
              }
            | undefined;
        const q10 = faqPage?.mainEntity.find(
            e => e.name === '서비스 이용 요금이 있나요?'
        );

        expect(q10?.acceptedAnswer.text).toContain(
            `비회원도 하루 ${resolveMeterDailySymbols()}종목까지`
        );
    });

    it('buildHomeFaq는 모든 답변에 정책 값 v3를 넘긴다', () => {
        const answers = buildHomeFaq(
            (key, values) => `${key}|${String(values?.v3)}`,
            'ko'
        ).map(item => item.answer);

        expect(answers).toHaveLength(6);
        expect(
            answers.every(answer =>
                answer.endsWith(`|${resolveMeterDailySymbols()}`)
            )
        ).toBe(true);
    });

    it('q0 답변의 첫 문장이 가격대 포지셔닝을 말하고 "무료"로 시작하지 않는다', async () => {
        const faqPage = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'FAQPage'
        ) as { mainEntity: { acceptedAnswer: { text: string } }[] } | undefined;
        const firstSentence =
            faqPage?.mainEntity[0]?.acceptedAnswer.text.split('. ')[0] ?? '';

        expect(firstSentence).toContain('지지선과 저항선');
        expect(firstSentence).toContain('무효화 기준');
        expect(firstSentence).not.toContain('무료');
    });

    /**
     * 6문항으로 줄인 것은 카피 취향이 아니라 결정 사항이다(2026-09-17 §결정 6) —
     * 탈락한 문항은 탭별 FAQ와 중복이거나 매수세 조언 톤이었다. 배열이 조용히
     * 다시 불어나면 홈이 또 12문항짜리 FAQ 블록이 된다.
     */
    it('홈에 싣는 문항은 6개다', () => {
        expect(buildHomeFaq(key => key, 'ko')).toHaveLength(6);
    });
});

describe('홈 Organization 노드', () => {
    /**
     * 전역 `SiteJsonLd`가 같은 `@id`로 최소 Organization 노드를 싣는다. 파서는 같은 `@id`를
     * 하나로 합치므로 겹치는 속성(@type·@id·name·url)이 두 정의에서 같아야 충돌이 없다.
     */
    it('핵심 속성이 전역 최소 노드(buildOrganizationCoreJsonLd)와 같다', async () => {
        const organization = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'Organization'
        );

        expect(organization).toMatchObject({
            ...buildOrganizationCoreJsonLd(),
        });
    });

    /**
     * `Organization.sameAs`는 **조직**의 외부 프로필(서비스 저장소·서비스 X)만 싣는다.
     * 운영자 개인 GitHub·velog는 사람의 프로필이라 `founder.sameAs`에만 둔다 — 개인 계정이
     * 조직 노드에 섞이면 파서가 조직과 운영자를 같은 주체로 읽는다(2026-10-05 감사).
     */
    it('sameAs는 서비스 저장소·X뿐이다(개인 GitHub·velog 제외)', async () => {
        const organization = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'Organization'
        ) as { sameAs: string[] } | undefined;

        expect(organization?.sameAs).toEqual([
            'https://github.com/y0ngha/siglens',
            'https://x.com/siglens_io',
        ]);
        expect(organization?.sameAs).toEqual([GITHUB_URL, X_URL]);
        expect(organization?.sameAs).not.toContain(SITE_OPERATOR.githubUrl);
        expect(organization?.sameAs).not.toContain(SITE_OPERATOR.velogUrl);
    });

    it('founder.sameAs는 운영자 개인 GitHub과 velog다', async () => {
        const organization = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'Organization'
        ) as { founder: { sameAs: string[] } } | undefined;

        expect(organization?.founder.sameAs).toEqual([
            'https://github.com/y0ngha',
            'https://velog.io/@y0ngha',
        ]);
        expect(organization?.founder.sameAs).toEqual([...OPERATOR_SAME_AS]);
    });

    /**
     * 영문 `SIGLENS`는 동명 프로젝트와 겹쳐 발행 주체를 식별하지 못한다. 한글
     * 표기가 Organization에 없으면 "시그렌즈"가 가리키는 노드가 그래프에 없다.
     */
    it('alternateName으로 한글 표기를 싣는다', async () => {
        const organization = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'Organization'
        ) as { alternateName: string } | undefined;

        expect(organization?.alternateName).toBe('시그렌즈');
    });

    /**
     * 화면 FAQ와 FAQPage 마크업이 같은 배열을 쓴다. 첫 문항이 브랜드를 묻는
     * 질문이라, 여기서 한글 표기와 영문 표기가 함께 나와야 둘이 같은 서비스로 묶인다.
     */
    it('ko 홈 FAQ 첫 문항은 한글·영문 브랜드를 함께 적는다', async () => {
        const faqPage = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'FAQPage'
        ) as { mainEntity: { name: string }[] } | undefined;

        expect(faqPage?.mainEntity[0]?.name).toBe(
            '시그렌즈(SIGLENS)는 어떤 서비스인가요?'
        );
    });

    /**
     * 한글 표기는 한글 독음이라 ko에서만 낸다. 다른 로케일 질문에 섞이면 그
     * 로케일 독자에게는 읽을 수 없는 글자가 브랜드 자리에 들어간다.
     */
    it.each(['en', 'ja', 'zh'] as const)(
        '%s 홈 FAQ 첫 문항은 영문 브랜드만 쓴다',
        locale => {
            const faq = buildHomeFaq(
                (key, values) => `${key}|${String(values?.v0)}`,
                locale
            );

            expect(faq[0]?.question).toBe('faq.q0.question|SIGLENS');
        }
    );
});
