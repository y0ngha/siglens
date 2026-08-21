/**
 * i18n 회귀 가드 — 별도 파일인 이유: `page.test.ts`/`page.ssr.test.tsx`는
 * `@/shared/lib/seo` 전체를 ko 리터럴 스텁으로 목킹한다(그 파일들의 관심사는
 * title/description "존재" 여부이지 번역 정확성이 아니다). 이 파일은 반대로
 * **`shared.seo` 실제 카탈로그**를 거쳐야 하므로 그 목을 걸지 않는다 — 걸면
 * `backtestingTitle`/`backtestingDescription`이 로케일과 무관하게 항상 같은
 * ko 문자열을 돌려줘 이 가드가 회귀를 절대 못 잡는 죽은 테스트가 된다.
 */
vi.mock('@/widgets/backtesting/BacktestHero', () => ({
    BacktestHero: () => null,
}));
vi.mock('@/widgets/backtesting/BacktestTabs', () => ({
    BacktestTabs: () => null,
}));

import { generateMetadata } from '@/app/[locale]/backtesting/page';

describe('/backtesting generateMetadata — en 로케일', () => {
    it('title/description에 한글이 없다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en' }),
        });
        const title = metadata.title as { absolute: string };
        expect(title.absolute).not.toMatch(/[가-힣]/);
        expect(String(metadata.description)).not.toMatch(/[가-힣]/);
    });
});
