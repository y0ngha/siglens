import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { LegalBreadcrumb } from './LegalBreadcrumb';

interface LegalUnavailableLink {
    readonly href: string;
    readonly label: string;
}

interface LegalUnavailableProps {
    breadcrumbTitle: string;
    eyebrow: string;
    title: string;
    /** 문서 제목 링크들(약관 ↔ 방침). 본문이 비어도 사용자가 갈 곳을 남긴다. */
    links: readonly LegalUnavailableLink[];
}

/**
 * 약관·방침 본문을 DB에서 읽지 못한 렌더(배포 빌드에 DB가 없을 때)의 안내 페이지.
 *
 * 빈 화면이나 404 대신 **비어 있지 않은** 안내를 낸다 — 이 HTML이 ISR 캐시에 굳더라도
 * 60초 뒤 재생성되고(`shortenRevalidateForDegrade`), 그동안 크롤러가 색인하지 않도록
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
        <main className="page-container flex flex-1 flex-col items-center py-12 sm:py-16">
            <article className="w-full max-w-3xl">
                <LegalBreadcrumb pageTitle={breadcrumbTitle} />

                <header className="border-b border-secondary-700 pb-8">
                    <p className="font-mono text-xs tracking-widest text-primary-400 uppercase">
                        {eyebrow}
                    </p>
                    <h1 className="mt-3 text-3xl font-bold text-secondary-50 sm:text-4xl">
                        {title}
                    </h1>
                </header>

                <div
                    role="status"
                    aria-label={t('unavailableNoticeLabel')}
                    className="my-8 rounded-lg border border-ui-warning/30 bg-ui-warning/5 p-4"
                >
                    <p className="text-sm leading-relaxed text-secondary-200">
                        {t('unavailableNotice')}
                    </p>
                </div>

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
            </article>
        </main>
    );
}
