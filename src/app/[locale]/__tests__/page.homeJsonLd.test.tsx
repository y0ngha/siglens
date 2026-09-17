/**
 * 홈 FAQ는 **화면과 마크업이 한 배열**에서 나와야 한다.
 *
 * 홈은 오랫동안 12문항짜리 `FAQPage`를 마크업으로만 내보내고 화면에는 Q&A가 한
 * 줄도 없었다. 구글은 FAQPage에 대응하는 질문·답변이 페이지에 실제로 보일 것을
 * 요구하므로 그 상태는 리치 결과 자격이 없을 뿐 아니라 숨김 콘텐츠 판정 쪽에
 * 가깝다. 배열 하나에서 두 표면을 만들면 갈릴 수가 없다는 것을 여기서 못 박는다.
 */
vi.mock('@/widgets/home', () => ({
    HERO_QUICK_LINKS: [
        { href: '/market', labelKey: 'shared.config.nav.full.market.us' },
    ],
    CryptoShowcase: () => null,
    HeroIllustration: () => null,
    SkillsShowcase: () => null,
    SkillsShowcaseSkeleton: () => null,
    StatsBar: () => null,
    StatsBarSkeleton: () => null,
    TickerCategories: () => null,
}));
vi.mock('@/features/ticker-search', () => ({ SymbolSearchPanel: () => null }));
vi.mock('@/entities/skill', () => ({
    countSkillFiles: vi.fn().mockResolvedValue({
        indicators: 13,
        candlesticks: 30,
        patterns: 5,
        strategies: 4,
        supportResistance: 3,
        fundamental: 2,
        news: 1,
    }),
    FileSkillsLoader: vi.fn().mockImplementation(() => ({
        loadSkills: vi.fn().mockResolvedValue([]),
    })),
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

import Home from '@/app/[locale]/(home)/page';
import { buildHomeFaq } from '@/app/[locale]/homeJsonLd';
import { expectFaqSingleSource } from '@/__tests__/utils/expectFaqSingleSource';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import { GITHUB_URL } from '@/shared/lib/seo';
import { SITE_OPERATOR } from '@/shared/lib/legal';

async function renderHome() {
    return await Home({ params: Promise.resolve({ locale: 'ko' }) });
}

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

    /**
     * 6문항으로 줄인 것은 카피 취향이 아니라 결정 사항이다(2026-09-17 §결정 6) —
     * 탈락한 문항은 탭별 FAQ와 중복이거나 매수세 조언 톤이었다. 배열이 조용히
     * 다시 불어나면 홈이 또 12문항짜리 FAQ 블록이 된다.
     */
    it('홈에 싣는 문항은 6개다', () => {
        expect(buildHomeFaq(key => key)).toHaveLength(6);
    });
});

describe('홈 Organization 노드', () => {
    /**
     * `founder.sameAs`는 운영자 개인 저장소를 가리키는데 `Organization.sameAs`는
     * 서비스 저장소만 주장하고 있었다 — 파서가 두 프로필을 같은 주체로 묶을
     * 근거가 없다. 두 주소를 모두 선언해 그래프를 닫는다.
     */
    it('sameAs에 운영자 저장소와 서비스 저장소가 모두 있다', async () => {
        const organization = collectJsonLdData(await renderHome()).find(
            d => d['@type'] === 'Organization'
        ) as { sameAs: string[] } | undefined;

        expect(organization?.sameAs).toEqual([
            SITE_OPERATOR.githubUrl,
            GITHUB_URL,
        ]);
    });
});
