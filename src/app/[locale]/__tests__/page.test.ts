vi.mock('@/widgets/home/HeroIllustration', () => ({
    HeroIllustration: () => null,
}));
vi.mock('@/widgets/home/HowItWorks', () => ({ HowItWorks: () => null }));
vi.mock('@/widgets/home/SkillsShowcase', () => ({
    SkillsShowcase: () => null,
    SkillsShowcaseSkeleton: () => null,
}));
vi.mock('@/widgets/home/StatsBar', () => ({
    StatsBar: () => null,
    StatsBarSkeleton: () => null,
}));
vi.mock('@/widgets/home/TickerCategories', () => ({
    TickerCategories: () => null,
}));
vi.mock('@/features/ticker-search', () => ({ SymbolSearchPanel: () => null }));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/skill', () => ({
    countSkillFiles: vi.fn().mockResolvedValue({
        indicators: 13,
        candlesticks: 30,
        patterns: 5,
        strategies: 4,
        supportResistance: 3,
    }),
    FileSkillsLoader: vi.fn().mockImplementation(() => ({
        loadSkills: vi.fn().mockResolvedValue([]),
    })),
}));
/**
 * **부분 목이다.** 통째로 갈아끼우면 이 모듈에 새 export가 생길 때마다
 * `No "x" export is defined on the mock`으로 깨지고, 더 나쁘게는 URL을 만드는
 * 로직 자체가 스텁으로 대체돼 테스트가 아무것도 검증하지 못한다.
 * 상수 세 개만 고정하고 나머지는 진짜를 쓴다.
 */
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    SITE_DESCRIPTION: 'test description',
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));

import { revalidate } from '@/app/[locale]/(home)/page';

describe('Home page', () => {
    it('exports revalidate as 86400 for ISR', () => {
        expect(revalidate).toBe(86400);
    });
});

/**
 * 홈 메타데이터 회귀.
 *
 * 두 번 연속 여기서 깨졌다:
 *  1. `alternates`만 돌려줘서 title·description이 루트 레이아웃의 **한국어
 *     상수**로 떨어졌다 — `/en`의 탭 제목과 공유 카드가 통째로 한국어.
 *  2. 그걸 고치며 `openGraph`/`twitter`를 선언하자 부모 것을 **교체**해
 *     `images`·`type`·`url`·`card`가 사라졌다 — 루트를 공유하면 미리보기
 *     이미지가 안 나온다(Next는 최상위 키 단위로 교체하지 병합하지 않는다).
 */
describe('홈 generateMetadata', () => {
    const load = async (locale: string) => {
        const { generateMetadata } = await import('../(home)/page');
        return generateMetadata({ params: Promise.resolve({ locale }) });
    };

    it.each(['ko', 'en', 'ja', 'zh'])(
        '%s: 제목·설명이 그 로케일이다',
        async locale => {
            const meta = await load(locale);

            // `absolute`여야 한다 — 문자열로 돌려주면 루트 레이아웃의
            // `title.template`(`%s | Siglens`)이 먹는다. 마스터의 홈은 title을
            // 아예 반환하지 않아 레이아웃 `default`가 그대로 나갔고(템플릿
            // 미적용), 카탈로그로 옮기며 문자열을 돌려주는 순간 v0.48.0에서
            // 일부러 뗀 접미사가 조용히 돌아왔다.
            const title = meta.title as { absolute?: string } | string;
            expect(typeof title).toBe('object');
            const absolute = (title as { absolute?: string }).absolute;
            expect(absolute).toBeTruthy();
            expect(absolute).not.toContain('| Siglens');
            expect(meta.description).toBeTruthy();
            if (locale !== 'ko') {
                expect(String(absolute)).not.toMatch(/[가-힣]/);
                expect(String(meta.description)).not.toMatch(/[가-힣]/);
            }
        }
    );

    /**
     * `og:url`이 전 로케일에서 ko 루트를 가리키면 어느 언어의 공유 카드를
     * 눌러도 한국어 페이지로 간다.
     */
    it.each([
        ['ko', 'https://siglens.io'],
        ['en', 'https://siglens.io/en'],
        ['ja', 'https://siglens.io/ja'],
        ['zh', 'https://siglens.io/zh'],
    ])('%s: og:url이 그 로케일 주소다', async (locale, expected) => {
        const meta = await load(locale);
        const og = meta.openGraph as Record<string, unknown>;
        expect(og['url']).toBe(expected);
    });

    it.each(['ko', 'en'])(
        '%s: og·twitter 이미지를 잃지 않는다',
        async locale => {
            const meta = await load(locale);
            const og = meta.openGraph as Record<string, unknown> | undefined;
            const twitter = meta.twitter as Record<string, unknown> | undefined;

            expect(og?.['images']).toBeDefined();
            expect(og?.['type']).toBe('website');
            expect(og?.['url']).toBeTruthy();
            expect(twitter?.['card']).toBe('summary_large_image');
            expect(twitter?.['images']).toBeDefined();
        }
    );
});
