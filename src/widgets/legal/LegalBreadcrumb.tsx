import { Breadcrumb } from '@/shared/ui/Breadcrumb';

interface LegalBreadcrumbProps {
    /** 현재 문서 제목(홈 다음의 유일한 마디). */
    readonly pageTitle: string;
}

/**
 * `/privacy`·`/terms`의 브레드크럼. 마크업은 `shared/ui/Breadcrumb`가 소유하고,
 * 약관 페이지는 홈 → 문서 한 마디짜리 경로만 넘긴다.
 */
export function LegalBreadcrumb({ pageTitle }: LegalBreadcrumbProps) {
    return <Breadcrumb trail={[{ label: pageTitle }]} />;
}
