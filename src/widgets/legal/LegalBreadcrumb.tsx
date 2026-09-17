import { Breadcrumb } from '@/shared/ui/Breadcrumb';

interface LegalBreadcrumbProps {
    pageTitle: string;
}

/**
 * `/privacy`·`/terms`의 브레드크럼. 마크업은 `shared/ui/Breadcrumb`가 소유한다 —
 * 원래 여기 있던 `<nav>`를 허브 페이지 8곳이 함께 쓰게 되면서 옮겼고, 이 래퍼는
 * 약관 셸이 계속 한 마디짜리 경로만 넘기면 된다는 사실만 남긴다.
 */
export function LegalBreadcrumb({ pageTitle }: LegalBreadcrumbProps) {
    return <Breadcrumb trail={[{ label: pageTitle }]} />;
}
