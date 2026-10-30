import type { Metadata } from 'next';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import type { Locale } from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';
import { aiManifestPath } from './aiManifest';

const AI_LAYOUT_METADATA: Metadata = {
    metadataBase: new URL(AI_SITE_URL),
    // ai 호스트 전체(대화·not-found)의 기본값: 비공개거나 비어 있어 색인하지 않는다.
    // 랜딩(`page.tsx`)이 덮어쓴다.
    robots: { index: false, follow: false },
    // 네이버 서치어드바이저는 호스트별로 소유 확인을 받는다. siglens.io 토큰은
    // `[locale]/layout.tsx`에 있고, 이 레이아웃은 별도 루트라 상속되지 않는다.
    verification: {
        other: {
            'naver-site-verification':
                'dd05a56cc099f67ca0597793f6965c8c9bd13ba3',
        },
    },
};

/**
 * ai 루트 레이아웃의 `generateMetadata` 본문. 제목의 제품명은 로케일을 따른다 — ko
 * `시그렌즈 AI`, 그 외 `SIGLENS AI`(`I18N.md#I18-11`). 그래서 정적 `metadata`가 아니다.
 */
export function buildAiLayoutMetadata(locale: Locale): Metadata {
    const productName = brandAiName(locale);
    return {
        ...AI_LAYOUT_METADATA,
        title: {
            default: productName,
            template: `%s | ${productName}`,
        },
        // ai 호스트 전용 매니페스트. 없으면 `app/manifest.ts`가 자동으로 걸려 ai 호스트에서
        // 설치한 앱이 메인 사이트 이름("시그렌즈")·바로가기(`/market`)를 달았다.
        manifest: aiManifestPath(locale),
        // iOS 홈 화면 이름은 이 값(없으면 문서 제목)을 쓴다 — 제목은 SEO 문구라 길다.
        appleWebApp: { title: productName },
    };
}
