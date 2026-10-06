/**
 * i18n 회귀 가드 — 별도 파일인 이유: `page.test.ts`는 `@/shared/lib/seo`의
 * `resolveSymbolSeoContent`/`buildSymbolSeoContent`를 ko 리터럴로 목킹한다
 * (그 파일의 관심사는 title/description "존재" 여부이지 번역 정확성이 아니다).
 * 이 파일은 반대로 **`shared.seo` 실제 카탈로그**를 거쳐야 하므로 그 목을 걸지
 * 않는다 — 걸면 title/description이 로케일과 무관하게 항상 같은 ko 문자열을
 * 돌려줘 이 가드가 회귀를 절대 못 잡는 죽은 테스트가 된다.
 */
// `composeSymbolTitle`은 비-기본 로케일에서 한국어명 대신 영문 법인명을 title에 쓴다.
// 그래서 `koreanName`이 **있는** 종목이 핵심 케이스다 — 예전에는 차단 메타 경로
// (`noindexSymbolMetadata`)가 빌더에 로케일·영문명을 넘기지 않아 `/en/AAPL` title이
// `애플(AAPL) Stock Analysis`처럼 나갔는데, `koreanName: null`만 보던 이 테스트는 그걸 못 잡았다.
vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc. (AAPL)'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

import { generateMetadata } from '@/app/[locale]/[symbol]/page';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';

function mockAsset(koreanName: string | undefined): void {
    vi.mocked(getAssetInfoResilient).mockResolvedValue({
        assetInfo: {
            symbol: 'AAPL',
            fmpSymbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName,
        },
        degraded: false,
    });
}

describe('/[symbol] generateMetadata — en 로케일', () => {
    it.each([
        ['한국어명 있음', '애플'],
        ['한국어명 없음', undefined],
    ] as const)(
        '%s — title/description에 한글이 없다',
        async (_label, koreanName) => {
            mockAsset(koreanName);
            const metadata = await generateMetadata({
                params: Promise.resolve({ locale: 'en', symbol: 'AAPL' }),
            });
            const title = metadata.title as { absolute: string };
            expect(title.absolute).not.toMatch(/[가-힣]/);
            expect(title.absolute).toContain('Apple');
            expect(String(metadata.description)).not.toMatch(/[가-힣]/);
        }
    );
});
