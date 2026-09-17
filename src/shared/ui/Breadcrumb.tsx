import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SITE_NAME } from '@/shared/lib/seo';

export interface BreadcrumbCrumb {
    /**
     * 화면에 보이는 텍스트. **같은 페이지의 `BreadcrumbList` JSON-LD `name`과
     * 글자까지 같아야 한다** — 구글은 둘이 다르면 마크업을 무시한다
     * (`buildBreadcrumbJsonLd` JSDoc 참조).
     */
    readonly label: string;
    /** 없으면 링크 없이 텍스트로만 그린다. 마지막 마디는 보통 없다. */
    readonly href?: string;
}

interface BreadcrumbProps {
    /** 홈(`SITE_NAME`) **다음** 마디들. 홈은 여기서 자동으로 앞에 붙는다. */
    readonly trail: readonly BreadcrumbCrumb[];
}

/**
 * 가시 브레드크럼. `/privacy`·`/terms`가 쓰던 마크업을 그대로 옮겨 허브 페이지
 * 전체가 공유한다.
 *
 * **왜 가시 표면이 필요한가**: 허브들은 `BreadcrumbList` 구조화데이터만 내보내고
 * 화면에는 대응하는 경로가 없었다. 구글은 마크업이 페이지에 실제로 보이는 것을
 * 반영할 것을 요구하므로, 마크업만 있는 상태는 리치 결과 자격이 없을 뿐 아니라
 * "보이지 않는 텍스트" 판정 쪽에 가깝다. 이 컴포넌트와 `buildBreadcrumbJsonLd`가
 * 같은 문자열을 받는 것이 계약이다.
 *
 * 홈 마디를 인자로 받지 않는 이유는 `buildBreadcrumbJsonLd`와 같다 — 그쪽도
 * `SITE_NAME`을 자동으로 앞에 붙인다. 두 표면이 각자 홈을 받으면 한쪽만 빠뜨릴 수
 * 있고, 그 어긋남은 화면에 표시가 나지 않는다.
 */
export function Breadcrumb({ trail }: BreadcrumbProps) {
    const t = useTranslations('shared.ui');
    return (
        <nav aria-label={t('Breadcrumb.46c31f')} className="mb-6 text-xs">
            <ol className="flex flex-wrap items-center gap-2 text-secondary-500">
                <li>
                    <Link
                        href="/"
                        // 전 허브에 공통 렌더 — 진입 경로마다 다른 `_rsc` 해시로
                        // `/`의 캐시를 파편화시킨다(CDN_CACHING.md §1).
                        prefetch={false}
                        className="transition-colors hover:text-secondary-300"
                    >
                        {SITE_NAME}
                    </Link>
                </li>
                {trail.map((crumb, index) => {
                    const isLast = index === trail.length - 1;
                    return (
                        <Fragment key={crumb.href ?? crumb.label}>
                            <li aria-hidden="true">/</li>
                            <li
                                {...(isLast
                                    ? { 'aria-current': 'page' as const }
                                    : {})}
                                className="text-secondary-400"
                            >
                                {crumb.href ? (
                                    <Link
                                        href={crumb.href}
                                        prefetch={false}
                                        className="transition-colors hover:text-secondary-300"
                                    >
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    crumb.label
                                )}
                            </li>
                        </Fragment>
                    );
                })}
            </ol>
        </nav>
    );
}
