import { getTranslations } from 'next-intl/server';
import { buildSymbolOgImage } from '@/entities/og-image/lib/buildSymbolOgImage';
import { isLocale } from '@/shared/i18n/locales';

/**
 * SiglensAI 랜딩 공유 카드 — `/api/ai/og/<locale>.png`. **정적·엣지 캐시용 경로**다.
 *
 * 예전 `/api/ai/og?locale=ko`(상위 `route.tsx`)는 입력이 쿼리스트링이라 정적화할 수
 * 없었다(`force-static`은 `searchParams`를 비운다 → 전부 기본 로케일). 그래서 매 요청
 * 이미지를 새로 그렸고, 확장자 없는 `/api` 경로라 엣지(Cloudflare)도 캐시하지 않았다.
 * 입력을 경로 세그먼트로 옮기면:
 * - `force-static` + `revalidate`로 Next가 첫 요청에 한 번 그려 ISR 캐시에 둔다
 *   (`generateStaticParams = []` — 빌드 중 폰트 CDN을 부르지 않는다. 폰트 fetch가
 *   빌드에서 실패하면 Latin 폴백 이미지가 30일 박힌다).
 * - `.png` 확장자는 Cloudflare 기본 캐시 대상이고, 응답의 `s-maxage`
 *   (`OG_IMAGE_CACHE_CONTROL`)를 따른다.
 *
 * `/api`는 프록시 matcher 밖이라 두 호스트에서 같은 경로로 열리고, ai 호스트
 * robots.txt의 `Allow: /api/ai/og`가 접두사로 이 경로까지 연다.
 */
export const dynamic = 'force-static';
export const revalidate = 2592000; // 30d — 이미지가 (로케일 문구) 순수 함수라 신선도 개념이 없다.

/** 빈 배열 = 빌드 때 그리지 않고 첫 요청에 생성(on-demand ISR). */
export function generateStaticParams(): { file: string }[] {
    return [];
}

const FILE_RE = /^([a-z]{2})\.png$/;

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ file: string }> }
): Promise<Response> {
    const { file } = await params;
    const locale = FILE_RE.exec(file)?.[1];
    // 지원하지 않는 로케일은 404 — 기본 로케일로 좁히면 임의 파일명마다 같은 이미지가
    // 캐시 항목을 하나씩 더 차지한다.
    if (locale === undefined || !isLocale(locale))
        return new Response(null, { status: 404 });
    const t = await getTranslations({ locale, namespace: 'app.ai' });
    return buildSymbolOgImage({
        ticker: 'SIGLENS AI',
        label: t('seo.ogLabel'),
        locale,
    });
}
