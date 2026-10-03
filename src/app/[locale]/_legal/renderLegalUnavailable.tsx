import { LegalUnavailable } from '@/widgets/legal/LegalUnavailable';
import { shortenRevalidateForBuildDegrade } from '@/shared/cache/buildDegradedRevalidate';
import {
    PRIVACY_PATH,
    privacyTitle,
    TERMS_PATH,
    termsTitle,
} from '@/shared/lib/legal';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { LegalPolicy } from './legalPolicy';

/**
 * DB 없는 빌드(`loadLegalTerms` → `unavailable`)에서 `/terms`·`/privacy`가 내는 페이지.
 *
 * 비어 있지 않은 안내문을 내고, 이 렌더의 revalidate를 60초로 낮춘다. 라우트의
 * `revalidate = 86400`을 그대로 두면 안내문이 하루 동안 서빙된다. 배포 직후
 * `scripts/warm-isr.sh`(그리고 첫 요청)가 실데이터로 재생성한다. FMP 빌드 degrade와
 * 같은 메커니즘이다(`shortenRevalidateIfFmpFailedAtBuild`).
 *
 * 페이지 렌더 경로에서 불러야 revalidate 하향이 먹는다(다른 `unstable_cache` 안에서는
 * 전파되지 않는다).
 */
export async function renderLegalUnavailable(
    policy: LegalPolicy,
    eyebrow: string,
    tSeo: SeoTranslator
) {
    await shortenRevalidateForBuildDegrade();
    return (
        <LegalUnavailable
            breadcrumbTitle={policy.title(tSeo)}
            eyebrow={eyebrow}
            title={policy.title(tSeo)}
            links={[
                { href: TERMS_PATH, label: termsTitle(tSeo) },
                { href: PRIVACY_PATH, label: privacyTitle(tSeo) },
            ]}
        />
    );
}
