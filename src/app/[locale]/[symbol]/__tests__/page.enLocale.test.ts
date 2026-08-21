/**
 * i18n 회귀 가드 — 별도 파일인 이유: `page.test.ts`는 `@/shared/lib/seo`의
 * `resolveSymbolSeoContent`/`buildSymbolSeoContent`를 ko 리터럴로 목킹한다
 * (그 파일의 관심사는 title/description "존재" 여부이지 번역 정확성이 아니다).
 * 이 파일은 반대로 **`shared.seo` 실제 카탈로그**를 거쳐야 하므로 그 목을 걸지
 * 않는다 — 걸면 title/description이 로케일과 무관하게 항상 같은 ko 문자열을
 * 돌려줘 이 가드가 회귀를 절대 못 잡는 죽은 테스트가 된다.
 */
// `koreanName`을 의도적으로 비운다 — `composeSymbolTitle`은 존재하면 로케일과
// 무관하게 한국어 회사명을 title 앞에 항상 붙인다(브랜드 검색 SEO를 위한
// 기존 설계, 이 회귀 가드의 대상이 아니다). 그 주입까지 검사하면 이 테스트가
// 정당한 기존 동작을 오탐으로 잡는다 — `koreanName` 없는 케이스로 좁혀
// `shared.seo` 번역 자체(core/tail/description)만 순수하게 검증한다.
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc. (AAPL)'),
    getAssetInfoResilient: vi.fn().mockResolvedValue({
        assetInfo: {
            symbol: 'AAPL',
            fmpSymbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: null,
        },
        degraded: false,
    }),
}));
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

import { generateMetadata } from '@/app/[locale]/[symbol]/page';

describe('/[symbol] generateMetadata — en 로케일', () => {
    it('title/description에 한글이 없다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en', symbol: 'AAPL' }),
        });
        const title = metadata.title as { absolute: string };
        expect(title.absolute).not.toMatch(/[가-힣]/);
        expect(String(metadata.description)).not.toMatch(/[가-힣]/);
    });
});
