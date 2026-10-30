import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { LegalBreadcrumb } from './LegalBreadcrumb';
import { LegalPageFrame } from './ui/layout/LegalPageFrame';
import { LegalWarningNotice } from './ui/notice/LegalWarningNotice';

/** 본문 대신 남기는 문서 링크 하나. */
interface LegalUnavailableLink {
    readonly href: string;
    readonly label: string;
}

interface LegalUnavailableProps {
    readonly breadcrumbTitle: string;
    readonly eyebrow: string;
    readonly title: string;
    /** 문서 제목 링크들(약관 ↔ 방침). 본문이 비어도 사용자가 갈 곳을 남긴다. */
    readonly links: readonly LegalUnavailableLink[];
}

/**
 * 약관·방침 본문을 DB에서 읽지 못한 렌더(배포 빌드에 DB가 없을 때)의 안내 페이지.
 *
 * 빈 화면이나 404 대신 **비어 있지 않은** 안내를 낸다 — 이 HTML이 ISR 캐시에 굳더라도
 * 60초 뒤 재생성되고(`shortenRevalidateForBuildDegrade`), 그동안 크롤러가 색인하지 않도록
 * 라우트가 noindex 메타데이터를 함께 낸다. 시행일·목차는 본문이 있어야 의미가 있어
 * `LegalPageShell`을 쓰지 않는다.
 */
export function LegalUnavailable({
    breadcrumbTitle,
    eyebrow,
    title,
    links,
}: LegalUnavailableProps) {
    const t = useTranslations('widgets.legal');
    return (
        <LegalPageFrame
            breadcrumb={<LegalBreadcrumb pageTitle={breadcrumbTitle} />}
            eyebrow={eyebrow}
            title={title}
        >
            <LegalWarningNotice
                role="status"
                label={t('unavailableNoticeLabel')}
            >
                {t('unavailableNotice')}
            </LegalWarningNotice>

            <ul className="space-y-2 text-sm">
                {links.map(link => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            className="rounded-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </LegalPageFrame>
    );
}
