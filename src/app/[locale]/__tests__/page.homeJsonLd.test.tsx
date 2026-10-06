/**
 * 홈 FAQ는 **화면과 마크업이 한 배열**에서 나와야 한다.
 *
 * 홈은 오랫동안 12문항짜리 `FAQPage`를 마크업으로만 내보내고 화면에는 Q&A가 한
 * 줄도 없었다. 구글은 FAQPage에 대응하는 질문·답변이 페이지에 실제로 보일 것을
 * 요구하므로 그 상태는 리치 결과 자격이 없을 뿐 아니라 숨김 콘텐츠 판정 쪽에
 * 가깝다. 배열 하나에서 두 표면을 만들면 갈릴 수가 없다는 것을 여기서 못 박는다.
 */
vi.mock('@/widgets/home/heroQuickLinks', () => ({
    HERO_QUICK_LINKS: [
        { href: '/market', labelKey: 'shared.config.nav.full.market.us' },
    ],
}));
vi.mock('@/widgets/home/CryptoShowcase', () => ({
    CryptoShowcase: () => null,
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
vi.mock('@/widgets/home/TickerCategories', () => ({
    TickerCategories: () => null,
}));
vi.mock('@/features/ticker-search/ui/SymbolSearchPanel', () => ({
    SymbolSearchPanel: () => null,
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

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import Home, { generateMetadata } from '@/app/[locale]/(home)/page';
import { buildHomeFaq } from '@/app/[locale]/homeJsonLd';
import { expectFaqSingleSource } from '@/__tests__/utils/expectFaqSingleSource';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import {
    brandIntroName,
    buildOrganizationCoreJsonLd,
    GITHUB_URL,
    SEO_TITLE_MAX_WIDTH,
    seoTitleWidth,
    SITE_NAME_KO,
    X_URL,
} from '@/shared/lib/seo';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { StatsBar } from '@/widgets/home/StatsBar';
import { OPERATOR_SAME_AS, SITE_OPERATOR } from '@/shared/lib/legal';

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

    it('H1이 시그렌즈(Siglens)를 담고 마케팅 문구("새로운 기준")는 없다', async () => {
        const { container } = render(await renderHome());
        const h1 = container.querySelector('h1')!;

        expect(h1.textContent).toContain(brandIntroName('ko'));
        expect(h1.textContent).not.toContain('새로운 기준');
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

    it('JSON-LD 문항 수 == 화면 <dt> 수', async () => {
        const tree = await renderHome();

        const faq = collectJsonLdData(tree).find(
            d => d['@type'] === 'FAQPage'
        ) as { mainEntity: unknown[] } | undefined;
        expect(faq).toBeDefined();

        const { container } = render(tree);
        expect(container.querySelectorAll('dt')).toHaveLength(
            faq!.mainEntity.length
        );
    });

    it('답변 속 사이트 경로(/market 등)는 화면에서 링크가 되고 구조화데이터에는 원문이 간다', async () => {
        const tree = await renderHome();
        const { container } = render(tree);

        const hrefs = [...container.querySelectorAll('dd a')].map(a =>
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

        const linkTexts = [...container.querySelectorAll('dd a')].map(
            a => a.textContent
        );
        expect(linkTexts.every(text => /^\/[A-Za-z]/.test(text ?? ''))).toBe(
            true
        );
        expect(linkTexts).not.toContain('/7');
    });

    it('StatsBar는 히어로 카피와 같은 skillCounts를 받는다', async () => {
        const tree = await renderHome();

        const statsBar = findElementByType(tree, StatsBar);
        expect(statsBar?.props).toMatchObject({
            counts: { indicators: 13, candlesticks: 30, patterns: 5 },
        });
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
     * `Organization.sameAs`는 **조직**의 외부 프로필(서비스 저장소·서비스 X 계정)만 싣는다.
     * 운영자 개인 GitHub·velog는 사람의 프로필이라 `founder.sameAs`에만 둔다 — 개인 계정이
     * 조직 노드에 섞이면 파서가 조직과 운영자를 같은 주체로 읽는다(2026-10-05 감사).
     */
    it('sameAs는 서비스 저장소와 서비스 X 계정뿐이다(개인 GitHub·velog 제외)', async () => {
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

    it('founder.sameAs는 운영자 프로필 두 곳(GitHub·velog)이다', async () => {
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
     * 영문 `Siglens`는 동명 프로젝트와 겹쳐 발행 주체를 식별하지 못한다. 한글
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
            '시그렌즈(Siglens)는 어떤 서비스인가요?'
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

            expect(faq[0]?.question).toBe('faq.q0.question|Siglens');
        }
    );
});
